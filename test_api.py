import requests
import json
import sys

# force utf-8 print
sys.stdout.reconfigure(encoding='utf-8')

EMAIL = "maiquoctuan1994@gmail.com"
PASSWORD = "Tuan@2012"
BASE_API = "https://api-mankai.staging.rikkei.edu.vn/v1"

def test_flow():
    # 1. Login
    res = requests.post(f"{BASE_API}/auth/login", json={"email": EMAIL, "password": PASSWORD})
    if res.status_code != 201:
        print("Login failed:", res.status_code, res.text)
        return
        
    token = res.json()["data"]["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Get Courses
    courses_res = requests.get(f"{BASE_API}/student/courses", headers=headers)
    courses = courses_res.json().get("data", [])
    print(f"Found {len(courses)} courses.")
    
    if not courses: return
    
    first_course = courses[0]
    course_id = first_course["id"]
    class_id = first_course.get("classId", "")
    
    print(f"\nCourse 1: {first_course['title']} | ID: {course_id} | ClassID: {class_id}")
    
    # 3. Get Course detail/sections
    # Let's try to guess the endpoint for sections or lessons.
    # Usually it's something like /student/courses/{course_id}/sections or /student/classes/{class_id}/topics
    
    endpoints_to_test = [
        f"{BASE_API}/student/courses/{course_id}",
        f"{BASE_API}/student/courses/{course_id}/sections",
        f"{BASE_API}/student/classes/{class_id}",
        f"{BASE_API}/student/classes/{class_id}/courses/{course_id}"
    ]
    
    for ep in endpoints_to_test:
        r = requests.get(ep, headers=headers)
        print(f"GET {ep} -> {r.status_code}")
        if r.status_code == 200:
            with open(f"endpoint_success_{ep.split('/')[-1]}.json", "w", encoding="utf-8") as f:
                json.dump(r.json(), f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    test_flow()
