
from rembg import remove
from PIL import Image
import os

input_dir = r'd:\project\AI Werewolf Game\static\images\role'

for filename in os.listdir(input_dir):
    if filename.endswith('.webp'):
        input_path = os.path.join(input_dir, filename)
        output_path = os.path.join(input_dir, filename)
        
        print(f'Processing: {filename}')
        
        input_img = Image.open(input_path)
        output_img = remove(input_img)
        output_img.save(output_path, 'WEBP')
        print(f'Saved: {filename}')

print('Done! All images processed.')
