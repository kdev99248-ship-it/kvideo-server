const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");
const { chromium } = require("playwright");

const INPUT = "actors.json";
const OUTPUT_DIR = "./videos";

// tạo folder nếu chưa có
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function crawlModelVideos(browser, model) {
    let pageNum = 1;
    const videos = [];

    while (true) {
        const context = await browser.newContext({
            userAgent: randomUA(),
            viewport: { width: 1280, height: 720 },
            locale: "en-US",
        });
        const page = await context.newPage();

        let url =
            pageNum === 1
                ? model.link
                : `${model.link}page/${pageNum}/`;

        console.log(`→ ${model.title} | Page ${pageNum}`);

        try {
            await page.goto(url, { waitUntil: "domcontentloaded" });
            await page.waitForLoadState("networkidle");

            const html = await page.content();
            const $ = cheerio.load(html);

            const items = $(".loop-video");

            if (!items.length) break;

            items.each((_, el) => {
                const a = $(el).find("a");

                const link = a.attr("href");
                const title = a.attr("title") || $(el).find("span").text().trim();

                const img = $(el).find("img").attr("src");
                const duration = $(el).find(".duration").text().trim();

                videos.push({
                    title,
                    link,
                    img,
                    duration,
                });
            });

            // check next page
            const hasNext =
                $(".pagination a:contains('Next')").length > 0 ||
                $(`.pagination a[href*="page/${pageNum + 1}"]`).length > 0;

            if (!hasNext) break;

            pageNum++;
            await page.close();
            await context.close();
        } catch (err) {
            console.log(`Error ${model.title} page ${pageNum}:`, err.message);
            await sleep(2000);
            continue;
        }
    }

    return videos;
}
function randomUA() {
    const list = [
        // Chrome Windows
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36",

        // Chrome Mac
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",

        // Edge
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0",

        // Mobile (thỉnh thoảng thêm)
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Version/16.0 Mobile/15E148 Safari/604.1"
    ];

    return list[Math.floor(Math.random() * list.length)];
}
async function main() {
    const raw = fs.readFileSync(INPUT, "utf-8");
    const json = JSON.parse(raw);

    const models = json.data;

    for (const model of models) {
        try {
            
            console.log(`\n===== START ${model.title} =====`);

            const filePath = path.join(
                OUTPUT_DIR,
                `${model.title}.json`
            );
            if(fs.existsSync(filePath)){
                console.log("SKIP MODEL "  + model.title)
                continue;
            }
            const browser = await chromium.launch({
                headless: true,
            });
            const videos = await crawlModelVideos(browser, model);

            fs.writeFileSync(
                filePath,
                JSON.stringify(
                    {
                        model: model.title,
                        total: videos.length,
                        data: videos,
                    },
                    null,
                    2
                )
            );
            console.log(`Saved: ${filePath} (${videos.length} videos)`);
            await browser.close();
        } catch (err) {
            console.log(`FAIL model ${model.title}:`, err.message);
        }
    }

    await browser.close();
    console.log("DONE ALL");
}

main();