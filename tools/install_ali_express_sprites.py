#!/usr/bin/env python3
"""
Normalizes and installs all 29 Street Fighter 640x640 RGBA sprite poses
for 21.Ali_Abi (and 21.Ali_Express) with `_<pose>.png`, `ali_abi_<pose>.png`, and `ali_express_<pose>.png`,
plus the stage backgrounds `assets/STAGES/21_Ali_Abi_Bazar.png` & `21_Ali_Express_Bazar.png`
and projectiles `assets/fx/char_projectiles/proj_ali_abi.png` & `proj_ali_express.png` (256x256 RGBA, corner_alpha == 0).
"""
import os
import shutil
import sys
import numpy as np
from PIL import Image
from scipy.ndimage import label, binary_dilation, binary_closing, binary_fill_holes, gaussian_filter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import generate_sf_frames as sff

BRAIN_DIR = "/Users/vikingo40/.gemini/antigravity/brain/ea2a8f43-7ae0-4927-90e8-3c47cd5eb650"
CHAR_DIRS = [
    os.path.join(ROOT, "assets", "CHARACTERS", "21.Ali_Abi"),
    os.path.join(ROOT, "assets", "CHARACTERS", "21.Ali_Express"),
]
STAGE_OUTS = [
    os.path.join(ROOT, "assets", "STAGES", "21_Ali_Abi_Bazar.png"),
    os.path.join(ROOT, "assets", "STAGES", "21_Ali_Express_Bazar.png"),
]
PROJ_OUTS = [
    os.path.join(ROOT, "assets", "fx", "char_projectiles", "proj_ali_abi.png"),
    os.path.join(ROOT, "assets", "fx", "char_projectiles", "proj_ali_express.png"),
]


def remove_black_bg_clean(img_path, target_size=(640, 640), baseline_y=614, target_h=558, is_ko=False, is_airborne=False):
    """
    Removes solid pure-black (#000000) studio background connected to the borders
    without eating into dark sandals or black line-art outlines, and normalizes the character
    inside 640x640 RGBA with baseline y=614 and target_h=558.
    """
    im = Image.open(img_path).convert("RGBA")
    arr = np.array(im, dtype=np.float32)
    r, g, b, _ = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]

    max_c = np.maximum(np.maximum(r, g), b)
    min_c = np.minimum(np.minimum(r, g), b)
    sat = (max_c - min_c) / np.maximum(max_c, 1.0)
    lum = 0.299 * r + 0.587 * g + 0.114 * b

    # Pure black background is <= 7 in max channel (99th percentile on borders is 3.0).
    # Keeping threshold tight (max_c < 9.5) preserves dark sandals and black line-art outlines!
    bg_soft = (max_c < 9.5) & (lum < 8.0)
    labeled, _ = label(bg_soft)
    border_labels = set(
        np.concatenate([
            labeled[0, :], labeled[-1, :],
            labeled[:, 0], labeled[:, -1]
        ])
    )
    border_labels.discard(0)
    ext_bg = np.isin(labeled, list(border_labels))

    # Also catch large interior closed pure-black holes (e.g. between legs/arms) while preserving small dark details
    interior_cand = (~ext_bg) & (max_c < 6.0) & (lum < 5.0)
    int_lbl, num_int = label(interior_cand)
    interior_black = np.zeros_like(ext_bg)
    if num_int > 0:
        counts = np.bincount(int_lbl.ravel())
        counts[0] = 0
        # Only treat interior pure-black regions larger than 400 pixels as background holes
        large_holes = [i for i, cnt in enumerate(counts) if cnt > 400]
        if large_holes:
            interior_black = np.isin(int_lbl, large_holes)

    bg_mask = ext_bg | interior_black

    # Soft alpha transition on the 1px boundary right next to background
    boundary = binary_dilation(bg_mask, iterations=1) & (~bg_mask)
    alpha = np.where(bg_mask, 0.0, 255.0)

    edge_strength = np.clip(((max_c - 5.0) / 14.0) + (sat * 1.5), 0.0, 1.0)
    alpha = np.where(boundary, 255.0 * edge_strength, alpha)
    alpha = gaussian_filter(alpha, sigma=0.45)
    alpha[bg_mask] = 0.0

    arr[:, :, 3] = np.clip(alpha, 0.0, 255.0)
    rgba = arr.astype(np.uint8)

    # Keep only largest connected foreground component(s) to strip stray dust specs
    fg_mask = rgba[:, :, 3] > 20
    fg_lbl, num_fg = label(fg_mask)
    if num_fg > 1:
        counts = np.bincount(fg_lbl.ravel())
        counts[0] = 0
        main_area = counts.max()
        keep_labels = [i for i, cnt in enumerate(counts) if cnt >= main_area * 0.01]
        keep_mask = np.isin(fg_lbl, keep_labels)
        rgba[~keep_mask, 3] = 0

    ys, xs = np.where(rgba[:, :, 3] > 20)
    if len(xs) == 0:
        return Image.fromarray(rgba).resize(target_size, Image.Resampling.LANCZOS)

    x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())
    crop = Image.fromarray(rgba[y0:y1 + 1, x0:x1 + 1])
    cw, ch = crop.size
    tw, th = target_size

    if is_ko:
        max_w = int(tw * 0.92)
        max_h = int(th * 0.42)
        scale = min(max_w / max(1, cw), max_h / max(1, ch))
    elif is_airborne:
        max_w = int(tw * 0.86)
        max_h = int(th * 0.72)
        scale = min(max_w / max(1, cw), max_h / max(1, ch))
    else:
        max_w = int(tw * 0.86)
        scale = min(max_w / max(1, cw), target_h / max(1, ch))

    nw = max(1, int(round(cw * scale)))
    nh = max(1, int(round(ch * scale)))
    resized = crop.resize((nw, nh), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    paste_x = (tw - nw) // 2
    if is_airborne:
        paste_y = max(4, min(th - nh - 4, baseline_y - nh - 30))
    else:
        paste_y = max(4, min(th - nh - 4, baseline_y - nh))
    canvas.paste(resized, (paste_x, paste_y), resized)

    out_arr = sff.enforce_4px_border(np.array(canvas))
    return Image.fromarray(out_arr)


def clean_black_bg_projectile_256(img_path, out_paths, target_size=(256, 256)):
    """Converts projectile on black background to 256x256 RGBA PNG with corner_alpha == 0."""
    im = Image.open(img_path).convert("RGBA").resize(target_size, Image.Resampling.LANCZOS)
    arr = np.array(im, dtype=np.float32)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    max_c = np.maximum(np.maximum(r, g), b)
    lum = 0.299 * r + 0.587 * g + 0.114 * b

    energy = np.maximum(max_c, lum)
    alpha = np.clip((energy - 18.0) / 55.0, 0.0, 1.0) ** 1.15 * 255.0

    h, w = target_size[1], target_size[0]
    gy, gx = np.meshgrid(np.linspace(-1.0, 1.0, h), np.linspace(-1.0, 1.0, w), indexing='ij')
    rad = np.sqrt(gx**2 + gy**2)
    radial_fade = np.clip((0.94 - rad) / 0.18, 0.0, 1.0)
    alpha = alpha * radial_fade

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
    for out_path in out_paths:
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        Image.fromarray(out).save(out_path, "PNG")
        print(f"Saved 256x256 RGBA projectile: {out_path} (corner_alpha={out[0,0,3]})")


def save_pose_all(cdirs, pose_name, pil_img):
    arr = sff.enforce_4px_border(np.array(pil_img.convert("RGBA")))
    im = Image.fromarray(arr)
    for cdir in cdirs:
        os.makedirs(cdir, exist_ok=True)
        im.save(os.path.join(cdir, f"_{pose_name}.png"), "PNG")
        im.save(os.path.join(cdir, f"ali_abi_{pose_name}.png"), "PNG")
        im.save(os.path.join(cdir, f"ali_express_{pose_name}.png"), "PNG")


def main():
    for cdir in CHAR_DIRS:
        os.makedirs(cdir, exist_ok=True)

    base_cels = {
        "right": ("ali_cel_right.png", False, False),
        "punch": ("ali_cel_punch.png", False, False),
        "kick": ("ali_cel_kick.png", False, False),
        "special": ("ali_cel_special.png", False, False),
        "hurricane_kick": ("ali_cel_hurricane.png", False, True),
        "dragon_uppercut": ("ali_cel_flash_kick.png", False, False),
        "hook_punch": ("ali_cel_hook.png", False, False),
        "backfist": ("ali_cel_backfist.png", False, False),
        "hit": ("ali_cel_hit.png", False, False),
        "ko": ("ali_cel_ko.png", True, False),
        "win": ("ali_cel_win.png", False, False),
    }

    cleaned_imgs = {}
    for pose, (fname, is_ko, is_air) in base_cels.items():
        src = os.path.join(BRAIN_DIR, fname)
        if not os.path.exists(src):
            raise FileNotFoundError(f"Missing generated cel: {src}")
        im = remove_black_bg_clean(src, target_size=(640, 640), baseline_y=614, target_h=558, is_ko=is_ko, is_airborne=is_air)
        cleaned_imgs[pose] = im
        save_pose_all(CHAR_DIRS, pose, im)

    # _left.png and _front.png
    right_im = cleaned_imgs["right"]
    left_im = right_im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    save_pose_all(CHAR_DIRS, "left", left_im)
    save_pose_all(CHAR_DIRS, "front", right_im)

    # Derive the remaining poses via generate_sf_frames logic while preserving our custom cels!
    stance_arr = np.array(cleaned_imgs["right"])
    punch_arr = np.array(cleaned_imgs["punch"])
    kick_arr = np.array(cleaned_imgs["kick"])

    alpha = stance_arr[:, :, 3]
    ys, xs = np.where(alpha > 25)
    ref_bottom_y = int(ys.max()) if len(ys) > 0 else 614
    ref_torso_x = int(np.median(xs)) if len(xs) > 0 else 320

    derived = {
        "idle_2": sff.align_to_reference_foot_and_torso(sff.make_idle_2(stance_arr), ref_bottom_y, ref_torso_x, True),
        "walk_1": sff.align_to_reference_foot_and_torso(sff.make_walk_1(stance_arr), ref_bottom_y, ref_torso_x, True),
        "walk_2": sff.align_to_reference_foot_and_torso(sff.make_walk_2(stance_arr), ref_bottom_y, ref_torso_x, True),
        "crouch": sff.align_to_reference_foot_and_torso(sff.make_crouch(stance_arr), ref_bottom_y, ref_torso_x, True),
        "block": sff.align_to_reference_foot_and_torso(sff.make_block(stance_arr), ref_bottom_y, ref_torso_x, True),
        "jump": sff.make_jump(stance_arr),
        "windup_punch": sff.align_to_reference_foot_and_torso(sff.make_windup_punch(stance_arr), ref_bottom_y, ref_torso_x, True),
        "mid_punch": sff.make_mid_punch(punch_arr),
        "windup_kick": sff.align_to_reference_foot_and_torso(sff.make_windup_kick(stance_arr), ref_bottom_y, ref_torso_x, True),
        "mid_kick": sff.make_mid_kick(kick_arr),
        "spin_kick": sff.make_spin_kick(kick_arr),
        "uppercut": np.array(cleaned_imgs["dragon_uppercut"]),
        "low_kick": sff.make_low_kick(kick_arr),
        "axe_kick": sff.align_to_reference_foot_and_torso(sff.make_axe_kick(kick_arr), ref_bottom_y, ref_torso_x, True),
        "dive_kick": sff.make_dive_kick(kick_arr),
    }
    derived["walk"] = derived["walk_1"]

    for pose_name, arr in derived.items():
        save_pose_all(CHAR_DIRS, pose_name, Image.fromarray(arr))

    # Also save legacy aliases matching 20.Dom (_Run.png, _attack.png, _fall.png, _idle.png, _jump_kick.png)
    for cdir in CHAR_DIRS:
        Image.fromarray(derived["walk_1"]).save(os.path.join(cdir, "_Run.png"), "PNG")
        cleaned_imgs["punch"].save(os.path.join(cdir, "_attack.png"), "PNG")
        cleaned_imgs["ko"].save(os.path.join(cdir, "_fall.png"), "PNG")
        cleaned_imgs["right"].save(os.path.join(cdir, "_idle.png"), "PNG")
        Image.fromarray(derived["dive_kick"]).save(os.path.join(cdir, "_jump_kick.png"), "PNG")

    # Stage background (prefer stage_ali_abi.png if present, else stage_ali_express.png)
    stage_src = os.path.join(BRAIN_DIR, "stage_ali_abi.png")
    if not os.path.exists(stage_src):
        stage_src = os.path.join(BRAIN_DIR, "stage_ali_express.png")
    if os.path.exists(stage_src):
        for stage_out in STAGE_OUTS:
            os.makedirs(os.path.dirname(stage_out), exist_ok=True)
            shutil.copy2(stage_src, stage_out)
            print(f"Saved stage background: {stage_out}")

    # Projectile
    proj_src = os.path.join(BRAIN_DIR, "proj_ali_express.png")
    if os.path.exists(proj_src):
        clean_black_bg_projectile_256(proj_src, PROJ_OUTS, target_size=(256, 256))

    print("All 29 poses + ali_abi_<pose>.png & ali_express_<pose>.png copies installed in 21.Ali_Abi & 21.Ali_Express!")


if __name__ == "__main__":
    main()
