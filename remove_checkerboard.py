import sys
import glob
from PIL import Image

def remove_bg(img_path, out_path):
    img = Image.open(img_path).convert("RGBA")
    pixels = img.load()
    width, height = img.size

    def is_bg(p):
        r, g, b = p[:3]
        # Check against common checkerboard colors (white and shades of light grey)
        for target in [255, 204, 153]:
            if abs(r - target) < 15 and abs(g - target) < 15 and abs(b - target) < 15:
                return True
        return False

    q = [(0, 0), (width-1, 0), (0, height-1), (width-1, height-1), (0, height//2), (width-1, height//2)]
    visited = set()
    
    # Flood fill
    for start in q:
        if start not in visited and is_bg(pixels[start[0], start[1]]):
            sq = [start]
            visited.add(start)
            head = 0
            while head < len(sq):
                x, y = sq[head]
                head += 1
                pixels[x, y] = (0, 0, 0, 0)
                
                for dx, dy in [(0, 1), (1, 0), (0, -1), (-1, 0)]:
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < width and 0 <= ny < height and (nx, ny) not in visited:
                        if is_bg(pixels[nx, ny]):
                            visited.add((nx, ny))
                            sq.append((nx, ny))
                            
    img.save(out_path)

target_paths = [
    "assets/CHARACTERS/0.1.Supreme_Keano/*.png",
    "assets/CHARACTERS/0.2.Hyper_Keano/*.png",
    "assets/fx/char_projectiles/*.png"
]

files = []
for p in target_paths:
    files.extend(glob.glob(p))

for f in files:
    try:
        remove_bg(f, f)
        print("Matted:", f)
    except Exception as e:
        print("Failed:", f, str(e))
