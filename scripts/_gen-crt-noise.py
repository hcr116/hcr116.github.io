"""生成一张电视雪花噪点贴图（96×96，白色稀疏点 + 透明底，可平铺）。

用法：python scripts/_gen-crt-noise.py
输出：public/textures/crt-noise.png
"""

from pathlib import Path

from PIL import Image

SIZE = 96
OUT = Path(__file__).resolve().parents[1] / "public" / "textures" / "crt-noise.png"

# 固定种子，保证每次生成的贴图一样（改效果时改这里就行）
rng = __import__("random").Random(20261102)

img = Image.new("RGBA", (SIZE, SIZE), (255, 255, 255, 0))
px = img.load()

for y in range(SIZE):
    for x in range(SIZE):
        roll = rng.random()
        if roll < 0.52:
            # 一多半是完全透明的底，雪花才有“点”的感觉
            continue
        if roll < 0.88:
            alpha = rng.randint(28, 90)
        else:
            alpha = rng.randint(120, 210)
        # 极轻的冷调，别让它纯白
        px[x, y] = (226, 240, 248, alpha)

OUT.parent.mkdir(parents=True, exist_ok=True)
img.save(OUT, optimize=True)
print(f"written {OUT} ({OUT.stat().st_size} bytes)")
