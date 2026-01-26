const mongoose = require("mongoose");

const MeasurementSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, required: true, index: true },
    field1: { type: Number, required: true },
    field2: { type: Number, required: true },
    field3: { type: Number, required: true }

  },
  { versionKey: false }
);

module.exports = mongoose.model("Measurement", MeasurementSchema);
