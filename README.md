
# Backend4 — Time-Series Analytics (MongoDB)

Simple analytical platform to store time-series data in MongoDB, visualize it in a web UI, and calculate basic statistics.

---

## Stack
- Node.js + Express  
- MongoDB + Mongoose  
- Chart.js (frontend)

---

## Features
- Store measurements (`timestamp`, `field1`, `field2`, `field3`)
- Filter data by date range
- Build time-series charts
- Calculate metrics: avg, min, max, stdDev
- Add measurements from the website

---

## Setup

1. Install dependencies
```bash
npm install
````

2. Create `.env`

```env
PORT
MONGODB_URI
```

3. Seed test data (optional)

```bash
npm run seed
```

4. Start server

```bash
npm start
```

Open:

```
http://localhost:3000
```

---

## Main API Endpoints

### Get time-series

```
GET /api/measurements?field=field1&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
```

### Get metrics

```
GET /api/measurements/metrics?field=field1&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
```

### Add measurement

```
POST /api/measurements
```

Body:

```json
{
  "timestamp": "2026-01-26T10:00:00Z",
  "field1": 22.5,
  "field2": 55,
  "field3": 410
}
```

---

## Notes

* `timestamp` is optional (server uses current time)
* Dates use `YYYY-MM-DD`
* Frontend and backend run on the same server

---
