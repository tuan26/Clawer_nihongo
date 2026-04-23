import re

with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

matches = set(re.findall(r'/v1/[a-zA-Z0-9\-\/]*', text, re.IGNORECASE))
for m in sorted(list(matches))[:50]:
    print(m)
