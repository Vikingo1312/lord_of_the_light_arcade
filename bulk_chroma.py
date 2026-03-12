import glob, os
from PIL import Image

files = glob.glob('/Users/vikingo40/.gemini/antigravity/scratch/keano_lord_of_the_light/assets/fx/char_projectiles/*.png')
for f in files:
    try:
        img = Image.open(f).convert('RGBA')
        data = img.getdata()
        new_data = []
        for r, g, b, a in data:
            if g > r * 1.1 and g > b * 1.1 and g > 40:
                new_data.append((r, g, b, 0))
            else:
                new_data.append((r, g, b, a))
        img.putdata(new_data)
        img.save(f)
        print("Cleaned:", os.path.basename(f))
    except Exception as e:
        print("Failed:", f, str(e))
