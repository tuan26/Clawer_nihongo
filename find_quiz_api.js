const fs = require('fs');

async function main() {
    const API_BASE_URL = "https://api-mankai.staging.rikkei.edu.vn/v1";
    const EMAIL = "maiquoctuan1994@gmail.com";
    const PASSWORD = "Tuan@2012";

    const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD })
    });
    const loginData = await res.json();
    const token = loginData.data.accessToken;

    const data = JSON.parse(fs.readFileSync('mankai_data.json', 'utf8'));
    const quiz_lesson = data.lessons.find(l => l.type === 'QUIZ');

    if (quiz_lesson) {
        const api_id = quiz_lesson.api_id;
        console.log(`Testing QUIZ API for lesson ${api_id}: ${quiz_lesson.title}`);

        const endpoints = [
            `${API_BASE_URL}/student/lessons/${api_id}`,
            `${API_BASE_URL}/quiz/${api_id}`,
            `${API_BASE_URL}/exam/${api_id}`,
            `${API_BASE_URL}/student/exam/${api_id}`,
            `${API_BASE_URL}/student/exam?lessonId=${api_id}`,
        ];

        for (const ep of endpoints) {
            console.log(`GET ${ep}`);
            try {
                const r = await fetch(ep, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                console.log(`Status: ${r.status}`);
                if (r.status === 200) {
                    const text = await r.text();
                    console.log(text.substring(0, 200));
                }
            } catch (e) {
                console.log(e);
            }
        }
    } else {
        console.log("No QUIZ found");
    }
}

main();
