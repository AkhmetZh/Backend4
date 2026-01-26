require("dotenv").config();

const path = require("path");
const express = require("express");
const mongoose = require("mongoose");

const measurementsRouter = require("./routes/measurements");

const app = express();

app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

app.use("/api/measurements", measurementsRouter);

app.use("/api", (req, res) => {
  res.status(404).json({
    error: "NotFound",
    message: "API route not found"
  });
});

app.use((err, req, res, next) => {
  console.error(err);

  const status = err.statusCode || 500;
  res.status(status).json({
    error: err.name || "ServerError",
    message: err.message || "Internal server error"
  });
});

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

async function bootstrap() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is missing. Create .env from .env.example");
  }

  await mongoose.connect(MONGODB_URI, {
    autoIndex: true
  });

  console.log("Connected to MongoDB");

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

bootstrap().catch((e) => {
  console.error("Failed to start server:", e);
  process.exit(1);
});
