import os
from PIL import Image, ImageDraw, ImageFilter

def create_fpga_favicon():
    size = 512
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Coordinates
    # Center = 256, 256
    chip_left = 80
    chip_top = 80
    chip_right = 432
    chip_bottom = 432
    chip_radius = 48

    # 1. Outer Glow / Bloom (Subtle Cyan-Blue)
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.rounded_rectangle(
        [chip_left - 8, chip_top - 8, chip_right + 8, chip_bottom + 8],
        radius=chip_radius + 6,
        fill=(37, 99, 235, 90)
    )
    glow_draw.rounded_rectangle(
        [chip_left - 16, chip_top - 16, chip_right + 16, chip_bottom + 16],
        radius=chip_radius + 12,
        fill=(56, 189, 248, 40)
    )
    glow = glow.filter(ImageFilter.GaussianBlur(16))
    img.paste(glow, (0, 0), glow)

    # 2. Draw IC Package Lead Frame Pins (protruding metallic pins)
    # Pins on Top, Bottom, Left, Right
    pin_w = 24
    pin_len = 46
    pin_color_body = (148, 163, 184, 255) # Slate 400
    pin_color_tip = (56, 189, 248, 255)   # Cyan 400

    pin_positions = [160, 224, 288, 352] # 4 pins per side

    for p in pin_positions:
        # Top pins
        draw.rounded_rectangle([p - pin_w//2, chip_top - pin_len, p + pin_w//2, chip_top + 10], radius=6, fill=pin_color_body)
        draw.rounded_rectangle([p - pin_w//2, chip_top - pin_len, p + pin_w//2, chip_top - pin_len + 14], radius=4, fill=pin_color_tip)
        
        # Bottom pins
        draw.rounded_rectangle([p - pin_w//2, chip_bottom - 10, p + pin_w//2, chip_bottom + pin_len], radius=6, fill=pin_color_body)
        draw.rounded_rectangle([p - pin_w//2, chip_bottom + pin_len - 14, p + pin_w//2, chip_bottom + pin_len], radius=4, fill=pin_color_tip)

        # Left pins
        draw.rounded_rectangle([chip_left - pin_len, p - pin_w//2, chip_left + 10, p + pin_w//2], radius=6, fill=pin_color_body)
        draw.rounded_rectangle([chip_left - pin_len, p - pin_w//2, chip_left - pin_len + 14, p + pin_w//2], radius=4, fill=pin_color_tip)

        # Right pins
        draw.rounded_rectangle([chip_right - 10, p - pin_w//2, chip_right + pin_len, p + pin_w//2], radius=6, fill=pin_color_body)
        draw.rounded_rectangle([chip_right + pin_len - 14, p - pin_w//2, chip_right + pin_len, p + pin_w//2], radius=4, fill=pin_color_tip)

    # 3. Main IC Chip Body (Dark Cockpit Package)
    draw.rounded_rectangle(
        [chip_left, chip_top, chip_right, chip_bottom],
        radius=chip_radius,
        fill=(10, 15, 29, 255), # Deep obsidian blue
        outline=(59, 130, 246, 255), # Electric blue border
        width=8
    )

    # Beveled inner border
    draw.rounded_rectangle(
        [chip_left + 10, chip_top + 10, chip_right - 10, chip_bottom - 10],
        radius=chip_radius - 8,
        fill=None,
        outline=(30, 41, 59, 200),
        width=4
    )

    # 4. Pin 1 Orientation Indicator (Dot at top-left)
    draw.ellipse([chip_left + 24, chip_top + 24, chip_left + 44, chip_top + 44], fill=(15, 23, 42, 255), outline=(56, 189, 248, 255), width=3)
    draw.ellipse([chip_left + 30, chip_top + 30, chip_left + 38, chip_top + 38], fill=(16, 185, 129, 255)) # Green LED

    # 5. Inner Silicon Die / Logic Fabric Matrix
    die_margin = 72
    die_left = chip_left + die_margin
    die_top = chip_top + die_margin
    die_right = chip_right - die_margin
    die_bottom = chip_bottom - die_margin
    die_radius = 24

    draw.rounded_rectangle(
        [die_left, die_top, die_right, die_bottom],
        radius=die_radius,
        fill=(6, 11, 22, 255), # Dark silicon die
        outline=(30, 58, 138, 255), # Deep blue ring
        width=5
    )

    # 6. PCB Circuit Traces / Bus Routing
    trace_color = (30, 64, 120, 180)
    # Horizontal grid lines
    for y in [die_top + 45, die_top + 100, die_top + 155]:
        draw.line([die_left + 12, y, die_right - 12, y], fill=trace_color, width=3)
    # Vertical grid lines
    for x in [die_left + 45, die_left + 100, die_left + 155]:
        draw.line([x, die_top + 12, x, die_bottom - 12], fill=trace_color, width=3)

    # Logic Nodes / Vias (glowing cyan/emerald points at intersections)
    nodes = [
        (die_left + 45, die_top + 45, (16, 185, 129)),
        (die_right - 45, die_top + 45, (56, 189, 248)),
        (die_left + 45, die_bottom - 45, (56, 189, 248)),
        (die_right - 45, die_bottom - 45, (16, 185, 129)),
    ]
    for nx, ny, c in nodes:
        draw.ellipse([nx - 6, ny - 6, nx + 6, ny + 6], fill=(*c, 255))
        draw.ellipse([nx - 2, ny - 2, nx + 2, ny + 2], fill=(255, 255, 255, 255))

    # 7. Central Glowing Electric Lightning Symbol (High-Voltage Core)
    # High-contrast, iconic lightning bolt
    bolt_points = [
        (268, 170), # top tip
        (205, 260), # inner left knee
        (255, 260), # inner right pinch
        (235, 342), # bottom tip
        (305, 246), # outer right knee
        (255, 246), # outer left pinch
    ]

    # Glow layer for bolt
    bolt_glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bolt_glow)
    bg_draw.polygon(bolt_points, fill=(56, 189, 248, 160))
    bolt_glow = bolt_glow.filter(ImageFilter.GaussianBlur(10))
    img.paste(bolt_glow, (0, 0), bolt_glow)

    # Solid vibrant bolt
    draw.polygon(bolt_points, fill=(59, 130, 246, 255)) # Cobalt blue
    
    # Inner bright core
    inner_bolt = [
        (267, 178),
        (216, 256),
        (256, 256),
        (240, 330),
        (296, 248),
        (256, 248),
    ]
    draw.polygon(inner_bolt, fill=(147, 197, 253, 255)) # Light sky
    
    # Pure white central highlight line
    draw.line([(265, 185), (230, 252), (275, 252), (245, 315)], fill=(255, 255, 255, 255), width=4)

    return img

if __name__ == "__main__":
    os.makedirs("public", exist_ok=True)
    os.makedirs("src/app", exist_ok=True)
    
    img = create_fpga_favicon()

    # Save high-res PNG
    img.save("public/icon-512.png", format="PNG")
    
    # Generate multi-resolution ICO file with all standard sizes
    sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    img.save("public/favicon.ico", format="ICO", sizes=sizes)
    img.save("src/app/favicon.ico", format="ICO", sizes=sizes)

    # Save 192x192 & 180x180 (apple-touch-icon)
    apple_icon = img.resize((180, 180), Image.Resampling.LANCZOS)
    apple_icon.save("public/apple-touch-icon.png", format="PNG")
    apple_icon.save("src/app/apple-icon.png", format="PNG")

    print("Favicon files generated successfully!")
