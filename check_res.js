const fs = require('fs');
try {
    const data = JSON.parse(fs.readFileSync('mankai_data.json', 'utf8'));
    const text_res = data.resources.filter(r => r.type === 'TEXT' && r.raw_data);
    const slide_res = data.resources.filter(r => r.type === 'SLIDE' && r.raw_data);
    const video_res = data.resources.filter(r => r.type === 'VIDEO' && r.raw_data);
    console.log(`TEXT: ${text_res.length}, SLIDE: ${slide_res.length}, VIDEO: ${video_res.length}`);
    if (text_res.length > 0) console.log("Sample TEXT:\n", JSON.stringify(text_res[0]).substring(0, 200));
    if (slide_res.length > 0) console.log("Sample SLIDE:\n", JSON.stringify(slide_res[0]).substring(0, 200));
    if (video_res.length > 0) console.log("Sample VIDEO:\n", JSON.stringify(video_res[0]).substring(0, 200));
} catch (e) {
    console.error(e);
}
