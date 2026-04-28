const fs = require('fs');
const API_BASE_URL = "https://api-mankai.staging.rikkei.edu.vn/v1";
const EMAIL = "maiquoctuan1994@gmail.com";
const PASSWORD = "Tuan@2012";

async function main() {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD })
    });
    const loginData = await res.json();
    const token = loginData.data.accessToken;

    const url = `${API_BASE_URL}/text/user/69d9fe8d6b826f0d32dec884`;
    const req = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await req.json();
    console.log("TEXT Response:", JSON.stringify(data, null, 2));
}

main();
