import time
from playwright.sync_api import sync_playwright

EMAIL = "maiquoctuan1994@gmail.com"
PASSWORD = "Tuan@2012"

with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context()
    page = context.new_page()
    
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
    
    print("Dumping HTML...")
    with open("lesson_69a121b22c933f947265c281.html", "w", encoding="utf-8") as f:
        f.write(page.content())
    
    # Text Lesson with Quiz URL to see if quiz data is in HTML
    quiz_url = "https://lms.mankai.edu.vn/vocabulary/686735b9d348bb1ef7783dc9/68673666d348bb1ef7783e6e/6880ba56015d2dbb912e07aa"
    print(f"\nNavigating to quiz lesson: {quiz_url}")
    page.goto(quiz_url)
    page.wait_for_timeout(5000)
    
    with open("lesson_quiz_6880ba56015d2dbb912e07aa.html", "w", encoding="utf-8") as f:
        f.write(page.content())
        
    browser.close()
