const fs = require('fs');

try {
    const data = JSON.parse(fs.readFileSync('mankai_data.json', 'utf8'));
    console.log("Courses:");
    (data.courses || []).forEach(c => {
        console.log(`- ${c.title} (api_id: ${c.api_id}, hash: ${c.id})`);
    });
} catch (e) {
    console.error(e);
}
