import requests
import json

API_BASE_URL = "https://api-mankai.staging.rikkei.edu.vn/v1"
EMAIL = "maiquoctuan1994@gmail.com"
PASSWORD = "Tuan@2012"

session = requests.Session()
res = session.post(f"{API_BASE_URL}/auth/login", json={"email": EMAIL, "password": PASSWORD})
token = res.json()["data"]["accessToken"]
session.headers.update({"Authorization": f"Bearer {token}"})

# Known quiz lesson ID from n1_structure.txt
# e.g., "Test ngày 1_08/09/2025" in "90 NGÀY ĐÊM MANTEN N1"
# We need to find its api_id. Let's load mankai_data.json
with open("mankai_data.json", "r", encoding="utf-8") as f:
    data = json.load(f)

quiz_lesson = None
for l in data["lessons"]:
    if l["type"] == "QUIZ":
        quiz_lesson = l
        break

if quiz_lesson:
    api_id = quiz_lesson["api_id"]
    print(f"Testing QUIZ API for lesson {api_id}: {quiz_lesson['title']}")
    
    endpoints = [
        f"{API_BASE_URL}/student/lessons/{api_id}",
        f"{API_BASE_URL}/quiz/{api_id}",
        f"{API_BASE_URL}/exam/{api_id}",
        f"{API_BASE_URL}/exams/{api_id}",
        f"{API_BASE_URL}/lesson-quiz/{api_id}",
        f"{API_BASE_URL}/student/exams?lessonId={api_id}",
    ]
    
    for ep in endpoints:
        print(f"GET {ep}")
        try:
            r = session.get(ep)
            print(f"Status: {r.status_code}")
            if r.status_code == 200:
                print(str(r.json())[:200])
        except Exception as e:
            print(e)
else:
    print("No QUIZ found")
