const fs = require('fs');
const CryptoJS = require('crypto-js');

const API_BASE_URL = "https://api-mankai.staging.rikkei.edu.vn/v1";
const EMAIL = "maiquoctuan1994@gmail.com";
const PASSWORD = "Tuan@2012";
const P = "MankaiDataEncryption";

function decrypt(data) {
    if (!data) return null;
    try {
        const bytes = CryptoJS.AES.decrypt(data, P);
        const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        return decryptedData;
    } catch (e) {
        return data; // Return as-is if not encrypted or error
    }
}

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
    const resources = n1_data.resources.filter(r => !r.raw_data);

    console.log(`Found ${resources.length} null resources. Starting sweep...`);

    for (const resource of resources) {
        const lesson = n1_data.lessons.find(l => l.id === resource.lesson_id);
        if (!lesson) continue;

        try {
            let url = '';
            if (resource.type === 'QUIZ') url = `${API_BASE_URL}/exam-lesson/user/${lesson.api_id}`;
            else if (resource.type === 'FLASH_CARD') url = `${API_BASE_URL}/flash-card/user/${lesson.api_id}`;
            else if (resource.type === 'TEXT') url = `${API_BASE_URL}/text/user/${lesson.api_id}`;
            else if (resource.type === 'SLIDE') url = `${API_BASE_URL}/slide/${lesson.api_id}`;
            else if (resource.type === 'VIDEO') url = `${API_BASE_URL}/video-url/user/${lesson.api_id}?limit=10&offset=0`;

            if (!url) continue;

            const req = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
            if (req.status === 200) {
                const resData = await req.json();
                let finalData = resData.data;
                
                if (resource.type === 'QUIZ') {
                    finalData = decrypt(finalData);
                }
                
                resource.raw_data = finalData;
                count++;
                console.log(`[${count}/${resources.length}] Updated ${resource.type}: ${lesson.title}`);
            }
        } catch (e) {
            console.log(`Error updating ${lesson.title}: ${e.message}`);
        }

        if (count % 20 === 0) {
            fs.writeFileSync('src/data/n1_data.json', JSON.stringify(n1_data, null, 2));
        }
        await new Promise(r => setTimeout(r, 50));
    }

    fs.writeFileSync('src/data/n1_data.json', JSON.stringify(n1_data, null, 2));
    console.log("DONE! Final sweep complete.");
}

main();
