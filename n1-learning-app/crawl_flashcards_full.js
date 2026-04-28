const fs = require('fs');
const API_BASE_URL = "https://api-mankai.staging.rikkei.edu.vn/v1";
const EMAIL = "maiquoctuan1994@gmail.com";
const PASSWORD = "Tuan@2012";

async function main() {
    console.log("Logging in...");
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD })
    });
    const loginData = await res.json();
    const token = loginData.data.accessToken;

    const n1_data = JSON.parse(fs.readFileSync('src/data/n1_data.json', 'utf8'));

    let count = 0;
    const resources = n1_data.resources.filter(r => r.type === 'FLASH_CARD');

    console.log(`Found ${resources.length} flashcard resources. Fetching ALL cards...`);

    for (const resource of resources) {
        const lesson = n1_data.lessons.find(l => l.id === resource.lesson_id);
        if (!lesson) continue;

        try {
            let allItems = [];
            let offset = 0;
            let total = 1;

            while (offset < total) {
                const url = `${API_BASE_URL}/flash-card/user/${lesson.api_id}?limit=50&offset=${offset}`;
                const req = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
                if (req.status === 200) {
                    const resData = await req.json();
                    const data = resData.data;
                    allItems.push(...(data.items || []));
                    total = data.meta?.total || 0;
                    offset += 50;
                } else {
                    break;
                }
            }

            resource.raw_data = { items: allItems };
            count++;
            console.log(`[${count}/${resources.length}] Updated: ${lesson.title} (${allItems.length} cards)`);
        } catch (e) {
            console.log(`Error: ${e.message}`);
        }
        
        if (count % 20 === 0) {
             fs.writeFileSync('src/data/n1_data.json', JSON.stringify(n1_data, null, 2));
        }
        await new Promise(r => setTimeout(r, 50));
    }

    fs.writeFileSync('src/data/n1_data.json', JSON.stringify(n1_data, null, 2));
    console.log("DONE! All flashcards updated with full data.");
}

main();
