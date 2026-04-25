const express = require("express");
const fs = require("fs");
const path = require("path");
const compression = require("compression");

const app = express();
const PORT = 3000;
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");

const swaggerDocument = YAML.load("./openapi.yaml");

const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: "127.0.0.1",
  user: "root",
  password: "",
  database: "kvideo",
  waitForConnections: true,
  connectionLimit: 10
});

const FILE_PATH = path.join(__dirname, "actors_m.json");
// gzip
app.use(compression());
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
// ===== API: GET ACTORS =====
app.get("/models", async (req, res) => {
  let {
    page = 1,
    limit = 25,
    search = "",
    sort = "asc"
  } = req.query;

  page = parseInt(page);
  limit = Math.min(parseInt(limit), 100);

  const offset = (page - 1) * limit;

  let where = "";
  let params = [];

  // SEARCH
  if (search) {
    where = "WHERE name LIKE ?";
    params.push(`%${search}%`);
  }

  const order = sort === "desc" ? "DESC" : "ASC";

  try {
    // total
    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM models ${where}`,
      params
    );

    const total = countRows[0].total;

    // data
    const [rows] = await pool.query(
      `SELECT * FROM models 
       ${where}
       ORDER BY name ${order}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data: rows
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== GET 1 ACTOR =====
// app.get("/actors/:id", (req, res) => {
//   const id = req.params.id;

//   const actor = ACTORS.find((a) =>
//     a.link.includes(`/actor/${id}`)
//   );

//   if (!actor) {
//     return res.status(404).json({ error: "Not found" });
//   }

//   res.json(actor);
// });


app.get("/videos/cursor", async (req, res) => {
  let { cursor, limit = 25, model } = req.query;

  limit = Math.min(parseInt(limit), 100);

  let where = [];
  let params = [];

  if (model) {
    where.push("model = ?");
    params.push(model);
  }

  if (cursor) {
    where.push("id < ?");
    params.push(cursor);
  }

  const whereSQL = where.length ? "WHERE " + where.join(" AND ") : "";

  const [rows] = await pool.query(
    `SELECT * FROM medias
     ${whereSQL}
     ORDER BY id DESC
     LIMIT ?`,
    [...params, limit]
  );

  const nextCursor = rows.length ? rows[rows.length - 1].id : null;

  res.json({
    nextCursor,
    hasMore: rows.length === limit,
    data: rows
  });
});

app.get("/videos", async (req, res) => {
  let {
    page = 1,
    limit = 25,
    search = "",
    model = "",
    sort = "desc"
  } = req.query;

  page = Math.max(parseInt(page) || 1, 1);
  limit = Math.min(parseInt(limit) || 25, 100);

  const offset = (page - 1) * limit;

  let where = [];
  let params = [];

  if (model) {
    where.push("model = ?");
    params.push(model);
  }

  if (search) {
    where.push("title LIKE ?");
    params.push(`%${search}%`);
  }

  const whereSQL = where.length ? "WHERE " + where.join(" AND ") : "";
  const order = sort === "asc" ? "ASC" : "DESC";

  try {
    // lấy data + total cùng lúc (tối ưu hơn)
    const [rows] = await pool.query(
      `SELECT SQL_CALC_FOUND_ROWS *
       FROM medias
       ${whereSQL}
       ORDER BY id ${order}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [[{ total }]] = await pool.query(`SELECT FOUND_ROWS() as total`);

    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
      data: rows
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/models/:name/videos", async (req, res) => {
  const { name } = req.params;

  let { page = 1, limit = 25 } = req.query;

  page = Math.max(parseInt(page) || 1, 1);
  limit = Math.min(parseInt(limit) || 25, 100);

  const offset = (page - 1) * limit;

  try {
    // total
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM medias WHERE model = ?`,
      [name]
    );

    // data
    const [rows] = await pool.query(
      `SELECT * FROM medias
       WHERE model = ?
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [name, limit, offset]
    );

    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
      data: rows
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/models/:name", async (req, res) => {
  const { name } = req.params;

  const [rows] = await pool.query(
    `SELECT * FROM models WHERE name = ? LIMIT 1`,
    [name]
  );

  if (!rows.length) {
    return res.status(404).json({ error: "Not found" });
  }

  res.json(rows[0]);
});

app.get("/search", async (req, res) => {
  let {
    q = "",
    pageModels = 1,
    limitModels = 10,
    pageVideos = 1,
    limitVideos = 20
  } = req.query;

  q = q.trim();

  if (!q) {
    return res.json({
      models: { data: [], total: 0 },
      videos: { data: [], total: 0 }
    });
  }

  pageModels = Math.max(parseInt(pageModels) || 1, 1);
  limitModels = Math.min(parseInt(limitModels) || 10, 50);

  pageVideos = Math.max(parseInt(pageVideos) || 1, 1);
  limitVideos = Math.min(parseInt(limitVideos) || 20, 100);

  const offsetModels = (pageModels - 1) * limitModels;
  const offsetVideos = (pageVideos - 1) * limitVideos;

  try {
    // ===== MODELS =====
    const [[{ totalModels }]] = await pool.query(
      `SELECT COUNT(*) as totalModels 
       FROM models 
       WHERE name LIKE ?`,
      [`%${q}%`]
    );

    const [models] = await pool.query(
      `SELECT * FROM models
       WHERE name LIKE ?
       ORDER BY name ASC
       LIMIT ? OFFSET ?`,
      [`%${q}%`, limitModels, offsetModels]
    );

    // ===== VIDEOS =====
    const [[{ totalVideos }]] = await pool.query(
      `SELECT COUNT(*) as totalVideos 
       FROM medias 
       WHERE title LIKE ?`,
      [`%${q}%`]
    );

    const [videos] = await pool.query(
      `SELECT * FROM medias
       WHERE title LIKE ?
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [`%${q}%`, limitVideos, offsetVideos]
    );

    res.json({
      models: {
        page: pageModels,
        limit: limitModels,
        total: totalModels,
        totalPages: Math.ceil(totalModels / limitModels),
        data: models
      },
      videos: {
        page: pageVideos,
        limit: limitVideos,
        total: totalVideos,
        totalPages: Math.ceil(totalVideos / limitVideos),
        data: videos
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
