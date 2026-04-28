const fs = require('fs');
try {
    const data = JSON.parse(fs.readFileSync('mankai_data.json', 'utf8'));
    const quizzes = data.resources.filter(r => r.type === 'QUIZ' || r.type === 'EXAM');
    if (quizzes.length > 0) {
        console.log(`Found ${quizzes.length} quizzes. Sample:`);
        console.log(JSON.stringify(quizzes[0], null, 2).substring(0, 500));
    } else {
        const unknown = data.resources.filter(r => r.type !== 'TEXT' && r.type !== 'SLIDE' && r.type !== 'VIDEO');
        console.log(`No QUIZ found. Other types: ${[...new Set(unknown.map(u => u.type))].join(', ')}`);
        if (unknown.length > 0) {
            console.log(JSON.stringify(unknown[0], null, 2).substring(0, 500));
        }
    }
} catch (e) {
    console.error(e);
}
