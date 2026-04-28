const fs = require('fs');
const text = fs.readFileSync('app.js', 'utf8');

// The code was: const X=CryptoJS.AES.decrypt(r.data.toString(),P).toString(CryptoJS.enc.Utf8)
// Let's find the declaration of P. We can search for the block of code surrounding decrypt.
const match = text.match(/.{0,100}CryptoJS\.AES\.decrypt.{0,100}/g);
if (match) {
    console.log("Match:", match[0]);
    // extract surrounding text
    const idx = text.indexOf(match[0]);
    console.log(text.substring(Math.max(0, idx - 500), idx + 500));
}
