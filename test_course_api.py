import json
import time
from playwright.sync_api import sync_playwright

EMAIL = "maiquoctuan1994@gmail.com"
PASSWORD = "Tuan@2012"

def intercept_api(route, request):
    if "api-mankai" in request.url:
        print(f"[REQ] {request.method} {request.url}")
    route.continue_()

def handle_response(response):
    if "api-mankai" in response.url and response.request.resource_type in ["fetch", "xhr"]:
        try:
            print(f"[RES] {response.url} - {response.status}")
            data = response.json()
            # Dump every api response
            filename = f"course_api_{response.url.split('/')[-1].split('?')[0]}.json"
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"      -> Saved to {filename}")
        except Exception as e:
            pass

with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context()
    page = context.new_page()
    
    page.on("response", handle_response)
    
    # Login
    page.goto("https://lms.mankai.edu.vn/auth/login")
    page.fill('input[type="text"], input[type="email"]', EMAIL)
    page.fill('input[type="password"]', PASSWORD)
    page.click('button[type="submit"]')
    page.wait_for_timeout(3000)
    
    course_url = "https://lms.mankai.edu.vn/detail-course/686735b9d348bb1ef7783dc9"
    print(f"\nNavigating to {course_url}")
    page.goto(course_url)
    page.wait_for_timeout(8000)
    
    browser.close()
