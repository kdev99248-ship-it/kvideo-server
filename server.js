const express = require("express");
const fs = require("fs");
const path = require("path");
const compression = require("compression");

const app = express();
const PORT = 3000;

const FILE_PATH = path.join(__dirname, "actors_m.json");

// gzip
app.use(compression());

// ===== LOAD DATA 1 LẦN =====
let ACTORS = [];

function loadData() {
  try {
    const raw = fs.readFileSync(FILE_PATH, "utf-8");
    ACTORS = JSON.parse(raw).map(a => ({
      ...a,
      titleLower: a.title.toLowerCase()
    }));
    console.log("Loaded actors:", ACTORS.length);
  } catch (err) {
    console.error("Load file failed:", err);
  }
}

loadData();

// (optional) reload khi file thay đổi
fs.watchFile(FILE_PATH, () => {
  console.log("File changed, reloading...");
  loadData();
});

// ===== API: GET ACTORS =====
app.get("/actors", (req, res) => {
  let {
    page = 1,
    limit = 20,
    search = "",
    sort = "asc", // asc | desc
  } = req.query;

  page = parseInt(page);
  limit = parseInt(limit);
  search = search.toLowerCase();
  if(limit > 100) limit = 100;
  let result = ACTORS;

  // ===== SEARCH =====
  if (search) {
    result = result.filter((item) =>
      item.title.toLowerCase().includes(search)
    );
  }

  // ===== SORT =====
  result = result.sort((a, b) => {
    if (sort === "desc") {
      return b.title.localeCompare(a.title);
    }
    return a.title.localeCompare(b.title);
  });

  const total = result.length;

  // ===== PAGINATION =====
  const start = (page - 1) * limit;
  const end = start + limit;

  const data = result.slice(start, end);

  // ===== CACHE HEADER =====
  res.setHeader("Cache-Control", "public, max-age=300");

  res.json({
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    data,
  });
});

// ===== GET 1 ACTOR =====
app.get("/actors/:id", (req, res) => {
  const id = req.params.id;

  const actor = ACTORS.find((a) =>
    a.link.includes(`/actor/${id}`)
  );

  if (!actor) {
    return res.status(404).json({ error: "Not found" });
  }

  res.json(actor);
});

// ===== DOWNLOAD RAW FILE =====
app.get("/actors/download", (req, res) => {
  res.download(FILE_PATH);
});

// ===== HEALTH =====
app.get("/", (req, res) => {
  res.send("API running 🚀");
});

// ===== START =====
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});