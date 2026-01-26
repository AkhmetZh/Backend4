const express = require("express");
const Measurement = require("../models/Measurement");

const router = express.Router();


const ALLOWED_FIELDS = new Set(["field1", "field2", "field3"]);

function httpError(statusCode, name, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.name = name;
  return err;
}

function isValidISODateOnly(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function parseDateRange(start_date, end_date) {
  if (start_date && !isValidISODateOnly(start_date)) {
    throw httpError(400, "ValidationError", "Invalid start_date. Expected YYYY-MM-DD.");
  }
  if (end_date && !isValidISODateOnly(end_date)) {
    throw httpError(400, "ValidationError", "Invalid end_date. Expected YYYY-MM-DD.");
  }

  if (!start_date && !end_date) return null;


  const start = start_date ? new Date(`${start_date}T00:00:00.000Z`) : null;
  const end = end_date ? new Date(`${end_date}T23:59:59.999Z`) : null;

  if (start && Number.isNaN(start.getTime())) {
    throw httpError(400, "ValidationError", "Invalid start_date value.");
  }
  if (end && Number.isNaN(end.getTime())) {
    throw httpError(400, "ValidationError", "Invalid end_date value.");
  }
  if (start && end && start > end) {
    throw httpError(400, "ValidationError", "start_date must be <= end_date.");
  }

  const match = {};
  if (start) match.$gte = start;
  if (end) match.$lte = end;

  return match;
}

function parsePagination(query) {
  const pageRaw = query.page ?? "1";
  const limitRaw = query.limit ?? "500";

  const page = Number(pageRaw);
  const limit = Number(limitRaw);

  if (!Number.isInteger(page) || page < 1) {
    throw httpError(400, "ValidationError", "Invalid page. Expected integer >= 1.");
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 5000) {
    throw httpError(400, "ValidationError", "Invalid limit. Expected integer 1..5000.");
  }

  return { page, limit, skip: (page - 1) * limit };
}

router.get("/", async (req, res, next) => {
  try {
    const { field, start_date, end_date } = req.query;

    if (!field || typeof field !== "string") {
      throw httpError(400, "ValidationError", "Missing field query param.");
    }
    if (!ALLOWED_FIELDS.has(field)) {
      throw httpError(
        400,
        "ValidationError",
        `Invalid field. Allowed: ${Array.from(ALLOWED_FIELDS).join(", ")}`
      );
    }

    if (!start_date || !end_date) {
      throw httpError(400, "ValidationError", "start_date and end_date are required (YYYY-MM-DD).");
    }

    const timestampMatch = parseDateRange(start_date, end_date);
    const { page, limit, skip } = parsePagination(req.query);

    const filter = { timestamp: timestampMatch };

    const projection = { timestamp: 1, [field]: 1, _id: 0 };

    const [items, total] = await Promise.all([
      Measurement.find(filter, projection)
        .sort({ timestamp: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Measurement.countDocuments(filter)
    ]);

    if (!items.length) {
      return res.status(404).json({
        error: "NoData",
        message: "No measurements found for the specified range."
      });
    }

    res.json({
      meta: {
        field,
        start_date,
        end_date,
        page,
        limit,
        total,
        returned: items.length
      },
      data: items
    });
  } catch (e) {
    next(e);
  }
});


router.get("/metrics", async (req, res, next) => {
  try {
    const { field, start_date, end_date } = req.query;

    if (!field || typeof field !== "string") {
      throw httpError(400, "ValidationError", "Missing field query param.");
    }
    if (!ALLOWED_FIELDS.has(field)) {
      throw httpError(
        400,
        "ValidationError",
        `Invalid field. Allowed: ${Array.from(ALLOWED_FIELDS).join(", ")}`
      );
    }

    const timestampMatch = parseDateRange(start_date, end_date);

    const matchStage = {};
    if (timestampMatch) matchStage.timestamp = timestampMatch;

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: null,
          avg: { $avg: `$${field}` },
          min: { $min: `$${field}` },
          max: { $max: `$${field}` },
          stdDev: { $stdDevPop: `$${field}` },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          avg: 1,
          min: 1,
          max: 1,
          stdDev: 1,
          count: 1
        }
      }
    ];

    const result = await Measurement.aggregate(pipeline);

    if (!result.length || result[0].count === 0) {
      return res.status(404).json({
        error: "NoData",
        message: "No measurements found for the specified filters."
      });
    }

    const out = result[0];
    const round = (x) => (typeof x === "number" ? Math.round(x * 1000) / 1000 : x);

    res.json({
      field,
      range: start_date || end_date ? { start_date: start_date || null, end_date: end_date || null } : null,
      count: out.count,
      avg: round(out.avg),
      min: round(out.min),
      max: round(out.max),
      stdDev: round(out.stdDev)
    });
  } catch (e) {
    next(e);
  }
});



router.post("/", async (req, res, next) => {
  try {
    const { timestamp, field1, field2, field3 } = req.body || {};

    const nums = { field1, field2, field3 };
    for (const [k, v] of Object.entries(nums)) {
      if (typeof v !== "number" || Number.isNaN(v)) {
        throw httpError(400, "ValidationError", `${k} must be a valid number.`);
      }
    }

    let ts = new Date();
    if (timestamp !== undefined && timestamp !== null && timestamp !== "") {
      if (typeof timestamp !== "string") {
        throw httpError(400, "ValidationError", "timestamp must be an ISO string.");
      }
      ts = new Date(timestamp);
    }

    if (Number.isNaN(ts.getTime())) {
      throw httpError(400, "ValidationError", "Invalid timestamp. Use ISO format like 2026-01-26T10:00:00Z");
    }

    const doc = await Measurement.create({ timestamp: ts, field1, field2, field3 });

    res.status(201).json({
      message: "Measurement created",
      data: {
        timestamp: doc.timestamp,
        field1: doc.field1,
        field2: doc.field2,
        field3: doc.field3
      }
    });
  } catch (e) {
    next(e);
  }
});
module.exports = router;