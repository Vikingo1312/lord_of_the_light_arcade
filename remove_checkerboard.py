import sys
import os
from PIL import Image

def is_checkerboard(r, g, b):
    # Check for pure white or near-white
    if r > 240 and g > 240 and b > 240:
        return True
    # Check for light grey checkerboard squares (typical photoshop #CCCCCC or #E6E6E6)
    if abs(r - g) < 10 and abs(g - b) < 10 and r > 180 and r < 240:
        return True
    return False

def remove_bg(img_path):
    try:
        img = Image.open(img_path).convert('RGBA')
        data = img.getdata()
        new_data = []
        for r, g, b, a in data:
            if is_checkerboard(r, g, b):
                new_data.append((r, g, b, 0))
            else:
                new_data.append((r, g, b, a))
        img.putdata(new_data)
        img.save(img_path)
        print(f"Cleaned: {img_path}")
    except Exception as e:
        print(f"Failed {img_path}: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        for p in sys.argv[1:]:
            remove_bg(p)
    else:
        print("Provide paths to images as arguments.")
