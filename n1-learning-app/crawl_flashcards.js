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

    console.log(`Found ${resources.length} flashcard resources.`);

    for (const resource of resources) {
        const lesson = n1_data.lessons.find(l => l.id === resource.lesson_id);
        if (!lesson) continue;

        try {
            console.log(`Fetching Flashcard: ${lesson.title} (${lesson.api_id})`);
            const url = `${API_BASE_URL}/flash-card/user/${lesson.api_id}`;
            const req = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
            if (req.status === 200) {
                const resData = await req.json();
                resource.raw_data = resData.data;
                count++;
                console.log(`[${count}/${resources.length}] Updated: ${lesson.title}`);
            }
        } catch (e) {
            console.log(`Error: ${e.message}`);
        }
        
        await new Promise(r => setTimeout(r, 100));
    }

    fs.writeFileSync('src/data/n1_data.json', JSON.stringify(n1_data, null, 2));
    console.log("DONE! Flashcards updated.");
}

main();
