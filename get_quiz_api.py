import json
import time
from playwright.sync_api import sync_playwright

EMAIL = "maiquoctuan1994@gmail.com"
PASSWORD = "Tuan@2012"

def handle_response(response):
    req_url = response.url
    if "api-mankai" in req_url and response.request.method == "GET":
        try:
            content_type = response.headers.get("content-type", "")
            if "application/json" in content_type:
                data = response.json()
                print(f"[API] GET {req_url}")
                # Save the response if it looks like a quiz
                if "question" in json.dumps(data).lower() or "quiz" in req_url.lower() or "exam" in req_url.lower() or "detail" in req_url.lower():
                    filename = "quiz_api_dump_" + req_url.split('/')[-1].split('?')[0] + ".json"
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
    
    # Quiz Lesson URL
    lesson_url = "https://lms.mankai.edu.vn/vocabulary/686735b9d348bb1ef7783dc9/69699824d17377ffa26c44ac/69699ad2d17377ffa26c4745"
    print(f"\nNavigating to quiz lesson: {lesson_url}")
    page.goto(lesson_url)
    page.wait_for_timeout(8000)
    
    # Sometimes it needs to click "Bắt đầu làm bài" (Start quiz)
    try:
        # Check if there is a start button
        start_button = page.locator('button:has-text("Bắt đầu"), button:has-text("Start"), button:has-text("Làm bài")').first
        if start_button.is_visible():
            print("Clicking start quiz button...")
            start_button.click()
            page.wait_for_timeout(5000)
    except Exception as e:
        print("No start button found or clicked.")

    browser.close()
