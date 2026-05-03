
from PIL import Image
import os

input_dir = r"d:\project\AI Werewolf Game\static\images\role"

# 检查第一张图片
for filename in os.listdir(input_dir):
    if filename.endswith(".webp") and not filename.startswith("."):
        input_path = os.path.join(input_dir, filename)
        print(f"检查图片: {filename}")
        img = Image.open(input_path)
        print(f"尺寸: {img.size}")
        print(f"模式: {img.mode}")
        
        # 获取几个点的颜色
        pixels = img.load()
        w, h = img.size
        print(f"左上角颜色: {pixels[0, 0]}")
        print(f"右上角颜色: {pixels[w-1, 0]}")
        print(f"左下角颜色: {pixels[0, h-1]}")
        print(f"右下角颜色: {pixels[w-1, h-1]}")
        print(f"中心颜色: {pixels[w//2, h//2]}")
        break
