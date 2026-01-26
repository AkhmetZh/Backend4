require("dotenv").config();

const mongoose = require("mongoose");
const Measurement = require("../models/Measurement");

const MONGODB_URI = process.env.MONGODB_URI;

function randomNormalish(mean, spread) {
  const u = (Math.random() + Math.random() + Math.random() + Math.random()) / 4;
  return mean + (u - 0.5) * 2 * spread;
}

async function seed() {
  if (!MONGODB_URI) throw new Error("MONGODB_URI missing");

  await mongoose.connect(MONGODB_URI, { autoIndex: true });

  await Measurement.deleteMany({});

  const now = new Date();
  const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // last 30 days
  start.setUTCMinutes(0, 0, 0);

  const docs = [];
  const hours = 30 * 24;

  for (let i = 0; i < hours; i++) {
    const ts = new Date(start.getTime() + i * 60 * 60 * 1000);

    const dailyCycle = Math.sin((2 * Math.PI * (ts.getUTCHours() / 24)));
    const field1 = randomNormalish(22 + dailyCycle * 3, 1.2);

    const field2 = Math.min(100, Math.max(0, randomNormalish(55 - dailyCycle * 8, 5)));

    const trend = i / hours;
    const field3 = randomNormalish(410 + trend * 15, 8);

    docs.push({
      timestamp: ts,
      field1: Math.round(field1 * 10) / 10,
      field2: Math.round(field2 * 10) / 10,
      field3: Math.round(field3 * 1) / 1
    });
  }

  await Measurement.insertMany(docs);

  console.log(`Seeded ${docs.length} measurements.`);

  await mongoose.disconnect();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
