let chartInstance = null;

function setStatus(id, msg, isError = false) {
  const el = document.getElementById(id);
  el.textContent = msg || "";
  el.style.color = isError ? "#b00020" : "#111";
}

function setMetric(id, value) {
  document.getElementById(id).textContent = (value ?? value === 0) ? String(value) : "-";
}

function formatDateYYYYMMDD(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function buildChart({ points, field, type }) {
  const ctx = document.getElementById("chart");

  if (chartInstance) chartInstance.destroy();

  if (Chart?.register && window.ChartZoom) {
    Chart.register(window.ChartZoom);
  }

  chartInstance = new Chart(ctx, {
    type,
    data: {
      datasets: [
        {
          label: field,
          data: points,
          borderColor: "#2563eb",
          backgroundColor: "rgba(37, 99, 235, 0.15)",
          fill: false,
          showLine: true,
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 4,
          spanGaps: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,

      interaction: {
        mode: "nearest",
        intersect: false
      },

      parsing: false,

      plugins: {
        legend: {
          display: true
        },
        tooltip: {
          callbacks: {
            title(items) {
              const ms = items[0]?.parsed?.x;
              if (typeof ms !== "number") return "";
              return luxon.DateTime.fromMillis(ms, { zone: "utc" })
                .toFormat("yyyy-LL-dd HH:mm 'UTC'");
            },
            label(item) {
              const y = item.parsed?.y;
              return `${field}: ${y}`;
            }
          }
        },

        decimation: {
          enabled: true,
          algorithm: "lttb",
          samples: 1000
        },

        zoom: {
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            mode: "x"
          },
          pan: {
            enabled: true,
            mode: "x"
          },
          limits: {
            x: { min: "original", max: "original" }
          }
        }
      },

      scales: {
        x: {
          type: "time",
          adapters: {
            date: { zone: "utc" }
          },
          time: {
            tooltipFormat: "yyyy-LL-dd HH:mm 'UTC'"
          },
          title: {
            display: true,
            text: "Time (UTC)"
          }
        },
        y: {
          title: {
            display: true,
            text: field
          },
          ticks: {
            callback(value) {
              if (typeof value === "number") return value.toString();
              return String(value);
            }
          }
        }
      }
    }
  });
}


async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.message || `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

function updateApiExamples({ field, start_date, end_date }) {
  const base = window.location.origin;
  document.getElementById("api_examples").textContent =
`Time-series:
${base}/api/measurements?field=${field}&start_date=${start_date}&end_date=${end_date}&page=1&limit=500

Metrics:
${base}/api/measurements/metrics?field=${field}&start_date=${start_date}&end_date=${end_date}

Add measurement:
${base}/api/measurements (POST JSON)`;
}

function readFilters() {
  const field = document.getElementById("field").value;
  const start_date = document.getElementById("start_date").value;
  const end_date = document.getElementById("end_date").value;
  const chart_type = document.getElementById("chart_type").value;
  return { field, start_date, end_date, chart_type };
}

async function loadChart() {
  const { field, start_date, end_date, chart_type } = readFilters();

  updateApiExamples({ field, start_date, end_date });
  setStatus("status", "Loading chart...");

  const tsUrl = `/api/measurements?field=${encodeURIComponent(field)}&start_date=${encodeURIComponent(start_date)}&end_date=${encodeURIComponent(end_date)}&page=1&limit=5000`;
  const ts = await fetchJSON(tsUrl);


  console.log("TS DATA:", ts.data);

  const points = ts.data
    .map((p) => ({
      x: new Date(p.timestamp),
      y: Number(p[field])
    }))
    .filter((pt) => Number.isFinite(pt.y));


  buildChart({ points, field, type: chart_type });

  setStatus("status", `Loaded ${ts.meta.returned} points (total in range: ${ts.meta.total}).`);
}

async function loadMetrics() {
  const { field, start_date, end_date } = readFilters();

  updateApiExamples({ field, start_date, end_date });
  setStatus("metricsStatus", "Loading metrics...");

  const metricsUrl = `/api/measurements/metrics?field=${encodeURIComponent(field)}&start_date=${encodeURIComponent(start_date)}&end_date=${encodeURIComponent(end_date)}`;
  const m = await fetchJSON(metricsUrl);

  setMetric("m_avg", m.avg);
  setMetric("m_min", m.min);
  setMetric("m_max", m.max);
  setMetric("m_std", m.stdDev);
  setMetric("m_count", m.count);

  setStatus("metricsStatus", "Metrics loaded.");
}

function clearMetrics() {
  setMetric("m_avg", "-");
  setMetric("m_min", "-");
  setMetric("m_max", "-");
  setMetric("m_std", "-");
  setMetric("m_count", "-");
}

function initDefaultDates() {
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

  document.getElementById("start_date").value = formatDateYYYYMMDD(start);
  document.getElementById("end_date").value = formatDateYYYYMMDD(end);
}

document.addEventListener("DOMContentLoaded", () => {
  initDefaultDates();

  document.getElementById("resetZoom").addEventListener("click", () => {
    if (chartInstance && chartInstance.resetZoom) chartInstance.resetZoom();
  });

  document.getElementById("controls").addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus("status", "");
    try {
      await loadChart();
    } catch (err) {
      setStatus("status", err.message || "Failed to load chart.", true);
      if (chartInstance) chartInstance.destroy();
    }
  });

  document.getElementById("metricsForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus("metricsStatus", "");
    try {
      await loadMetrics();
    } catch (err) {
      setStatus("metricsStatus", err.message || "Failed to load metrics.", true);
      clearMetrics();
    }
  });

  document.getElementById("manualForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus("manualStatus", "");

    const timestamp = document.getElementById("in_timestamp").value.trim();
    const field1 = Number(document.getElementById("in_field1").value);
    const field2 = Number(document.getElementById("in_field2").value);
    const field3 = Number(document.getElementById("in_field3").value);

    try {
      const payload = {
        ...(timestamp ? { timestamp } : {}),
        field1,
        field2,
        field3
      };

      await fetchJSON("/api/measurements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      setStatus("manualStatus", "Saved to MongoDB.");

      try { await loadMetrics(); } catch (_) {}
    } catch (err) {
      setStatus("manualStatus", err.message || "Failed to save.", true);
    }
  });

  updateApiExamples(readFilters());

});
