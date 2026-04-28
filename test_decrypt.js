const fs = require('fs');
const CryptoJS = require('crypto-js');

const P = "MankaiDataEncryption";
const dump = JSON.parse(fs.readFileSync('quiz_api_dump.json', 'utf8'));

const quizRes = dump.find(r => r.url.includes('exam-lesson/user') && r.data && r.data.data && r.data.data.encrypted);
if (quizRes) {
    const encryptedData = quizRes.data.data.data;
    const bytes = CryptoJS.AES.decrypt(encryptedData, P);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    const parsed = JSON.parse(decrypted);
    
    console.log("Decrypted successfully. Number of items:", Array.isArray(parsed.items) ? parsed.items.length : (parsed.items ? 1 : 0));
    fs.writeFileSync('decrypted_quiz.json', JSON.stringify(parsed, null, 2));
} else {
    console.log("No encrypted quiz data found in dump.");
}
