import os
import re

artifact_path = '/home/thekhai/.gemini/antigravity-cli/brain/06fdde63-43d6-4f3f-8a20-24436c5d5254/pgnexus_frontend.md'
output_dir = '/home/thekhai/code/tien-web/frontend/'

with open(artifact_path, 'r') as f:
    content = f.read()

# Regular expression to find headers indicating file paths and their corresponding code blocks
# Assuming format: ## `filename`\n\n```ext\ncode\n```
pattern = re.compile(r'##\s+`([^`]+)`\s*```[a-zA-Z]*\n(.*?)```', re.DOTALL)

matches = pattern.findall(content)

for filepath, filecontent in matches:
    full_path = os.path.join(output_dir, filepath.strip())
    # create directories
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, 'w') as out_f:
        out_f.write(filecontent)
    print(f"Created {full_path}")

