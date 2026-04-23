from playwright.sync_api import sync_playwright
import sys
import time

sys.stdout.reconfigure(encoding='utf-8')

EMAIL = "maiquoctuan1994@gmail.com"
PASSWORD = "Tuan@2012"

def handle_response(response):
    if "api" in response.url.lower():
        print(f"[API] {response.url}")

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
    print("Clicking KHO GẠCH N1...")
    
    try:
        page.locator(".ant-card, a").filter(has_text="KHO GẠCH N1").first.click()
        print("Clicked KHO GẠCH N1!")
    except Exception as e:
        print("Could not click:", e)
        
    page.wait_for_timeout(8000)
    
    browser.close()
