import os
import math
from PIL import Image, ImageDraw, ImageFilter

def generate_all_icons():
    src_path = r'c:\Users\samra\Pictures\food-delivery-platform\public\akrhunger.png'
    res_dir = r'c:\Users\samra\Pictures\food-delivery-platform\androidapp\app\src\main\res'
    main_dir = r'c:\Users\samra\Pictures\food-delivery-platform\androidapp\app\src\main'

    # Load master image and strip stray alpha noise (< 5)
    src = Image.open(src_path).convert('RGBA')
    r, g, b, a = src.split()
    # Threshold alpha channel to remove export noise
    clean_a = a.point(lambda p: 255 if p > 4 else 0)
    # Mask original image with clean alpha
    cleaned_img = Image.new('RGBA', src.size, (0, 0, 0, 0))
    cleaned_img.paste(src, (0, 0), a.point(lambda p: p if p > 4 else 0))
    
    # Get exact bbox
    bbox = cleaned_img.split()[-1].getbbox()
    cropped = cleaned_img.crop(bbox)
    w_crop, h_crop = cropped.size
    print(f"Cleaned Logo Bounding Box: {bbox}, Dimensions: {w_crop}x{h_crop}")

    # Density configurations
    # density: (legacy_size_px, adaptive_canvas_size_px)
    densities = {
        'mipmap-mdpi': {'legacy': 48, 'adaptive': 108},
        'mipmap-hdpi': {'legacy': 72, 'adaptive': 162},
        'mipmap-xhdpi': {'legacy': 96, 'adaptive': 216},
        'mipmap-xxhdpi': {'legacy': 144, 'adaptive': 324},
        'mipmap-xxxhdpi': {'legacy': 192, 'adaptive': 432},
    }

    # Ensure directories exist
    for folder in densities.keys():
        os.makedirs(os.path.join(res_dir, folder), exist_ok=True)
    os.makedirs(os.path.join(res_dir, 'drawable'), exist_ok=True)
    os.makedirs(os.path.join(res_dir, 'drawable-xxxhdpi'), exist_ok=True)

    # ----------------------------------------------------
    # 1. ADAPTIVE FOREGROUND (ic_launcher_foreground.png)
    # Canvas = 108dp. Safe zone = 72dp diameter.
    # We fit the logo circumscribing diameter comfortably inside ~64dp.
    # ----------------------------------------------------
    print("\n--- 1. Generating Adaptive Foreground Icons ---")
    cx_crop, cy_crop = w_crop / 2.0, h_crop / 2.0
    # Calculate circumscribing radius
    max_r = 0
    for y in range(h_crop):
        for x in range(w_crop):
            if cropped.getpixel((x, y))[3] > 10:
                d = math.sqrt((x - cx_crop)**2 + (y - cy_crop)**2)
                if d > max_r:
                    max_r = d
    circum_d = max_r * 2.0
    print(f"Circumscribing diameter: {circum_d:.1f}px")

    for folder, sizes in densities.items():
        canvas_size = sizes['adaptive']
        # Safe zone diameter = 72 / 108 * canvas_size
        safe_zone_d = canvas_size * (72.0 / 108.0)
        target_d = safe_zone_d * 0.90 # 10% breathing room inside safe zone

        scale = target_d / circum_d
        scaled_w = max(1, int(round(w_crop * scale)))
        scaled_h = max(1, int(round(h_crop * scale)))
        scaled_logo = cropped.resize((scaled_w, scaled_h), Image.Resampling.LANCZOS)

        fg = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
        paste_x = (canvas_size - scaled_w) // 2
        paste_y = (canvas_size - scaled_h) // 2
        fg.paste(scaled_logo, (paste_x, paste_y), scaled_logo)

        out_path = os.path.join(res_dir, folder, 'ic_launcher_foreground.png')
        fg.save(out_path, 'PNG', optimize=True)
        print(f"  [OK] {folder}/ic_launcher_foreground.png ({canvas_size}x{canvas_size})")

        # Monochrome foreground for Android 13+ Themed Icons
        mono_fg = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
        _, _, _, logo_alpha = scaled_logo.split()
        stencil = Image.new('RGBA', (scaled_w, scaled_h), (30, 30, 30, 255))
        stencil.putalpha(logo_alpha)
        mono_fg.paste(stencil, (paste_x, paste_y), stencil)
        mono_out = os.path.join(res_dir, folder, 'ic_launcher_monochrome.png')
        mono_fg.save(mono_out, 'PNG', optimize=True)

    # Also save monochrome in drawable for direct references
    mono_drawable = os.path.join(res_dir, 'drawable', 'ic_launcher_monochrome.png')
    mono_fg.save(mono_drawable, 'PNG', optimize=True)

    # ----------------------------------------------------
    # 2. LEGACY SQUIRCLE / SQUARE ICONS (ic_launcher.png)
    # Render at 4x super-resolution for ultra-smooth rendering.
    # White squircle with subtle drop shadow and centered logo.
    # ----------------------------------------------------
    print("\n--- 2. Generating Legacy Square/Squircle Icons ---")
    for folder, sizes in densities.items():
        size = sizes['legacy']
        super_scale = 4
        s_size = size * super_scale

        canvas = Image.new('RGBA', (s_size, s_size), (0, 0, 0, 0))
        pad = int(s_size * 0.05)
        corner_r = int(s_size * 0.22)

        # Soft ambient shadow
        shadow = Image.new('RGBA', (s_size, s_size), (0, 0, 0, 0))
        shadow_draw = ImageDraw.Draw(shadow)
        shadow_rect = [pad, pad + int(s_size * 0.02), s_size - pad, s_size - pad + int(s_size * 0.02)]
        shadow_draw.rounded_rectangle(shadow_rect, radius=corner_r, fill=(0, 0, 0, 45))
        shadow = shadow.filter(ImageFilter.GaussianBlur(int(s_size * 0.025)))
        canvas.paste(shadow, (0, 0), shadow)

        # Crisp white rounded badge
        badge = Image.new('RGBA', (s_size, s_size), (0, 0, 0, 0))
        badge_draw = ImageDraw.Draw(badge)
        badge_rect = [pad, pad, s_size - pad, s_size - pad]
        badge_draw.rounded_rectangle(badge_rect, radius=corner_r, fill=(255, 255, 255, 255))
        canvas.paste(badge, (0, 0), badge)

        # Fit logo inside badge (~76% width/height of badge)
        badge_inner_w = (s_size - 2 * pad) * 0.78
        badge_inner_h = (s_size - 2 * pad) * 0.78
        scale = min(badge_inner_w / w_crop, badge_inner_h / h_crop)
        logo_w = int(round(w_crop * scale))
        logo_h = int(round(h_crop * scale))
        scaled_logo = cropped.resize((logo_w, logo_h), Image.Resampling.LANCZOS)

        logo_x = (s_size - logo_w) // 2
        logo_y = (s_size - logo_h) // 2
        canvas.paste(scaled_logo, (logo_x, logo_y), scaled_logo)

        final_icon = canvas.resize((size, size), Image.Resampling.LANCZOS)
        out_path = os.path.join(res_dir, folder, 'ic_launcher.png')
        final_icon.save(out_path, 'PNG', optimize=True)
        print(f"  [OK] {folder}/ic_launcher.png ({size}x{size})")

    # ----------------------------------------------------
    # 3. LEGACY ROUND ICONS (ic_launcher_round.png)
    # Circular white badge with smooth edge, subtle shadow, centered logo.
    # ----------------------------------------------------
    print("\n--- 3. Generating Legacy Round Icons ---")
    for folder, sizes in densities.items():
        size = sizes['legacy']
        super_scale = 4
        s_size = size * super_scale

        canvas = Image.new('RGBA', (s_size, s_size), (0, 0, 0, 0))
        pad = int(s_size * 0.04)

        # Circular shadow
        shadow = Image.new('RGBA', (s_size, s_size), (0, 0, 0, 0))
        shadow_draw = ImageDraw.Draw(shadow)
        shadow_rect = [pad, pad + int(s_size * 0.02), s_size - pad, s_size - pad + int(s_size * 0.02)]
        shadow_draw.ellipse(shadow_rect, fill=(0, 0, 0, 40))
        shadow = shadow.filter(ImageFilter.GaussianBlur(int(s_size * 0.025)))
        canvas.paste(shadow, (0, 0), shadow)

        # White circle
        circle = Image.new('RGBA', (s_size, s_size), (0, 0, 0, 0))
        circle_draw = ImageDraw.Draw(circle)
        circle_rect = [pad, pad, s_size - pad, s_size - pad]
        circle_draw.ellipse(circle_rect, fill=(255, 255, 255, 255))
        canvas.paste(circle, (0, 0), circle)

        # Logo inside circle (circumscribing diameter ~ 76% of circle diameter)
        circle_d = (s_size - 2 * pad) * 0.76
        scale = circle_d / circum_d
        logo_w = int(round(w_crop * scale))
        logo_h = int(round(h_crop * scale))
        scaled_logo = cropped.resize((logo_w, logo_h), Image.Resampling.LANCZOS)

        logo_x = (s_size - logo_w) // 2
        logo_y = (s_size - logo_h) // 2
        canvas.paste(scaled_logo, (logo_x, logo_y), scaled_logo)

        final_icon = canvas.resize((size, size), Image.Resampling.LANCZOS)
        out_path = os.path.join(res_dir, folder, 'ic_launcher_round.png')
        final_icon.save(out_path, 'PNG', optimize=True)
        print(f"  [OK] {folder}/ic_launcher_round.png ({size}x{size})")

    # ----------------------------------------------------
    # 4. GOOGLE PLAY STORE ICON (ic_launcher-web.png, 512x512)
    # ----------------------------------------------------
    print("\n--- 4. Generating Google Play Store Icon (512x512) ---")
    ps_size = 512
    ps_canvas = Image.new('RGBA', (ps_size, ps_size), (255, 255, 255, 255))
    target_dim = int(ps_size * 0.76)
    scale = target_dim / max(w_crop, h_crop)
    logo_w = int(round(w_crop * scale))
    logo_h = int(round(h_crop * scale))
    scaled_logo = cropped.resize((logo_w, logo_h), Image.Resampling.LANCZOS)
    ps_canvas.paste(scaled_logo, ((ps_size - logo_w) // 2, (ps_size - logo_h) // 2), scaled_logo)

    ps_path1 = os.path.join(main_dir, 'ic_launcher-web.png')
    ps_path2 = os.path.join(res_dir, 'mipmap-xxxhdpi', 'ic_launcher_web.png')
    ps_canvas.save(ps_path1, 'PNG', optimize=True)
    ps_canvas.save(ps_path2, 'PNG', optimize=True)
    print(f"  [OK] {ps_path1}")

    # ----------------------------------------------------
    # 5. SPLASH & IN-APP LOGO (logo_akr_hunger.png)
    # High-resolution transparent centered logo.
    # ----------------------------------------------------
    print("\n--- 5. Generating Splash & In-App High-Res Logos ---")
    # Master 1024x1024
    splash_1024 = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    target_1024 = int(1024 * 0.88)
    scale = target_1024 / max(w_crop, h_crop)
    sw_1024 = int(round(w_crop * scale))
    sh_1024 = int(round(h_crop * scale))
    scaled_1024 = cropped.resize((sw_1024, sh_1024), Image.Resampling.LANCZOS)
    splash_1024.paste(scaled_1024, ((1024 - sw_1024) // 2, (1024 - sh_1024) // 2), scaled_1024)

    splash_path_xxxhdpi = os.path.join(res_dir, 'drawable-xxxhdpi', 'logo_akr_hunger.png')
    splash_path_drawable = os.path.join(res_dir, 'drawable', 'logo_akr_hunger.png')
    splash_1024.save(splash_path_xxxhdpi, 'PNG', optimize=True)
    splash_512 = splash_1024.resize((512, 512), Image.Resampling.LANCZOS)
    splash_512.save(splash_path_drawable, 'PNG', optimize=True)
    print(f"  [OK] {splash_path_xxxhdpi} & {splash_path_drawable}")

    print("\n=== All Android App Icons & Splash Assets Generated Successfully! ===")

if __name__ == '__main__':
    generate_all_icons()
