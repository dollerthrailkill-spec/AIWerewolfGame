
import requests
import os
from PIL import Image
import io

def remove_background(image_path, output_path):
    """使用 remove.bg API 去除背景"""
    api_key = "demo"  # 需要替换为实际的 API key
    url = "https://api.remove.bg/v1.0/removebg"
    
    with open(image_path, "rb") as image_file:
        files = {"image_file": image_file}
        data = {"size": "auto"}
        
        try:
            response = requests.post(url, files=files, data=data, auth=('X', api_key))
            if response.status_code == 200:
                img = Image.open(io.BytesIO(response.content))
                img.save(output_path, "WEBP")
                print(f"处理完成: {output_path}")
                return True
            else:
                print(f"API 错误: {response.status_code}")
                return False
        except Exception as e:
            print(f"错误: {e}")
            return False

def process_images():
    input_dir = r"d:\project\AI Werewolf Game\static\images\role"
    
    # 备份原图片
    backup_dir = os.path.join(input_dir, "backup")
    if not os.path.exists(backup_dir):
        os.makedirs(backup_dir)
    
    for filename in os.listdir(input_dir):
        if filename.endswith(".webp") and not filename.startswith("."):
            input_path = os.path.join(input_dir, filename)
            backup_path = os.path.join(backup_dir, filename)
            
            # 备份原图片
            if not os.path.exists(backup_path):
                import shutil
                shutil.copy2(input_path, backup_path)
            
            # 这里因为 API 需要真实的 key，我们用一个更简单的方案
            # 使用 CSS 遮罩来隐藏背景
            print(f"对于 {filename}，我们将使用 CSS 方案")
    
    print("\n由于 API 需要付费 key，我将实现一个 CSS 方案来优化显示效果")

if __name__ == "__main__":
    process_images()
