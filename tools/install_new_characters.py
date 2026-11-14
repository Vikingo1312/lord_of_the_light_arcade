#!/usr/bin/env python3
import os
import shutil
import numpy as np
from PIL import Image
from scipy.ndimage import label, binary_dilation, gaussian_filter

BRAIN_DIR = "/Users/vikingo40/.gemini/antigravity/brain/59440b46-31e6-4264-bd09-b4ef779a3f83"
GAME_DIR = "/Users/vikingo40/.gemini/antigravity/scratch/keano_lord_of_the_light"

def remove_white_bg_clean(img_path, target_size=(640, 640), is_ko=False):
    """
    Removes solid/near-white studio background connected to the borders,
    de-fringes white halo edges, and centers/normalizes the character inside target_size
    with a strict 4px transparent border.
    """
    im = Image.open(img_path).convert("RGBA")
    arr = np.array(im, dtype=np.float32)
    r, g, b, _ = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]

    # Measure whiteness: high luminance and low saturation
    max_c = np.maximum(np.maximum(r, g), b)
    min_c = np.minimum(np.minimum(r, g), b)
    sat = (max_c - min_c) / np.maximum(max_c, 1.0)
    lum = 0.299 * r + 0.587 * g + 0.114 * b

    # Candidate background pixels: bright and low saturation
    bg_cand = (lum > 234.0) & (sat < 0.09)
    # Also include slightly softer near-white pixels for flood fill
    bg_soft = (lum > 218.0) & (sat < 0.14)

    # Flood-fill from all 4 image edges through bg_soft
    labeled, _ = label(bg_soft)
    border_labels = set(
        np.concatenate([
            labeled[0, :], labeled[-1, :],
            labeled[:, 0], labeled[:, -1]
        ])
    )
    border_labels.discard(0)
    ext_bg = np.isin(labeled, list(border_labels))

    # Also catch interior closed white holes (e.g. between arms/legs) that are purely white
    interior_white = (lum > 244.0) & (sat < 0.05)
    bg_mask = ext_bg | interior_white

    # Soft alpha transition on the 2px boundary right next to background
    boundary = binary_dilation(bg_mask, iterations=2) & (~bg_mask)
    alpha = np.where(bg_mask, 0.0, 255.0)

    # On the boundary, ramp alpha smoothly based on darkness/saturation and decontaminate white spill
    edge_strength = np.clip(((248.0 - lum) / 45.0) + (sat * 2.8), 0.0, 1.0)
    alpha = np.where(boundary, 255.0 * edge_strength, alpha)
    alpha = gaussian_filter(alpha, sigma=0.55)
    alpha[bg_mask] = 0.0

    # Color decontamination on semi-transparent edge pixels (pull away from 255 white spill)
    semi = (alpha > 5.0) & (alpha < 245.0)
    if np.any(semi):
        a_norm = np.clip(alpha[semi] / 255.0, 0.15, 1.0)
        for c in range(3):
            chan = arr[:, :, c][semi]
            arr[:, :, c][semi] = np.clip((chan - (1.0 - a_norm) * 250.0) / a_norm, 0.0, 255.0)

    arr[:, :, 3] = np.clip(alpha, 0.0, 255.0)
    rgba = arr.astype(np.uint8)

    # Find character bounding box
    ys, xs = np.where(rgba[:, :, 3] > 28)
    if len(xs) == 0:
        return Image.fromarray(rgba).resize(target_size, Image.Resampling.LANCZOS)

    x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())
    crop = Image.fromarray(rgba[y0:y1+1, x0:x1+1])
    cw, ch = crop.size
    tw, th = target_size

    # Standardize height/width in canvas so feet sit consistently near bottom (y = th - 26)
    if is_ko:
        max_w = int(tw * 0.86)
        max_h = int(th * 0.62)
    else:
        max_w = int(tw * 0.84)
        max_h = int(th * 0.86)

    scale = min(max_w / max(1, cw), max_h / max(1, ch))
    nw = max(1, int(round(cw * scale)))
    nh = max(1, int(round(ch * scale)))
    resized = crop.resize((nw, nh), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    paste_x = (tw - nw) // 2
    if is_ko:
        paste_y = th - nh - 28
    else:
        paste_y = th - nh - 24
    canvas.paste(resized, (paste_x, paste_y), resized)

    out_arr = np.array(canvas)
    out_arr[:4, :, 3] = 0
    out_arr[-4:, :, 3] = 0
    out_arr[:, :4, 3] = 0
    out_arr[:, -4:, 3] = 0
    return Image.fromarray(out_arr)

def make_portrait_from_stance(stance_img, target_size=(640, 640)):
    """Creates a clean upper-body portrait (`_front.png`) for the Character Select grid & HUD."""
    arr = np.array(stance_img)
    ys, xs = np.where(arr[:, :, 3] > 28)
    if len(xs) == 0:
        return stance_img
    x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())
    bh = y1 - y0
    # Upper 62% of body (head + shoulders + chest)
    crop_y1 = min(arr.shape[0], y0 + int(bh * 0.62))
    sub = arr[y0:crop_y1, x0:x1+1]
    ys2, xs2 = np.where(sub[:, :, 3] > 28)
    if len(xs2) > 0:
        sub = sub[int(ys2.min()):int(ys2.max())+1, int(xs2.min()):int(xs2.max())+1]

    crop = Image.fromarray(sub)
    cw, ch = crop.size
    tw, th = target_size
    scale = min((tw * 0.86) / max(1, cw), (th * 0.88) / max(1, ch))
    nw, nh = max(1, int(round(cw * scale))), max(1, int(round(ch * scale)))
    resized = crop.resize((nw, nh), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    canvas.paste(resized, ((tw - nw) // 2, th - nh - 8), resized)
    out_arr = np.array(canvas)
    out_arr[:4, :, 3] = 0
    out_arr[-4:, :, 3] = 0
    out_arr[:, :4, 3] = 0
    out_arr[:, -4:, 3] = 0
    return Image.fromarray(out_arr)

def clean_black_bg_projectile(img_path, out_path, target_size=(640, 640)):
    """Removes solid black background from glowing projectile asset with smooth radial alpha matting."""
    im = Image.open(img_path).convert("RGBA").resize(target_size, Image.Resampling.LANCZOS)
    arr = np.array(im, dtype=np.float32)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    max_c = np.maximum(np.maximum(r, g), b)
    lum = 0.299 * r + 0.587 * g + 0.114 * b

    # Compute alpha from luminance + max channel so glowing edges are smooth and additive-ready
    energy = np.maximum(max_c, lum)
    alpha = np.clip((energy - 18.0) / 55.0, 0.0, 1.0) ** 1.15 * 255.0

    # Radial vignette near the outer border so zero rectangular box edges ever appear
    h, w = target_size[1], target_size[0]
    gy, gx = np.meshgrid(np.linspace(-1.0, 1.0, h), np.linspace(-1.0, 1.0, w), indexing='ij')
    rad = np.sqrt(gx**2 + gy**2)
    radial_fade = np.clip((0.94 - rad) / 0.18, 0.0, 1.0)
    alpha = alpha * radial_fade

    # De-black semi-transparent glow pixels so they stay vibrant
    valid = alpha > 4.0
    a_norm = np.clip(alpha / 255.0, 0.12, 1.0)
    for c in range(3):
        arr[:, :, c] = np.where(valid, np.clip(arr[:, :, c] / (a_norm ** 0.45), 0.0, 255.0), 0.0)

    arr[:, :, 3] = np.clip(alpha, 0.0, 255.0)
    out = arr.astype(np.uint8)
    out[:4, :, 3] = 0
    out[-4:, :, 3] = 0
    out[:, :4, 3] = 0
    out[:, -4:, 3] = 0
    Image.fromarray(out).save(out_path, "PNG")
    print(f"✅ Saved projectile: {out_path}")

def install_character(folder_name, prefix, mapping):
    cdir = os.path.join(GAME_DIR, "assets/CHARACTERS", folder_name)
    os.makedirs(cdir, exist_ok=True)

    for pose, src_file in mapping.items():
        src_path = os.path.join(BRAIN_DIR, src_file)
        if not os.path.exists(src_path):
            raise FileNotFoundError(f"Missing source image: {src_path}")
        cleaned = remove_white_bg_clean(src_path, target_size=(640, 640), is_ko=(pose == "ko"))
        out_main = os.path.join(cdir, f"_{pose}.png")
        out_pfx = os.path.join(cdir, f"{prefix}_{pose}.png")
        cleaned.save(out_main, "PNG")
        cleaned.save(out_pfx, "PNG")

    # Generate _left.png (flipped _right.png) and _front.png (portrait)
    right_img = Image.open(os.path.join(cdir, "_right.png")).convert("RGBA")
    left_img = right_img.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    left_img.save(os.path.join(cdir, "_left.png"), "PNG")
    left_img.save(os.path.join(cdir, f"{prefix}_left.png"), "PNG")

    front_img = make_portrait_from_stance(right_img, target_size=(640, 640))
    front_img.save(os.path.join(cdir, "_front.png"), "PNG")
    front_img.save(os.path.join(cdir, f"{prefix}_front.png"), "PNG")
    print(f"✅ Installed base sprites for {folder_name} ({prefix})")

def main():
    # 1. Install 17.Emely (🌸 Emy 🌸)
    emely_map = {
        "right": "emely_right_stance_1794621399875.jpg",
        "punch": "emely_punch_pose_1794621480107.jpg",
        "kick": "emely_kick_pose_1794621494714.jpg",
        "special": "emely_special_pose_1794621503912.jpg",
        "hit": "emely_hit_pose_1794621533523.jpg",
        "ko": "emely_ko_pose_1794621544530.jpg",
        "win": "emely_win_pose_1794621553961.jpg",
    }
    install_character("17.Emely", "emely", emely_map)

    # 2. Install 18.Cayle (Cayle - 12yo sister with Jayden's facial features & curly hair, clean 2-arm, 2-leg sprites!)
    cayle_map = {
        "right": "cayle_jaydenface_right_1794654951994.jpg",
        "punch": "cayle_jf_punch_1794654986025.jpg",
        "kick": "cayle_jf_kick_v2_1794655035391.jpg",
        "special": "cayle_jf_special_1794655005324.jpg",
        "hit": "cayle_jf_hit_1794655045180.jpg",
        "ko": "cayle_jf_ko_1794655053936.jpg",
        "win": "cayle_jf_win_1794655062990.jpg",
    }
    install_character("18.Cayle", "cayle", cayle_map)

    # 3. Backup and install new 12.1.Jay_X (keeping 12.JJ_Dark untouched as Jan requested!)
    jayx_src = os.path.join(GAME_DIR, "assets/CHARACTERS/12.1.Jay_X")
    jayx_bak = os.path.join(GAME_DIR, "assets/CHARACTERS_BACKUP_BEFORE_CLEANUP/12.1.Jay_X_original")
    if os.path.exists(jayx_src) and not os.path.exists(jayx_bak):
        os.makedirs(os.path.dirname(jayx_bak), exist_ok=True)
        shutil.copytree(jayx_src, jayx_bak)

    jayx_map = {
        "right": "jay_x_older_jj_right_1794656132089.jpg",
        "punch": "jay_x_ojj_punch_1794656157239.jpg",
        "kick": "jay_x_ojj_kick_1794656166116.jpg",
        "special": "jay_x_ojj_special_v2_1794656231640.jpg",
        "hit": "jay_x_ojj_hit_1794656242127.jpg",
        "ko": "jay_x_ojj_ko_1794656251128.jpg",
        "win": "jay_x_ojj_win_1794656259965.jpg",
    }
    install_character("12.1.Jay_X", "jay_x", jayx_map)

    # 4. Clean and install projectiles (proj_emely.png & proj_cayle.png)
    proj_dir = os.path.join(GAME_DIR, "assets/fx/char_projectiles")
    os.makedirs(proj_dir, exist_ok=True)
    clean_black_bg_projectile(
        os.path.join(BRAIN_DIR, "proj_emely_flower_1794621423876.jpg"),
        os.path.join(proj_dir, "proj_emely.png")
    )
    clean_black_bg_projectile(
        os.path.join(BRAIN_DIR, "proj_kayleigh_iceball_1794621434295.jpg"),
        os.path.join(proj_dir, "proj_cayle.png")
    )

    # 5. Build visual verification sheet on checkerboard background
    cols, rows = 8, 3
    cell = 200
    sheet = Image.new("RGBA", (cols * cell, rows * cell), (28, 30, 42, 255))
    # Draw subtle checkerboard
    s_arr = np.array(sheet)
    for y in range(rows * cell):
        for x in range(cols * cell):
            if ((x // 20) + (y // 20)) % 2 == 1:
                s_arr[y, x, :3] = [44, 48, 64]
    sheet = Image.fromarray(s_arr)

    char_rows = [
        ("17.Emely", "proj_emely.png"),
        ("18.Cayle", "proj_cayle.png"),
        ("12.1.Jay_X", "proj_jay_x.png"),
    ]
    poses = ["_right.png", "_punch.png", "_kick.png", "_special.png", "_hit.png", "_ko.png", "_win.png"]
    for r_idx, (cfolder, pfile) in enumerate(char_rows):
        for c_idx, p_name in enumerate(poses):
            p_path = os.path.join(GAME_DIR, "assets/CHARACTERS", cfolder, p_name)
            im = Image.open(p_path).convert("RGBA").resize((cell - 12, cell - 12), Image.Resampling.LANCZOS)
            sheet.paste(im, (c_idx * cell + 6, r_idx * cell + 6), im)
        proj_p = os.path.join(proj_dir, pfile)
        if os.path.exists(proj_p):
            pim = Image.open(proj_p).convert("RGBA").resize((cell - 20, cell - 20), Image.Resampling.LANCZOS)
            sheet.paste(pim, (7 * cell + 10, r_idx * cell + 10), pim)

    sheet_path = os.path.join(BRAIN_DIR, "new_characters_verification.png")
    sheet.save(sheet_path, "PNG")
    print(f"✅ Saved verification sheet: {sheet_path}")

if __name__ == "__main__":
    main()
