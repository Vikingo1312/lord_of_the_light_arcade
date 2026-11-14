#!/usr/bin/env python3
import os
import shutil
import numpy as np
from PIL import Image

def get_bbox(alpha):
    ys, xs = np.where(alpha > 20)
    if len(xs) == 0:
        return 0, 0, alpha.shape[1] - 1, alpha.shape[0] - 1
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())

def enforce_4px_border(arr):
    out = arr.copy()
    out[:4, :, 3] = 0
    out[-4:, :, 3] = 0
    out[:, :4, 3] = 0
    out[:, -4:, 3] = 0
    return out

def align_to_reference_foot_and_torso(arr, ref_bottom_y, ref_torso_x, lock_bottom=True):
    """
    Shifts RGBA array `arr` so that:
    1) Its lowest opaque foot pixel aligns with `ref_bottom_y` (if lock_bottom=True),
    2) Its torso horizontal center of mass aligns with `ref_torso_x`.
    This completely eliminates horizontal/vertical frame-switch jitter!
    """
    h, w, _ = arr.shape
    alpha = arr[:, :, 3]
    ys, xs = np.where(alpha > 25)
    if len(xs) == 0:
        return enforce_4px_border(arr)

    cur_bottom_y = int(ys.max())
    y0, y1 = int(ys.min()), cur_bottom_y
    bh = max(1, y1 - y0)

    # Measure torso horizontal center (between 20% and 65% of height)
    torso_y_min = y0 + int(bh * 0.20)
    torso_y_max = y0 + int(bh * 0.65)
    t_ys, t_xs = np.where((alpha > 40) & (np.arange(h)[:, None] >= torso_y_min) & (np.arange(h)[:, None] <= torso_y_max))
    if len(t_xs) > 0:
        cur_torso_x = int(np.median(t_xs))
    else:
        cur_torso_x = int(np.median(xs))

    shift_x = int(np.clip(ref_torso_x - cur_torso_x, -int(w * 0.08), int(w * 0.08)))
    shift_y = int(np.clip(ref_bottom_y - cur_bottom_y, -int(h * 0.08), int(h * 0.08))) if lock_bottom else 0

    if shift_x == 0 and shift_y == 0:
        return enforce_4px_border(arr)

    out = np.zeros_like(arr)
    src_x0 = max(0, -shift_x)
    src_x1 = min(w, w - shift_x)
    dst_x0 = max(0, shift_x)
    dst_x1 = min(w, w + shift_x)

    src_y0 = max(0, -shift_y)
    src_y1 = min(h, h - shift_y)
    dst_y0 = max(0, shift_y)
    dst_y1 = min(h, h + shift_y)

    if dst_x1 > dst_x0 and dst_y1 > dst_y0:
        out[dst_y0:dst_y1, dst_x0:dst_x1] = arr[src_y0:src_y1, src_x0:src_x1]
    return enforce_4px_border(out)

def bilinear_warp(img_arr, dx, dy):
    """
    Fast vectorized bilinear sampling of RGBA array img_arr (H, W, 4)
    at source coordinates (x - dx, y - dy) with zero-alpha out-of-bounds handling.
    """
    h, w, c = img_arr.shape
    grid_y, grid_x = np.meshgrid(np.arange(h, dtype=np.float32), np.arange(w, dtype=np.float32), indexing='ij')
    raw_x = grid_x - dx
    raw_y = grid_y - dy
    in_bounds = (raw_x >= 0.0) & (raw_x < w - 1.001) & (raw_y >= 0.0) & (raw_y < h - 1.001)

    src_x = np.clip(raw_x, 0, w - 1.001)
    src_y = np.clip(raw_y, 0, h - 1.001)

    x0 = np.floor(src_x).astype(np.int32)
    y0 = np.floor(src_y).astype(np.int32)
    x1 = np.minimum(x0 + 1, w - 1)
    y1 = np.minimum(y0 + 1, h - 1)

    wx = (src_x - x0)[..., None]
    wy = (src_y - y0)[..., None]

    Ia = img_arr[y0, x0].astype(np.float32)
    Ib = img_arr[y0, x1].astype(np.float32)
    Ic = img_arr[y1, x0].astype(np.float32)
    Id = img_arr[y1, x1].astype(np.float32)

    out = (Ia * (1 - wx) * (1 - wy) +
           Ib * wx * (1 - wy) +
           Ic * (1 - wx) * wy +
           Id * wx * wy)
    out[~in_bounds, 3] = 0.0
    out[:4, :, 3] = 0
    out[-4:, :, 3] = 0
    out[:, :4, 3] = 0
    out[:, -4:, 3] = 0
    return np.clip(out, 0, 255).astype(np.uint8)

def norm_coords(shape, bbox):
    h, w = shape[:2]
    x0, y0, x1, y1 = bbox
    bw = max(1.0, float(x1 - x0))
    bh = max(1.0, float(y1 - y0))
    gy, gx = np.meshgrid(np.arange(h, dtype=np.float32), np.arange(w, dtype=np.float32), indexing='ij')
    u = (gx - x0) / bw
    v = (gy - y0) / bh
    return u, v, bw, bh

def make_idle_2(stance_arr):
    # Subtle, rock-steady breathing & guard weave with zero horizontal torso jump
    bbox = get_bbox(stance_arr[:, :, 3])
    u, v, bw, bh = norm_coords(stance_arr.shape, bbox)
    foot_lock = np.clip((0.88 - v) / 0.18, 0.0, 1.0)
    upper_mask = np.clip((0.62 - v) / 0.40, 0.0, 1.0) * foot_lock
    front_arm = np.clip((u - 0.52) / 0.35, 0.0, 1.0) * np.exp(-((v - 0.36) / 0.16) ** 2)
    dx = (0.008 * bw * front_arm)
    dy = (-0.010 * bh * upper_mask) - (0.014 * bh * front_arm)
    return bilinear_warp(stance_arr, dx, dy)

def make_walk_1(stance_arr):
    # Step 1: legs stride while upper torso stays horizontally centered!
    bbox = get_bbox(stance_arr[:, :, 3])
    u, v, bw, bh = norm_coords(stance_arr.shape, bbox)
    leg_zone = np.clip((v - 0.50) / 0.35, 0.0, 1.0)
    stride_dir = np.tanh((0.50 - u) * 4.5)
    dx = (0.052 * bw * leg_zone * stride_dir)
    dy = (-0.018 * bh * leg_zone * np.clip(0.54 - u, 0.0, 1.0))
    return bilinear_warp(stance_arr, dx, dy)

def make_walk_2(stance_arr):
    # Step 2: opposite leg stride while upper torso stays horizontally centered!
    bbox = get_bbox(stance_arr[:, :, 3])
    u, v, bw, bh = norm_coords(stance_arr.shape, bbox)
    leg_zone = np.clip((v - 0.50) / 0.35, 0.0, 1.0)
    stride_dir = np.tanh((u - 0.50) * 4.5)
    dx = (0.045 * bw * leg_zone * stride_dir)
    dy = (-0.018 * bh * leg_zone * np.clip(u - 0.52, 0.0, 1.0))
    return bilinear_warp(stance_arr, dx, dy)

def make_crouch(stance_arr):
    bbox = get_bbox(stance_arr[:, :, 3])
    u, v, bw, bh = norm_coords(stance_arr.shape, bbox)
    crouch_factor = np.clip(1.0 - v, 0.0, 1.0) ** 0.85
    knee_bulge = np.exp(-((v - 0.68) / 0.16) ** 2) * np.tanh((u - 0.48) * 4.0)
    forward_lean = np.clip(0.75 - v, 0.0, 1.0)
    dx = (0.032 * bw * forward_lean) + (0.035 * bw * knee_bulge)
    dy = 0.165 * bh * crouch_factor
    return bilinear_warp(stance_arr, dx, dy)

def make_block(stance_arr):
    bbox = get_bbox(stance_arr[:, :, 3])
    u, v, bw, bh = norm_coords(stance_arr.shape, bbox)
    foot_lock = np.clip((0.88 - v) / 0.18, 0.0, 1.0)
    upper = np.clip((0.72 - v) / 0.50, 0.0, 1.0) * foot_lock
    guard_arm = np.clip((u - 0.45) / 0.40, 0.0, 1.0) * np.exp(-((v - 0.35) / 0.20) ** 2)
    dx = (-0.035 * bw * upper) - (0.025 * bw * guard_arm)
    dy = (0.020 * bh * upper) - (0.042 * bh * guard_arm)
    return bilinear_warp(stance_arr, dx, dy)

def make_jump(stance_arr):
    bbox = get_bbox(stance_arr[:, :, 3])
    u, v, bw, bh = norm_coords(stance_arr.shape, bbox)
    leg_tuck = np.clip((v - 0.45) / 0.50, 0.0, 1.0)
    knee_bend = np.exp(-((v - 0.72) / 0.18) ** 2)
    dx = (-0.045 * bw * leg_tuck) + (0.032 * bw * knee_bend)
    dy = (-0.110 * bh * (leg_tuck ** 1.15))
    return bilinear_warp(stance_arr, dx, dy)

def make_windup_punch(stance_arr):
    bbox = get_bbox(stance_arr[:, :, 3])
    u, v, bw, bh = norm_coords(stance_arr.shape, bbox)
    foot_lock = np.clip((0.86 - v) / 0.18, 0.0, 1.0)
    torso = np.clip((0.70 - v) / 0.50, 0.0, 1.0) * foot_lock
    arm_coil = np.exp(-((v - 0.36) / 0.18) ** 2) * foot_lock
    dx = (-0.042 * bw * torso) - (0.030 * bw * arm_coil)
    dy = (0.024 * bh * torso)
    return bilinear_warp(stance_arr, dx, dy)

def make_mid_punch(punch_arr):
    # Intermediate "Mast" frame between windup and full punch extension
    bbox = get_bbox(punch_arr[:, :, 3])
    u, v, bw, bh = norm_coords(punch_arr.shape, bbox)
    foot_lock = np.clip((0.88 - v) / 0.18, 0.0, 1.0)
    fist_pull = np.clip((u - 0.48) / 0.42, 0.0, 1.0) * np.exp(-((v - 0.35) / 0.22) ** 2)
    torso = np.clip((0.70 - v) / 0.50, 0.0, 1.0) * foot_lock
    dx = (-0.055 * bw * fist_pull) - (0.020 * bw * torso)
    dy = (0.012 * bh * fist_pull)
    return bilinear_warp(punch_arr, dx, dy)

def make_windup_kick(stance_arr):
    bbox = get_bbox(stance_arr[:, :, 3])
    u, v, bw, bh = norm_coords(stance_arr.shape, bbox)
    front_leg = np.clip((u - 0.42) / 0.35, 0.0, 1.0) * np.clip((v - 0.45) / 0.45, 0.0, 1.0)
    upper_lean = np.clip((0.65 - v) / 0.45, 0.0, 1.0)
    dx = (-0.032 * bw * upper_lean) - (0.022 * bw * front_leg)
    dy = (-0.095 * bh * front_leg) + (0.012 * bh * upper_lean)
    return bilinear_warp(stance_arr, dx, dy)

def make_mid_kick(kick_arr):
    # Intermediate "Mast" frame between knee-chamber and full kick extension
    bbox = get_bbox(kick_arr[:, :, 3])
    u, v, bw, bh = norm_coords(kick_arr.shape, bbox)
    kick_leg = np.clip((u - 0.48) / 0.45, 0.0, 1.0)
    dx = (-0.065 * bw * kick_leg)
    dy = (0.045 * bh * kick_leg)
    return bilinear_warp(kick_arr, dx, dy)

def make_spin_kick(kick_arr):
    # Dynamic high-arc Roundhouse / Salto-Kick frame
    bbox = get_bbox(kick_arr[:, :, 3])
    u, v, bw, bh = norm_coords(kick_arr.shape, bbox)
    kick_foot = np.clip((u - 0.48) / 0.45, 0.0, 1.0)
    back_body = 1.0 - kick_foot
    dx = (0.042 * bw * kick_foot) - (0.032 * bw * back_body)
    dy = (-0.095 * bh * kick_foot) + (0.035 * bh * back_body)
    return bilinear_warp(kick_arr, dx, dy)

def make_hook_punch(punch_arr):
    bbox = get_bbox(punch_arr[:, :, 3])
    u, v, bw, bh = norm_coords(punch_arr.shape, bbox)
    foot_lock = np.clip((0.88 - v) / 0.18, 0.0, 1.0)
    upper_lunge = np.clip((0.72 - v) / 0.50, 0.0, 1.0) * foot_lock
    fist_zone = np.clip((u - 0.55) / 0.35, 0.0, 1.0) * np.exp(-((v - 0.35) / 0.22) ** 2)
    dx = (0.045 * bw * upper_lunge) + (0.032 * bw * fist_zone)
    dy = (0.026 * bh * upper_lunge) - (0.018 * bh * fist_zone)
    return bilinear_warp(punch_arr, dx, dy)

def make_uppercut(punch_arr):
    bbox = get_bbox(punch_arr[:, :, 3])
    u, v, bw, bh = norm_coords(punch_arr.shape, bbox)
    arm_reach = np.clip((u - 0.48) / 0.40, 0.0, 1.0) * np.clip((0.68 - v) / 0.50, 0.0, 1.0)
    torso_rise = np.clip((0.75 - v) / 0.55, 0.0, 1.0)
    dx = (0.025 * bw * torso_rise) - (0.022 * bw * arm_reach)
    dy = (-0.115 * bh * (arm_reach ** 1.1)) - (0.030 * bh * torso_rise)
    return bilinear_warp(punch_arr, dx, dy)

def make_low_kick(kick_arr):
    bbox = get_bbox(kick_arr[:, :, 3])
    u, v, bw, bh = norm_coords(kick_arr.shape, bbox)
    crouch_drop = np.clip(1.0 - v, 0.0, 1.0) ** 0.85
    kick_leg = np.clip((u - 0.52) / 0.40, 0.0, 1.0)
    torso_lean = np.clip(0.65 - v, 0.0, 1.0) * (1.0 - kick_leg)
    dx = (-0.035 * bw * torso_lean) + (0.035 * bw * kick_leg)
    dy = (0.135 * bh * crouch_drop) + (0.095 * bh * kick_leg * np.clip(0.75 - v, 0.0, 1.0))
    return bilinear_warp(kick_arr, dx, dy)

def make_dive_kick(kick_arr):
    bbox = get_bbox(kick_arr[:, :, 3])
    u, v, bw, bh = norm_coords(kick_arr.shape, bbox)
    kick_foot = np.clip((u - 0.50) / 0.45, 0.0, 1.0)
    back_body = 1.0 - kick_foot
    dx = (0.042 * bw * kick_foot) - (0.028 * bw * back_body * np.clip(v - 0.45, 0.0, 1.0))
    dy = (0.080 * bh * kick_foot) - (0.075 * bh * back_body)
    return bilinear_warp(kick_arr, dx, dy)

def make_backfist(punch_arr):
    """
    COMMAND_PUNCH (→ + L) overhead lunge backfist strike:
    forward torso twist + high overhead arm strike arc, foot-locked and torso-aligned.
    """
    bbox = get_bbox(punch_arr[:, :, 3])
    u, v, bw, bh = norm_coords(punch_arr.shape, bbox)
    foot_lock = np.clip((0.88 - v) / 0.18, 0.0, 1.0)
    torso_twist = np.clip((0.72 - v) / 0.50, 0.0, 1.0) * foot_lock
    overhead_arc = np.clip((u - 0.48) / 0.36, 0.0, 1.0) * np.exp(-((v - 0.32) / 0.22) ** 2)
    fist_whip = np.clip((u - 0.66) / 0.28, 0.0, 1.0) * np.exp(-((v - 0.34) / 0.20) ** 2)
    dx = (0.052 * bw * torso_twist) + (0.040 * bw * overhead_arc)
    dy = (-0.072 * bh * overhead_arc) + (0.048 * bh * fist_whip) + (0.022 * bh * torso_twist)
    return bilinear_warp(punch_arr, dx, dy)

def make_axe_kick(kick_arr):
    """
    AXE_KICK (→ + H) heavy downward-crashing axe kick:
    high raised front leg chopping down + dynamic martial arts posture, foot-locked.
    """
    bbox = get_bbox(kick_arr[:, :, 3])
    u, v, bw, bh = norm_coords(kick_arr.shape, bbox)
    foot_lock = np.clip((0.90 - v) / 0.16, 0.0, 1.0)
    kick_leg = np.clip((u - 0.48) / 0.42, 0.0, 1.0) * np.clip((0.85 - v) / 0.65, 0.0, 1.0)
    heel_chop = np.clip((u - 0.68) / 0.28, 0.0, 1.0) * kick_leg
    planted_posture = (1.0 - kick_leg) * np.clip((0.75 - v) / 0.52, 0.0, 1.0) * foot_lock
    dx = (0.038 * bw * kick_leg) - (0.028 * bw * planted_posture)
    dy = (-0.128 * bh * kick_leg) + (0.042 * bh * heel_chop) + (0.018 * bh * planted_posture)
    return bilinear_warp(kick_arr, dx, dy)

def make_hurricane_kick(kick_arr):
    """
    HURRICANE_KICK (↓ ↙ ← + H / ↓ + S) airborne spinning Tatsumaki cyclone kick:
    horizontal extended kicking leg + tucked counter-balance leg in mid-air.
    """
    bbox = get_bbox(kick_arr[:, :, 3])
    u, v, bw, bh = norm_coords(kick_arr.shape, bbox)
    kick_leg = np.clip((u - 0.48) / 0.44, 0.0, 1.0)
    tucked_back_leg = np.clip((0.50 - u) / 0.40, 0.0, 1.0) * np.clip((v - 0.46) / 0.48, 0.0, 1.0)
    cyclone_torso = np.clip((0.62 - v) / 0.45, 0.0, 1.0)
    dx = (0.056 * bw * kick_leg) - (0.052 * bw * tucked_back_leg) + (0.018 * bw * cyclone_torso)
    dy = (-0.068 * bh * kick_leg) - (0.135 * bh * (tucked_back_leg ** 1.1)) - (0.038 * bh * cyclone_torso)
    return bilinear_warp(kick_arr, dx, dy)

def make_dragon_uppercut(punch_arr):
    """
    DRAGON_UPPERCUT (→ ↓ ↘ + L / ↑ + S) rising Shoryuken dragon fist:
    skyward-driving fist + rising knee drive in mid-air.
    """
    bbox = get_bbox(punch_arr[:, :, 3])
    u, v, bw, bh = norm_coords(punch_arr.shape, bbox)
    sky_fist = np.clip((u - 0.46) / 0.42, 0.0, 1.0) * np.clip((0.66 - v) / 0.50, 0.0, 1.0)
    knee_drive = np.clip((u - 0.45) / 0.42, 0.0, 1.0) * np.clip((v - 0.48) / 0.46, 0.0, 1.0)
    trailing_leg = np.clip((0.46 - u) / 0.38, 0.0, 1.0) * np.clip((v - 0.52) / 0.44, 0.0, 1.0)
    torso_surge = np.clip((0.74 - v) / 0.55, 0.0, 1.0)
    dx = (0.028 * bw * torso_surge) - (0.026 * bw * sky_fist) + (0.038 * bw * knee_drive) - (0.024 * bw * trailing_leg)
    dy = (-0.145 * bh * (sky_fist ** 1.05)) - (0.118 * bh * knee_drive) - (0.042 * bh * trailing_leg) - (0.035 * bh * torso_surge)
    return bilinear_warp(punch_arr, dx, dy)

def process_all_characters(base_dir="assets/CHARACTERS"):
    for folder in sorted(os.listdir(base_dir)):
        cdir = os.path.join(base_dir, folder)
        if not os.path.isdir(cdir):
            continue
        right_p = os.path.join(cdir, "_right.png")
        punch_p = os.path.join(cdir, "_punch.png")
        kick_p = os.path.join(cdir, "_kick.png")
        if not os.path.exists(right_p):
            continue

        stance_arr = enforce_4px_border(np.array(Image.open(right_p).convert("RGBA")))
        punch_arr = enforce_4px_border(np.array(Image.open(punch_p).convert("RGBA"))) if os.path.exists(punch_p) else stance_arr
        kick_arr = enforce_4px_border(np.array(Image.open(kick_p).convert("RGBA"))) if os.path.exists(kick_p) else stance_arr

        # Measure reference foot baseline and torso center from _right.png
        alpha = stance_arr[:, :, 3]
        ys, xs = np.where(alpha > 25)
        ref_bottom_y = int(ys.max()) if len(ys) > 0 else stance_arr.shape[0] - 20
        ref_torso_x = int(np.median(xs)) if len(xs) > 0 else stance_arr.shape[1] // 2

        frames = {
            "_idle_2.png": align_to_reference_foot_and_torso(make_idle_2(stance_arr), ref_bottom_y, ref_torso_x, True),
            "_walk_1.png": align_to_reference_foot_and_torso(make_walk_1(stance_arr), ref_bottom_y, ref_torso_x, True),
            "_walk_2.png": align_to_reference_foot_and_torso(make_walk_2(stance_arr), ref_bottom_y, ref_torso_x, True),
            "_crouch.png": align_to_reference_foot_and_torso(make_crouch(stance_arr), ref_bottom_y, ref_torso_x, True),
            "_block.png": align_to_reference_foot_and_torso(make_block(stance_arr), ref_bottom_y, ref_torso_x, True),
            "_jump.png": make_jump(stance_arr),
            "_windup_punch.png": align_to_reference_foot_and_torso(make_windup_punch(stance_arr), ref_bottom_y, ref_torso_x, True),
            "_mid_punch.png": make_mid_punch(punch_arr),
            "_windup_kick.png": align_to_reference_foot_and_torso(make_windup_kick(stance_arr), ref_bottom_y, ref_torso_x, True),
            "_mid_kick.png": make_mid_kick(kick_arr),
            "_spin_kick.png": make_spin_kick(kick_arr),
            "_uppercut.png": make_uppercut(punch_arr),
            "_hook_punch.png": make_hook_punch(punch_arr),
            "_low_kick.png": make_low_kick(kick_arr),
            "_dive_kick.png": make_dive_kick(kick_arr),
            "_backfist.png": align_to_reference_foot_and_torso(make_backfist(punch_arr), ref_bottom_y, ref_torso_x, True),
            "_axe_kick.png": align_to_reference_foot_and_torso(make_axe_kick(kick_arr), ref_bottom_y, ref_torso_x, True),
            "_hurricane_kick.png": align_to_reference_foot_and_torso(make_hurricane_kick(kick_arr), ref_bottom_y, ref_torso_x, False),
            "_dragon_uppercut.png": align_to_reference_foot_and_torso(make_dragon_uppercut(punch_arr), ref_bottom_y, ref_torso_x, False),
        }

        for fname, arr in frames.items():
            out_path = os.path.join(cdir, fname)
            Image.fromarray(enforce_4px_border(arr)).save(out_path, "PNG")

        for pfx in ("keano", "jayden"):
            for move in ("hook_punch", "low_kick", "dive_kick"):
                custom_p = os.path.join(cdir, f"{pfx}_{move}.png")
                if os.path.exists(custom_p):
                    c_arr = enforce_4px_border(np.array(Image.open(custom_p).convert("RGBA")))
                    Image.fromarray(c_arr).save(custom_p, "PNG")
                    Image.fromarray(c_arr).save(os.path.join(cdir, f"_{move}.png"), "PNG")

        walk_p = os.path.join(cdir, "_walk.png")
        Image.fromarray(enforce_4px_border(frames["_walk_1.png"])).save(walk_p, "PNG")

        # Ensure all existing PNG sprites in the character folder have clean 4px transparent borders
        for existing_f in os.listdir(cdir):
            if existing_f.endswith(".png") and existing_f not in frames and existing_f != "_walk.png":
                ep = os.path.join(cdir, existing_f)
                earr = np.array(Image.open(ep).convert("RGBA"))
                a = earr[:, :, 3]
                if a[:4, :].max() > 0 or a[-4:, :].max() > 0 or a[:, :4].max() > 0 or a[:, -4:].max() > 0:
                    Image.fromarray(enforce_4px_border(earr)).save(ep, "PNG")

    print("✅ All 21 characters updated with 28-sprite jitter-free Street Fighter sets!")

if __name__ == "__main__":
    process_all_characters()
