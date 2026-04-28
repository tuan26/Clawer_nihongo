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

    // Test a TEXT lesson
    const textLesson = n1_data.lessons.find(l => l.title.includes('Tổng hợp list sách giáo khoa'));
    if (textLesson) {
        console.log(`Fetching text content for: ${textLesson.title} (${textLesson.api_id})`);
        const url = `${API_BASE_URL}/text-lesson/user/${textLesson.api_id}`;
        const req = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await req.json();
        console.log("TEXT Response:", JSON.stringify(data, null, 2));
    }

    // Test a SLIDE lesson
    const slideLesson = n1_data.lessons.find(l => l.title.includes('TỪ VỰNG CƠ BẢN N1 - NGHE TỪ VỰNG'));
    if (slideLesson) {
        console.log(`Fetching slide content for: ${slideLesson.title} (${slideLesson.api_id})`);
        const url = `${API_BASE_URL}/slide-lesson/user/${slideLesson.api_id}`;
        const req = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await req.json();
        console.log("SLIDE Response:", JSON.stringify(data, null, 2).substring(0, 500));
    }
}

main();
