from playwright.sync_api import sync_playwright
import sys

sys.stdout.reconfigure(encoding='utf-8')

EMAIL = "maiquoctuan1994@gmail.com"
PASSWORD = "Tuan@2012"

def handle_request(req):
    if "api-mankai" in req.url:
        print("[API]", req.url)

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.on("request", handle_request)
    
    page.goto("https://lms.mankai.edu.vn/auth/login")
    page.fill('input[type="text"], input[type="email"]', EMAIL)
    page.fill('input[type="password"]', PASSWORD)
    page.click('button[type="submit"]')
    page.wait_for_timeout(3000)
    
    # Go directly to the known course
    url = "https://lms.mankai.edu.vn/course/686735b9d348bb1ef7783dc9/class/687dc7afea1381040c98af71"
    print(f"Navigating to {url}")
    page.goto(url)
    page.wait_for_timeout(8000) # wait for all lessons to render
    
    with open("course_loaded_dump.html", "w", encoding="utf-8") as f:
        f.write(page.content())
        
    browser.close()
