import requests
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

login_url = "https://api-mankai.staging.rikkei.edu.vn/v1/auth/login"
EMAIL = "maiquoctuan1994@gmail.com"
PASSWORD = "Tuan@2012"

res = requests.post(login_url, json={"email": EMAIL, "password": PASSWORD})
token = res.json()["data"]["accessToken"]

headers = {"Authorization": f"Bearer {token}"}
lesson_id = "69a121b22c933f947265c281" # TEXT type
lesson_id_2 = "688ee5091276f6122175c6a1" # SLIDE type

url1 = f"https://api-mankai.staging.rikkei.edu.vn/v1/student/lessons/{lesson_id}"
r1 = requests.get(url1, headers=headers)

url2 = f"https://api-mankai.staging.rikkei.edu.vn/v1/student/lessons/{lesson_id_2}"
r2 = requests.get(url2, headers=headers)

out = {
    "text_lesson": r1.json(),
    "slide_lesson": r2.json()
}

with open("dump_lesson_detail.json", "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)

print("Saved lesson details to dump_lesson_detail.json")
