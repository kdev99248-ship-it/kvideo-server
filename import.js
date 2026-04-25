const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const DATA_DIR = "./videos";

function parseTitle(title) {
    const parts = title.split("_");

    return {
        code: parts[0] || null,
        model: parts[1] || null,
        date: parts[2] || null
    };
}

async function main() {
    const db = await mysql.createConnection({
        host: "127.0.0.1",
        user: "root",
        password: "",
        database: "kvideo"
    });

    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".json"));

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

        const fallbackModel = json.model;
        const data = json.data || [];

        console.log(`Đang xử lý ${file} | model=${fallbackModel} | items=${data.length}`);

        const values = data.map(item => {
            const parsed = parseTitle(item.title);

            return [
                item.link,
                parsed.model || fallbackModel,
                item.title,
                item.img,
                item.duration,
                parsed.code,
                parsed.date
            ];
        });

        try {
            await db.query(
                `INSERT INTO medias 
                (link, model, title, img, duration, code, created_date) 
                VALUES ?`,
                [values]
            );
            console.log("Saved model " + fallbackModel + " " + values.length + " records.")
        } catch (e) {
            console.log("Insert lỗi:", e.message);
        }
    }

    await db.end();
    console.log("DONE");
}

main();