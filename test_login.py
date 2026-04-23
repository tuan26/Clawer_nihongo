from playwright.sync_api import sync_playwright
import time
import json

EMAIL = "maiquoctuan1994@gmail.com"
PASSWORD = "Tuan@2012"

def handle_response(response):
    if "api" in response.url or "course" in response.url:
        if response.request.resource_type in ["fetch", "xhr"]:
            try:
                print(f"[API] {response.url}")
                if "course" in response.url.lower():
                    with open("api_response.json", "w", encoding="utf-8") as f:
                        f.write(response.text())
            except Exception as e:
                pass

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.on("response", handle_response)
    
    print("Going to login page...")
    page.goto("https://lms.mankai.edu.vn/auth/login")
    page.wait_for_timeout(3000) # wait for render
    
    # Dump auth login page just in case we need exact selectors
    with open("auth_dump.html", "w", encoding="utf-8") as f:
        f.write(page.content())
        
    print("Filled credentials..")
    # try to fill
    try:
        page.fill('input[type="text"], input[type="email"]', EMAIL)
        page.fill('input[type="password"]', PASSWORD)
        page.click('button[type="submit"]')
        print("Clicked submit!")
    except Exception as e:
        print("Could not fill login:", e)
        
    page.wait_for_timeout(5000)
    
    print("Navigating to list-course...")
    page.goto("https://lms.mankai.edu.vn/list-course")
    page.wait_for_timeout(5000)
    
    browser.close()
