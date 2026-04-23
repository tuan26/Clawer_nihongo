import json
import time
from playwright.sync_api import sync_playwright

EMAIL = "maiquoctuan1994@gmail.com"
PASSWORD = "Tuan@2012"

def handle_response(response):
    req_url = response.url
    # Filter out static assets
    if any(req_url.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".svg", ".css", ".js", ".woff", ".woff2", ".ttf"]):
        return
    if "google" in req_url or "youtube" in req_url or "facebook" in req_url or "analytics" in req_url:
        return
        
    try:
        content_type = response.headers.get("content-type", "")
        if "application/json" in content_type:
            data = response.json()
            # If data is small enough, print it, or save it
            print(f"[API] GET {req_url}")
            filename = "lesson_" + req_url.split('/')[-1].split('?')[0] + ".json"
            # let's only save APIs related to lesson content
            if "student" in req_url or "lesson" in req_url:
                with open(filename, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                print(f"      -> Saved {filename}")
    except Exception as e:
        pass

with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context()
    page = context.new_page()
    
    page.on("response", handle_response)
    
    # Login
    print("Logging in...")
    page.goto("https://lms.mankai.edu.vn/auth/login")
    page.fill('input[type="text"], input[type="email"]', EMAIL)
    page.fill('input[type="password"]', PASSWORD)
    page.click('button[type="submit"]')
    page.wait_for_timeout(3000)
    
    # Text Lesson URL
    lesson_url = "https://lms.mankai.edu.vn/vocabulary/686735b9d348bb1ef7783dc9/688b346107a3ea9f7fa57f59/69a121b22c933f947265c281"
    print(f"\nNavigating to text lesson: {lesson_url}")
    page.goto(lesson_url)
    page.wait_for_timeout(5000)
    
    # Slide Lesson URL
    lesson_url_2 = "https://lms.mankai.edu.vn/vocabulary/686735b9d348bb1ef7783dc9/688b346107a3ea9f7fa57f59/688ee5091276f6122175c6a1"
    print(f"\nNavigating to slide lesson: {lesson_url_2}")
    page.goto(lesson_url_2)
    page.wait_for_timeout(5000)
    
    # Video Lesson URL
    lesson_url_3 = "https://lms.mankai.edu.vn/vocabulary/686735b9d348bb1ef7783dc9/68673666d348bb1ef7783e6e/687f5ca1ea1381040c98f3db"
    print(f"\nNavigating to video lesson: {lesson_url_3}")
    page.goto(lesson_url_3)
    page.wait_for_timeout(5000)
        
    browser.close()
