const fs = require('fs');

try {
    const data = JSON.parse(fs.readFileSync('mankai_data.json', 'utf8'));
    const n1_course_id = data.courses.find(c => c.title.includes('90 NGÀY ĐÊM MANTEN N1'))?.id;
    
    if (n1_course_id) {
        const sections = data.sections.filter(s => s.course_id === n1_course_id);
        sections.sort((a, b) => a.order - b.order);
        
        let output = "Sections for 90 NGÀY ĐÊM MANTEN N1:\n";
        sections.forEach(s => {
            output += `- [${s.order}] ${s.title}\n`;
            const lessons = data.lessons.filter(l => l.section_id === s.id);
            lessons.sort((a, b) => a.order - b.order);
            lessons.forEach(l => {
                output += `  * [${l.order}] ${l.title} (${l.type})\n`;
            });
        });
        fs.writeFileSync('n1_structure.txt', output);
        console.log("Written to n1_structure.txt");
    } else {
        console.log("Course not found");
    }
} catch (e) {
    console.error(e);
}
