
from rembg import remove
from PIL import Image
import os
import shutil

input_dir = r"d:\project\AI Werewolf Game\static\images\role"

# 创建备份目录
backup_dir = os.path.join(input_dir, "backup")
if not os.path.exists(backup_dir):
    os.makedirs(backup_dir)

# 处理所有 webp 图片
for filename in os.listdir(input_dir):
    if filename.endswith(".webp") and not filename.startswith("."):
        input_path = os.path.join(input_dir, filename)
        backup_path = os.path.join(backup_dir, filename)
        
        # 备份原图片
        if not os.path.exists(backup_path):
            print(f"备份原图片: {filename}")
            shutil.copy2(input_path, backup_path)
        
        print(f"正在处理: {filename}")
        
        try:
            # 打开图片并去除背景
            input_img = Image.open(input_path)
            output_img = remove(input_img)
            
            # 保存处理后的图片
            output_img.save(input_path, "WEBP")
            print(f"✅ 处理完成: {filename}")
        except Exception as e:
            print(f"❌ 处理失败 {filename}: {e}")

print("\n🎉 所有图片处理完成！")
