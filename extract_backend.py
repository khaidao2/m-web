import os
import re

artifact_path = '/home/thekhai/.gemini/antigravity-cli/brain/1f988b6d-2990-4f94-825e-435b4a0aab54/pgnexus_files_ready.md'
output_dir = '/home/thekhai/code/tien-web/'

if os.path.exists(artifact_path):
    with open(artifact_path, 'r') as f:
        content = f.read()

    pattern = re.compile(r'##\s+`([^`]+)`\s*```[a-zA-Z]*\n(.*?)```', re.DOTALL)
    matches = pattern.findall(content)

    for filepath, filecontent in matches:
        full_path = os.path.join(output_dir, filepath.strip())
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, 'w') as out_f:
            out_f.write(filecontent)
        print(f"Created {full_path}")
else:
    print("Artifact not found, maybe I already created the backend files manually.")

