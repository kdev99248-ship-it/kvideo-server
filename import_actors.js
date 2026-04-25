const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const DATA_DIR = "./models";

async function main() {
    const db = await mysql.createConnection({
        host: "127.0.0.1",
        user: "root",
        password: "",
        database: "kvideo"
    });

    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".json"));

    let values = [];

    for (const file of files) {
        const filePath = path.join(DATA_DIR, file);
        const raw = fs.readFileSync(filePath, "utf-8");

        let json;
        try {
            json = JSON.parse(raw);
        } catch (e) {
            console.error("JSON lỗi:", file);
            continue;
        }

        const name = json.model;
        const link = json.link;
        const avatar = json.img;
        const vers = 1; // hoặc json.version nếu bạn có

        if (!name) continue;

        values.push([vers, name, link, avatar]);
    }

    console.log("Tổng models:", values.length);

    if (values.length > 0) {
        try {
            await db.query(
                `INSERT INTO models (vers, name, link, avatar) VALUES ?`,
                [values]
            );
        } catch (e) {
            console.error("Insert lỗi:", e.message);
        }
    }

    await db.end();
    console.log("DONE");
}

main();