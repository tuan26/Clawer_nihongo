import json

def main():
    try:
        with open('mankai_data.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        print("Courses:")
        for c in data.get('courses', []):
            print(f"- {c['title']} (api_id: {c['api_id']}, hash: {c['id']})")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    main()
