from playwright.sync_api import sync_playwright
import sys

sys.stdout.reconfigure(encoding='utf-8')

EMAIL = "maiquoctuan1994@gmail.com"
PASSWORD = "Tuan@2012"

def handle_response(response):
    if "v1/student/" in response.url:
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
    print("Clicking first course card...")
    
    try:
        page.locator("._courseCard_1rtux_95").first.click()
        print("Clicked!")
    except Exception as e:
        print("Could not click:", e)
        
    page.wait_for_timeout(8000)
    browser.close()
