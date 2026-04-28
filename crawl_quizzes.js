const fs = require('fs');
const CryptoJS = require('crypto-js');

const P = "MankaiDataEncryption";
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

    const data = JSON.parse(fs.readFileSync('mankai_data.json', 'utf8'));

    // Filter N1 courses
    const n1Titles = ['KHO GẠCH N1', 'KANJI 1500', 'ĐIỂM DANH - N1 Chill Class', '90 NGÀY ĐÊM MANTEN N1'];
    const n1Courses = data.courses.filter(c => n1Titles.includes(c.title));
    const n1CourseIds = new Set(n1Courses.map(c => c.id));

    const n1Sections = data.sections.filter(s => n1CourseIds.has(s.course_id));
    const n1SectionIds = new Set(n1Sections.map(s => s.id));

    const n1Lessons = data.lessons.filter(l => n1SectionIds.has(l.section_id));
    const n1LessonIds = new Set(n1Lessons.map(l => l.id));

    const n1Quizzes = data.resources.filter(r => r.type === 'QUIZ' && n1LessonIds.has(r.lesson_id));

    console.log(`Found ${n1Quizzes.length} quizzes in N1 courses.`);

    // Crawl quizzes
    let count = 0;
    for (const quizRes of n1Quizzes) {
        if (quizRes.raw_data) continue; // Already crawled

        const lesson = n1Lessons.find(l => l.id === quizRes.lesson_id);
        if (!lesson) continue;

        try {
            const api_id = lesson.api_id;
            const url = `${API_BASE_URL}/exam-lesson/user/${api_id}`;
            const req = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
            
            if (req.status === 200) {
                const responseData = await req.json();
                if (responseData.data && responseData.data.encrypted) {
                    const encryptedData = responseData.data.data;
                    const bytes = CryptoJS.AES.decrypt(encryptedData, P);
                    const decrypted = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
                    
                    // Assign to raw_data
                    quizRes.raw_data = decrypted;
                    count++;
                    console.log(`[${count}/${n1Quizzes.length}] Fetched quiz: ${lesson.title}`);
                }
            } else {
                console.log(`[Error] status ${req.status} for ${lesson.title}`);
            }
        } catch (e) {
            console.log(`[Error] fetching ${lesson.title}`, e.message);
        }

        // Delay to be polite
        await new Promise(r => setTimeout(r, 200));
    }

    // Save full data back or separate file
    fs.writeFileSync('n1_data.json', JSON.stringify({
        courses: n1Courses,
        sections: n1Sections,
        lessons: n1Lessons,
        resources: data.resources.filter(r => n1LessonIds.has(r.lesson_id))
    }, null, 2));

    console.log(`Saved n1_data.json with updated quiz data!`);
}

main();
