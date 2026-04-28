const puppeteer = require('puppeteer');
const fs = require('fs');

const EMAIL = "maiquoctuan1994@gmail.com";
const PASSWORD = "Tuan@2012";

(async () => {
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const page = await browser.newPage();

    let allResponses = [];

    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('api-mankai') && response.request().method() === 'GET') {
            try {
                const contentType = response.headers()['content-type'];
                if (contentType && contentType.includes('application/json')) {
                    const text = await response.text();
                    try {
                        const data = JSON.parse(text);
                        allResponses.push({ url, data });
                        console.log(`[API] GET ${url}`);
                    } catch (e) {}
                }
            } catch (e) {}
        }
    });

    console.log("Logging in...");
    await page.goto("https://lms.mankai.edu.vn/auth/login", { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 2000));
    
    await page.type('input[type="text"], input[type="email"]', EMAIL);
    await page.type('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    
    await new Promise(r => setTimeout(r, 5000));
    console.log("Logged in!");

    const lesson_url = "https://lms.mankai.edu.vn/vocabulary/686735b9d348bb1ef7783dc9/69699824d17377ffa26c44ac/69699ad2d17377ffa26c4745";
    console.log(`Navigating to quiz lesson: ${lesson_url}`);
    await page.goto(lesson_url, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 5000));

    // Try to find a start button
    try {
        const startBtnSelectors = ['button'];
        const buttons = await page.$$(startBtnSelectors);
        for (let btn of buttons) {
            const text = await page.evaluate(el => el.textContent, btn);
            if (text && (text.includes("Bắt đầu") || text.includes("Start") || text.includes("Làm bài"))) {
                console.log("Clicking start button...");
                await btn.click();
                await new Promise(r => setTimeout(r, 5000));
                break;
            }
        }
    } catch (e) {
        console.log("Error clicking start button", e);
    }

    fs.writeFileSync('quiz_api_dump.json', JSON.stringify(allResponses, null, 2));
    console.log("Dumped responses to quiz_api_dump.json");

    await browser.close();
})();
