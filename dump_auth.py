from playwright.sync_api import sync_playwright

EMAIL = "maiquoctuan1994@gmail.com"
PASSWORD = "Tuan@2012"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    
    page.goto("https://lms.mankai.edu.vn/auth/login")
    page.fill('input[type="text"], input[type="email"]', EMAIL)
    page.fill('input[type="password"]', PASSWORD)
    page.click('button[type="submit"]')
    page.wait_for_timeout(3000)
    
    page.goto("https://lms.mankai.edu.vn/list-course")
    page.wait_for_timeout(5000)
    
    with open("list_course_dump.html", "w", encoding="utf-8") as f:
        f.write(page.content())
        
    browser.close()
