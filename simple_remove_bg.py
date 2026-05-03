
from PIL import Image
import os
import shutil

def is_whiteish(color, threshold=200):
    """判断颜色是否接近白色"""
    r, g, b = color
    return r > threshold and g > threshold and b > threshold

def remove_white_background(input_path, output_path):
    """去除白色背景"""
    img = Image.open(input_path).convert("RGBA")
    datas = list(img.getdata())
    
    new_data = []
    for item in datas:
        # item 是 (r, g, b, a)
        if len(item) == 4:
            r, g, b, a = item
        else:
            r, g, b = item
            a = 255
        
        # 如果是接近白色的像素，设为透明
        if is_whiteish((r, g, b)):
            new_data.append((r, g, b, 0))
        else:
            new_data.append((r, g, b, a))
    
    img.putdata(new_data)
    img.save(output_path, "WEBP")
    return True

def process_all_images():
    input_dir = r"d:\project\AI Werewolf Game\static\images\role"
    
    # 创建备份目录
    backup_dir = os.path.join(input_dir, "backup")
    if not os.path.exists(backup_dir):
        os.makedirs(backup_dir)
    
    print("Start processing images...\n")
    
    for filename in os.listdir(input_dir):
        if filename.endswith(".webp") and not filename.startswith("."):
            input_path = os.path.join(input_dir, filename)
            backup_path = os.path.join(backup_dir, filename)
            
            # 备份原图片
            if not os.path.exists(backup_path):
                print(f"Backup: {filename}")
                shutil.copy2(input_path, backup_path)
            
            print(f"Processing: {filename}")
            
            try:
                remove_white_background(input_path, input_path)
                print(f"[OK] Done: {filename}\n")
            except Exception as e:
                print(f"[FAIL] Failed {filename}: {e}\n")
    
    print("All images processed!")

if __name__ == "__main__":
    process_all_images()
