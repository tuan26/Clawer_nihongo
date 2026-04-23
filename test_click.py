from playwright.sync_api import sync_playwright
import time
import json

EMAIL = "maiquoctuan1994@gmail.com"
PASSWORD = "Tuan@2012"

urls = []

def handle_response(response):
    if "api" in response.url:
        print(f"[API Response] {response.url}")
        
        if "course" in response.url or "lesson" in response.url or "section" in response.url:
            try:
                content = response.text()
                with open(f"api_log_{time.time()}.json", "w", encoding="utf-8") as f:
                    f.write(content)
            except:
                pass

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.on("response", handle_response)
    
    page.goto("https://lms.mankai.edu.vn/auth/login")
    page.wait_for_timeout(2000)
    
    page.fill('input[type="text"], input[type="email"]', EMAIL)
    page.fill('input[type="password"]', PASSWORD)
    page.click('button[type="submit"]')
    page.wait_for_timeout(3000)
    
    page.goto("https://lms.mankai.edu.vn/list-course")
    page.wait_for_timeout(3000)
    
    print("Trying to click a course...")
    try:
        page.evaluate("document.querySelectorAll('a').forEach(a => { if(a.href.includes('course') || a.href.includes('class')) a.click(); })")
        print("Clicked!")
    except Exception as e:
        print("Click error:", e)
        
    page.wait_for_timeout(5000)
    
    browser.close()
