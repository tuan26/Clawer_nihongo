import os
import json
import hashlib
import requests
import sys

sys.stdout.reconfigure(encoding='utf-8')

# --- Core Settings ---
API_BASE_URL = "https://api-mankai.staging.rikkei.edu.vn/v1"
STATE_FILE = "state.json"
DATA_FILE = "mankai_data.json"

EMAIL = "maiquoctuan1994@gmail.com"
PASSWORD = "Tuan@2012"

# ----------------- UTILITIES -----------------

def generate_id(text: str) -> str:
    """Stable ID from string"""
    return hashlib.md5(text.encode('utf-8')).hexdigest()

class StateManager:
    def __init__(self, state_file=STATE_FILE):
        self.state_file = state_file
        self.state = {
            "completed_courses": [],
            "completed_sections": [],
            "completed_lessons": []
        }
        self.load()

    def load(self):
        if os.path.exists(self.state_file):
            with open(self.state_file, 'r', encoding='utf-8') as f:
                try:
                    loaded = json.load(f)
                    self.state.update(loaded)
                except json.JSONDecodeError:
                    pass

    def save(self):
        with open(self.state_file, 'w', encoding='utf-8') as f:
            json.dump(self.state, f, indent=2, ensure_ascii=False)

    def mark_completed(self, category, item_id):
        if item_id not in self.state[category]:
            self.state[category].append(item_id)
            self.save()

    def is_completed(self, category, item_id):
        return item_id in self.state[category]

class DataSink:
    def __init__(self, data_file=DATA_FILE):
        self.data_file = data_file
        self.data = {
            "courses": [],
            "sections": [],
            "lessons": [],
            "resources": []
        }
        self.load()

    def load(self):
        if os.path.exists(self.data_file):
            with open(self.data_file, 'r', encoding='utf-8') as f:
                try:
                    loaded = json.load(f)
                    self.data.update(loaded)
                except json.JSONDecodeError:
                    pass

    def save(self):
        with open(self.data_file, 'w', encoding='utf-8') as f:
            json.dump(self.data, f, indent=2, ensure_ascii=False)

    def add_item(self, category, item):
        # Update or append
        for i, existing in enumerate(self.data[category]):
            if existing["id"] == item["id"]:
                self.data[category][i] = item
                self.save()
                return
        self.data[category].append(item)
        self.save()

# ----------------- MAIN CRAWLER LOGIC -----------------

class MankaiCrawlerAPI:
    def __init__(self):
        self.state = StateManager()
        self.data = DataSink()
        self.session = requests.Session()
        self.headers = {
            "Accept": "application/json, text/plain, */*",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        }
        self.session.headers.update(self.headers)

    def login(self):
        print("[Auth] Đăng nhập vào Mankai LMS API...")
        login_url = f"{API_BASE_URL}/auth/login"
        payload = {"email": EMAIL, "password": PASSWORD}
        res = self.session.post(login_url, json=payload)
        res.raise_for_status()
        body = res.json()
        token = body["data"]["accessToken"]
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        print("[Auth] Đăng nhập thành công, đã lấy được Access Token.")

    def fetch_courses(self):
        print("\n[Crawler] Lấy danh sách khóa học...")
        url = f"{API_BASE_URL}/student/courses"
        res = self.session.get(url)
        res.raise_for_status()
        items = res.json().get("data", [])
        
        for item in items:
            course_api_id = item["id"]
            course_hash_id = generate_id(f"course_{course_api_id}")
            course_data = {
                "id": course_hash_id,
                "api_id": course_api_id,
                "title": item.get("title", ""),
                "url": f"https://lms.mankai.edu.vn/detail-course/{course_api_id}",
                "thumbnail": item.get("thumbnailUrl", "")
            }
            self.data.add_item("courses", course_data)
            
            if self.state.is_completed("completed_courses", course_hash_id):
                print(f"[Skip] Khóa học '{course_data['title']}' đã crawl xong.")
            else:
                self.fetch_sections(course_api_id, course_hash_id)
                self.state.mark_completed("completed_courses", course_hash_id)

    def fetch_sections(self, course_api_id, course_hash_id):
        print(f"  -> Lấy danh sách sections cho khóa học {course_api_id}...")
        sections_data = []
        limit = 50
        offset = 0
        total = 1
        
        # Pagination loop
        while offset < total:
            url = f"{API_BASE_URL}/student/sessons?courseId={course_api_id}&limit={limit}&offset={offset}"
            res = self.session.get(url)
            res.raise_for_status()
            data = res.json().get("data", {})
            items = data.get("items", [])
            total = data.get("meta", {}).get("total", 0)
            sections_data.extend(items)
            offset += limit
            
        for index, item in enumerate(sections_data):
            section_api_id = item["id"]
            section_hash_id = generate_id(f"section_{section_api_id}")
            section_info = {
                "id": section_hash_id,
                "course_id": course_hash_id,
                "api_id": section_api_id,
                "title": item.get("title", ""),
                "order": index + 1
            }
            self.data.add_item("sections", section_info)
            
            if self.state.is_completed("completed_sections", section_hash_id):
                print(f"    [Skip] Section '{section_info['title']}' đã crawl xong.")
            else:
                self.fetch_lessons(section_api_id, section_hash_id, course_api_id)
                self.state.mark_completed("completed_sections", section_hash_id)

    def fetch_lessons(self, section_api_id, section_hash_id, course_api_id):
        print(f"    -> Lấy lessons cho section {section_api_id}...")
        url = f"{API_BASE_URL}/student/lessons?sessonId={section_api_id}"
        res = self.session.get(url)
        res.raise_for_status()
        items = res.json().get("data", [])
        
        for index, item in enumerate(items):
            lesson_api_id = item["id"]
            lesson_hash_id = generate_id(f"lesson_{lesson_api_id}")
            lesson_type = item.get("type", "UNKNOWN")
            lesson_info = {
                "id": lesson_hash_id,
                "section_id": section_hash_id,
                "api_id": lesson_api_id,
                "title": item.get("title", ""),
                "type": lesson_type,
                "order": index + 1,
                "url": f"https://lms.mankai.edu.vn/vocabulary/{course_api_id}/{section_api_id}/{lesson_api_id}"
            }
            self.data.add_item("lessons", lesson_info)
            
            if self.state.is_completed("completed_lessons", lesson_hash_id):
                print(f"      [Skip] Lesson '{lesson_info['title']}' đã crawl.")
            else:
                self.fetch_resource(lesson_api_id, lesson_hash_id, lesson_type)
                self.state.mark_completed("completed_lessons", lesson_hash_id)

    def fetch_resource(self, lesson_api_id, lesson_hash_id, lesson_type):
        resource_id = generate_id(f"resource_{lesson_api_id}")
        resource_info = {
            "id": resource_id,
            "lesson_id": lesson_hash_id,
            "type": lesson_type,
            "raw_data": None
        }
        
        print(f"      -> Cào tài nguyên loại {lesson_type} id: {lesson_api_id}")
        try:
            if lesson_type == "SLIDE":
                url = f"{API_BASE_URL}/slide/{lesson_api_id}"
                res = self.session.get(url)
                if res.status_code == 200:
                    resource_info["raw_data"] = res.json().get("data")
            elif lesson_type == "VIDEO":
                url = f"{API_BASE_URL}/video-url/user/{lesson_api_id}?limit=10&offset=0"
                res = self.session.get(url)
                if res.status_code == 200:
                    resource_info["raw_data"] = res.json().get("data")
            elif lesson_type == "TEXT":
                # Current text lesson endpoint
                url = f"{API_BASE_URL}/student/lessons/{lesson_api_id}"
                res = self.session.get(url)
                if res.status_code == 200:
                    resource_info["raw_data"] = res.json().get("data")
        except Exception as e:
            print(f"      [Lỗi] Lấy resource thất bại: {e}")
            
        self.data.add_item("resources", resource_info)

    def start(self):
        try:
            self.login()
            self.fetch_courses()
            print("\n[Crawler] ĐÃ HOÀN THÀNH TOÀN BỘ CRAWL!")
        except Exception as e:
            print(f"[Error] Lỗi crawler: {e}")

if __name__ == "__main__":
    crawler = MankaiCrawlerAPI()
    crawler.start()
