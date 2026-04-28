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
    const resources = n1_data.resources;

    for (const resource of resources) {
        // Skip if already has deep data (except for empty TEXT/SLIDE)
        // Actually let's just refresh TEXT and SLIDE
        if (resource.type !== 'TEXT' && resource.type !== 'SLIDE' && resource.type !== 'VIDEO') continue;

        const lesson = n1_data.lessons.find(l => l.id === resource.lesson_id);
        if (!lesson) continue;

        try {
            let url = '';
            if (resource.type === 'TEXT') {
                url = `${API_BASE_URL}/text/user/${lesson.api_id}`;
            } else if (resource.type === 'SLIDE') {
                url = `${API_BASE_URL}/slide/${lesson.api_id}`;
            } else if (resource.type === 'VIDEO') {
                url = `${API_BASE_URL}/video-url/user/${lesson.api_id}?limit=10&offset=0`;
            }

            if (url) {
                const req = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
                if (req.status === 200) {
                    const resData = await req.json();
                    resource.raw_data = resData.data;
                    count++;
                    console.log(`[${count}/${resources.length}] Updated ${resource.type}: ${lesson.title}`);
                }
            }
        } catch (e) {
            console.log(`Error updating ${lesson.title}: ${e.message}`);
        }

        if (count % 20 === 0) {
            fs.writeFileSync('src/data/n1_data.json', JSON.stringify(n1_data, null, 2));
        }
        
        await new Promise(r => setTimeout(r, 100));
    }

    fs.writeFileSync('src/data/n1_data.json', JSON.stringify(n1_data, null, 2));
    console.log("DONE! Updated all resources.");
}

main();
