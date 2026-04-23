import requests
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

EMAIL = "maiquoctuan1994@gmail.com"
PASSWORD = "Tuan@2012"
BASE_API = "https://api-mankai.staging.rikkei.edu.vn/v1"

def guess_api():
    res = requests.post(f"{BASE_API}/auth/login", json={"email": EMAIL, "password": PASSWORD})
    token = res.json()["data"]["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}
    
    course_id = "686735b9d348bb1ef7783dc9"
    class_id = "687dc7afea1381040c98af71"
    
    guess_endpoints = [
        f"/student/courses/{course_id}/sessons",
        f"/student/courses/{course_id}/sessions",
        f"/student/courses/{course_id}/class/{class_id}",
        f"/student/courses/{course_id}?classId={class_id}",
        f"/student/course-sessons?courseId={course_id}",
        f"/student/sessons?courseId={course_id}",
        f"/student/groups?courseId={course_id}",
        f"/student/groups?courseId={course_id}&classId={class_id}",
        f"/student/courses/{course_id}/groups",
        f"/student/class/{class_id}/course/{course_id}"
    ]
    
    for ep in guess_endpoints:
        r = requests.get(f"{BASE_API}{ep}", headers=headers)
        print(f"GET {ep} -> {r.status_code}")
        if r.status_code == 200:
            print(f"FOUND IT: {ep}")
            with open("course_details.json", "w", encoding="utf-8") as f:
                json.dump(r.json(), f, ensure_ascii=False, indent=2)
            break

if __name__ == "__main__":
    guess_api()
