from playwright.sync_api import sync_playwright
import json

EMAIL = "maiquoctuan1994@gmail.com"
PASSWORD = "Tuan@2012"

def handle_response(response):
    if "v1/auth/login" in response.url:
        try:
            print("Auth Login Response Captured!")
            with open("login_response.json", "w", encoding="utf-8") as f:
                f.write(response.text())
        except Exception as e:
            print("Error:", e)

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
    
    browser.close()
