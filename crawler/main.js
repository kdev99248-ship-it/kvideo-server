const fs = require("fs");
const cheerio = require("cheerio");
const { chromium } = require("playwright");

const BASE = "https://sexbjcam.com";
const OUTPUT = "actors.json";

let first = true;
const stream = fs.createWriteStream(OUTPUT, { flags: "w" });
stream.write("[\n");

async function fetchHtml(url) {
    const browser = await chromium.launch({ headless: false, }); const context = await browser.newContext({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36", }); const page = await context.newPage(); await page.goto(url, { waitUntil: "domcontentloaded", }); await page.waitForLoadState("networkidle"); const html = await page.content(); await browser.close(); return html;
}
async function crawlAll() {
    // const browser = await chromium.launch({ headless: false });
    // const context = await browser.newContext();
    // const page = await context.newPage();

    let pageNum = 1;

    while (true) {
        let url;
        if(pageNum == 1){
            url = `${BASE}/actors`;
        }else{
            url = `${BASE}/actors/page/${pageNum}/`;
        }
        console.log("Crawling:", url);

        try {
            const html = await fetchHtml(url);
            const $ = cheerio.load(html);

            const items = $(".thumb-block");

            if (!items.length) break;

            items.each((_, el) => {
                const aTag = $(el).find("a");

                let link = aTag.attr("href") || "";
                let title =
                    aTag.attr("title") ||
                    $(el).find(".actor-title").text().trim();

                let img =
                    $(el).find("img").attr("data-src") ||
                    $(el).find("img").attr("src");

                if (link && !link.startsWith("http")) {
                    link = BASE + link;
                }

                const actor = { title, link, img };

                // ✅ append ngay lập tức
                if (!first) stream.write(",\n");
                stream.write(JSON.stringify(actor));
                first = false;
            });

            console.log(`Page ${pageNum}: ${items.length}`);

            const hasNext =
                $(".pagination a:contains('Next')").length > 0;

            if (!hasNext) break;

            pageNum++;

            // tránh bị block
            await new Promise((r) => setTimeout(r, 1000));
        } catch (err) {
            console.log("Error page", pageNum, err.message);
            // retry nhẹ
            await new Promise((r) => setTimeout(r, 3000));
            continue;
        }
    }

    stream.write("\n]");
    stream.end();

    await browser.close();

    console.log("DONE -> actors.json");
}

crawlAll();