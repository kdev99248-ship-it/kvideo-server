const fs = require("fs");
const path = require("path");

const INPUT_FILE = "./actors.json";
const OUTPUT_DIR = "./models";

// tạo folder nếu chưa có
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
}

// đọc file
const raw = fs.readFileSync(INPUT_FILE, "utf-8");
const json = JSON.parse(raw);

const data = json.data || [];

for (const item of data) {
    const modelName = item.title;

    if (!modelName) continue;

    const filePath = path.join(OUTPUT_DIR, `${modelName}.json`);

    // nội dung file
    const content = {
        model: modelName,
        link: item.link,
        img: item.img
    };

    fs.writeFileSync(filePath, JSON.stringify(content, null, 2), "utf-8");

    console.log("Created:", filePath);
}

console.log("DONE");