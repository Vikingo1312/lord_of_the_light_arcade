import sys
from PIL import Image

def is_bg(r, g, b):
    # Check for near-white or light-grey (checkerboard colors)
    if r > 180 and g > 180 and b > 180 and abs(r-g) < 15 and abs(g-b) < 15:
        return True
    return False

def remove_bg_flood(img_path):
    print(f"Processing {img_path}...")
    try:
        img = Image.open(img_path).convert('RGBA')
        pixels = img.load()
        width, height = img.size
        
        # We will do a BFS flood fill from edges
        visited = set()
        queue = []
        
        # Add all border pixels that match background color
        for x in range(width):
            if is_bg(*pixels[x, 0][:3]): queue.append((x, 0)); visited.add((x, 0))
            if is_bg(*pixels[x, height-1][:3]): queue.append((x, height-1)); visited.add((x, height-1))
        
        for y in range(height):
            if is_bg(*pixels[0, y][:3]) and (0, y) not in visited: queue.append((0, y)); visited.add((0, y))
            if is_bg(*pixels[width-1, y][:3]) and (width-1, y) not in visited: queue.append((width-1, y)); visited.add((width-1, y))

        while queue:
            x, y = queue.pop(0)
            # Make transparent
            r, g, b, _ = pixels[x, y]
            pixels[x, y] = (r, g, b, 0)
            
            # Check neighbors
            for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1), (-1, 1), (1, -1)]:
                nx, ny = x + dx, y + dy
                if 0 <= nx < width and 0 <= ny < height and (nx, ny) not in visited:
                    visited.add((nx, ny))
                    if is_bg(*pixels[nx, ny][:3]):
                        queue.append((nx, ny))
        
        img.save(img_path)
        print(f"Success: {img_path}")
    except Exception as e:
        print(f"Failed {img_path}: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        for p in sys.argv[1:]:
            remove_bg_flood(p)
    else:
        print("Provide paths to images as arguments.")
