import os
import math
from PIL import Image, ImageDraw, ImageFilter

def generate_all_icons():
    src_path = r'c:\Users\samra\Pictures\food-delivery-platform\public\hunger.png'
    res_dir = r'c:\Users\samra\Pictures\food-delivery-platform\androidapp\app\src\main\res'
    main_dir = r'c:\Users\samra\Pictures\food-delivery-platform\androidapp\app\src\main'

    # Load master hunger.png logo
    src = Image.open(src_path).convert('RGBA')
    w, h = src.size
    print(f"Master Logo Loaded: {src_path} ({w}x{h})")

    # Densities: (legacy_size_px, adaptive_canvas_size_px)
    densities = {
        'mipmap-mdpi': {'legacy': 48, 'adaptive': 108},
        'mipmap-hdpi': {'legacy': 72, 'adaptive': 162},
        'mipmap-xhdpi': {'legacy': 96, 'adaptive': 216},
        'mipmap-xxhdpi': {'legacy': 144, 'adaptive': 324},
        'mipmap-xxxhdpi': {'legacy': 192, 'adaptive': 432},
    }

    # Ensure all target folders exist
    for folder in densities.keys():
        os.makedirs(os.path.join(res_dir, folder), exist_ok=True)
    os.makedirs(os.path.join(res_dir, 'drawable'), exist_ok=True)
    os.makedirs(os.path.join(res_dir, 'drawable-xxxhdpi'), exist_ok=True)

    # ----------------------------------------------------
    # 1. ADAPTIVE FOREGROUND (ic_launcher_foreground.png)
    # Total Canvas = 108dp. Safe zone diameter = 72dp.
    # We fit the hunger.png badge comfortably inside ~66dp (91% of safe zone)
    # so circle, squircle, teardrop masks will NEVER clip any part of the logo or text!
    # ----------------------------------------------------
    print("\n--- 1. Generating Adaptive Foreground Icons ---")
    for folder, sizes in densities.items():
        canvas_size = sizes['adaptive']
        # Safe zone diameter = 72 / 108 * canvas_size
        target_badge_size = int(round(canvas_size * (66.0 / 108.0)))

        scaled_badge = src.resize((target_badge_size, target_badge_size), Image.Resampling.LANCZOS)

        fg = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
        paste_x = (canvas_size - target_badge_size) // 2
        paste_y = (canvas_size - target_badge_size) // 2
        fg.paste(scaled_badge, (paste_x, paste_y), scaled_badge)

        out_path = os.path.join(res_dir, folder, 'ic_launcher_foreground.png')
        fg.save(out_path, 'PNG', optimize=True)
        print(f"  [OK] {folder}/ic_launcher_foreground.png ({canvas_size}x{canvas_size})")

        # Monochrome foreground for Android 13+ Themed Icons
        mono_fg = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
        _, _, _, logo_alpha = scaled_badge.split()
        stencil = Image.new('RGBA', (target_badge_size, target_badge_size), (40, 40, 40, 255))
        stencil.putalpha(logo_alpha)
        mono_fg.paste(stencil, (paste_x, paste_y), stencil)
        mono_out = os.path.join(res_dir, folder, 'ic_launcher_monochrome.png')
        mono_fg.save(mono_out, 'PNG', optimize=True)

    mono_drawable = os.path.join(res_dir, 'drawable', 'ic_launcher_monochrome.png')
    mono_fg.save(mono_drawable, 'PNG', optimize=True)

    # ----------------------------------------------------
    # 2. LEGACY SQUIRCLE / SQUARE ICONS (ic_launcher.png)
    # Render at 4x super-resolution for ultra-smooth edge anti-aliasing.
    # Scaled to fill 94% of legacy icon canvas with subtle ambient shadow.
    # ----------------------------------------------------
    print("\n--- 2. Generating Legacy Square/Squircle Icons ---")
    for folder, sizes in densities.items():
        size = sizes['legacy']
        super_scale = 4
        s_size = size * super_scale

        canvas = Image.new('RGBA', (s_size, s_size), (0, 0, 0, 0))
        badge_dim = int(round(s_size * 0.94))
        badge_super = src.resize((badge_dim, badge_dim), Image.Resampling.LANCZOS)

        # Ambient drop shadow
        shadow = Image.new('RGBA', (s_size, s_size), (0, 0, 0, 0))
        _, _, _, a = badge_super.split()
        shadow_stencil = Image.new('RGBA', (badge_dim, badge_dim), (0, 0, 0, 55))
        shadow_stencil.putalpha(a)
        spx = (s_size - badge_dim) // 2
        spy = spx + int(round(s_size * 0.02))
        shadow.paste(shadow_stencil, (spx, spy), shadow_stencil)
        shadow = shadow.filter(ImageFilter.GaussianBlur(int(round(s_size * 0.02))))

        canvas.paste(shadow, (0, 0), shadow)
        canvas.paste(badge_super, (spx, spx), badge_super)

        final_icon = canvas.resize((size, size), Image.Resampling.LANCZOS)
        out_path = os.path.join(res_dir, folder, 'ic_launcher.png')
        final_icon.save(out_path, 'PNG', optimize=True)
        print(f"  [OK] {folder}/ic_launcher.png ({size}x{size})")

    # ----------------------------------------------------
    # 3. LEGACY ROUND ICONS (ic_launcher_round.png)
    # Crisp circular white base with Hunger badge centered,
    # ensuring perfect curvature on Pixel / Motorola / Xiaomi circular launchers.
    # ----------------------------------------------------
    print("\n--- 3. Generating Legacy Round Icons ---")
    for folder, sizes in densities.items():
        size = sizes['legacy']
        super_scale = 4
        s_size = size * super_scale

        canvas = Image.new('RGBA', (s_size, s_size), (0, 0, 0, 0))
        pad = int(s_size * 0.03)
        circle_dim = s_size - 2 * pad

        # Circular shadow
        shadow = Image.new('RGBA', (s_size, s_size), (0, 0, 0, 0))
        s_draw = ImageDraw.Draw(shadow)
        s_draw.ellipse((pad, pad + int(s_size * 0.02), pad + circle_dim, pad + circle_dim + int(s_size * 0.02)), fill=(0, 0, 0, 45))
        shadow = shadow.filter(ImageFilter.GaussianBlur(int(round(s_size * 0.02))))
        canvas.paste(shadow, (0, 0), shadow)

        # White base circle
        circle = Image.new('RGBA', (s_size, s_size), (0, 0, 0, 0))
        c_draw = ImageDraw.Draw(circle)
        c_draw.ellipse((pad, pad, pad + circle_dim, pad + circle_dim), fill=(255, 255, 255, 255))
        canvas.paste(circle, (0, 0), circle)

        # Hunger badge centered inside circle (~82% of circle diameter)
        inner_badge_dim = int(round(circle_dim * 0.82))
        inner_badge = src.resize((inner_badge_dim, inner_badge_dim), Image.Resampling.LANCZOS)
        bpx = (s_size - inner_badge_dim) // 2
        bpy = (s_size - inner_badge_dim) // 2
        canvas.paste(inner_badge, (bpx, bpy), inner_badge)

        final_round = canvas.resize((size, size), Image.Resampling.LANCZOS)
        out_path = os.path.join(res_dir, folder, 'ic_launcher_round.png')
        final_round.save(out_path, 'PNG', optimize=True)
        print(f"  [OK] {folder}/ic_launcher_round.png ({size}x{size})")

    # ----------------------------------------------------
    # 4. GOOGLE PLAY STORE ICON (512x512)
    # ----------------------------------------------------
    print("\n--- 4. Generating Google Play Store Icon (512x512) ---")
    ps_canvas = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    ps_badge = src.resize((480, 480), Image.Resampling.LANCZOS)
    ps_canvas.paste(ps_badge, (16, 16), ps_badge)
    ps_path1 = os.path.join(main_dir, 'ic_launcher-web.png')
    ps_path2 = os.path.join(res_dir, 'mipmap-xxxhdpi', 'ic_launcher_web.png')
    ps_canvas.save(ps_path1, 'PNG', optimize=True)
    ps_canvas.save(ps_path2, 'PNG', optimize=True)
    print(f"  [OK] {ps_path1}")

    # ----------------------------------------------------
    # 5. SPLASH & IN-APP LOGO (logo_akr_hunger.png & logo_hunger.png)
    # ----------------------------------------------------
    print("\n--- 5. Generating Splash Screen Logos ---")
    splash_1024 = src.resize((1024, 1024), Image.Resampling.LANCZOS)
    splash_1024.save(os.path.join(res_dir, 'drawable-xxxhdpi', 'logo_akr_hunger.png'), 'PNG', optimize=True)
    splash_1024.save(os.path.join(res_dir, 'drawable-xxxhdpi', 'logo_hunger.png'), 'PNG', optimize=True)
    splash_512 = src.resize((512, 512), Image.Resampling.LANCZOS)
    splash_512.save(os.path.join(res_dir, 'drawable', 'logo_akr_hunger.png'), 'PNG', optimize=True)
    splash_512.save(os.path.join(res_dir, 'drawable', 'logo_hunger.png'), 'PNG', optimize=True)
    print(f"  [OK] Splash logos generated in drawable and drawable-xxxhdpi")

    print("\n=== All Android App Icons & Splash Assets Generated Successfully! ===")

if __name__ == '__main__':
    generate_all_icons()
