from PIL import Image, ImageDraw

S = 512
BG = (18, 18, 20, 255)
GREEN = (0, 255, 163, 255)

img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# rounded-square background
d.rounded_rectangle([0, 0, S-1, S-1], radius=96, fill=BG)

# side-profile toilet, lid closed
d.rounded_rectangle([96, 120, 188, 300], radius=20, fill=GREEN)        # tank
d.rounded_rectangle([238, 96, 266, 126], radius=8, fill=GREEN)         # flush button
d.rounded_rectangle([170, 250, 372, 300], radius=24, fill=GREEN)       # closed lid / seat
d.polygon([(188, 290), (360, 290), (322, 372), (214, 372)], fill=GREEN)  # bowl body
d.rounded_rectangle([198, 366, 330, 402], radius=12, fill=GREEN)       # foot

for size in (16, 32, 48, 128):
    img.resize((size, size), Image.LANCZOS).save(f"icons/icon{size}.png")
print("done")
