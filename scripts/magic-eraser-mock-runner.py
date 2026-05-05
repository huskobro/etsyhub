#!/usr/bin/env python3
"""
Pass 30 — Magic Eraser MOCK runner (LaMa kurulu olmadan QA smoke için).

Production runner.py LaMa modeli kullanır (~150MB indirme + RAM ağır).
Bu mock aynı **subprocess sözleşmesini** korur:
  argv[1] = input image path
  argv[2] = mask image path (white=remove)
  argv[3] = output image path

Mock davranışı: input görselin maskelenen alanlarını **gri** ile boyar
(LaMa'nın gerçek inpaint yerine görsel sinyali). UI tarafında
"Magic Eraser çalıştı" geri bildirimi alabilmek için yeterli; production
çıktısı ile karıştırmamak için boyama net şekilde gri (#888) yapılır.

Aktivasyon:
  export MAGIC_ERASER_PYTHON=/path/to/python3
  ENV: MAGIC_ERASER_RUNNER_OVERRIDE=<path/to/this/script>
  veya direkt:
  MAGIC_ERASER_PYTHON=python3 \
  MAGIC_ERASER_RUNNER_OVERRIDE=$(pwd)/scripts/magic-eraser-mock-runner.py \
  npm run worker

Honest sınır: gerçek LaMa kurulumu external dep; bu mock yalnız QA
amacıyla. Production'da kapatılmalı.
"""

import sys
import json
import os
import time


def emit(payload):
    print(json.dumps(payload), flush=True)


def err(msg, code):
    print(f"[mock-runner] {msg}", file=sys.stderr, flush=True)
    emit({"ok": False, "error": msg, "exitCode": code})
    sys.exit(code)


def main():
    if len(sys.argv) < 4:
        err("usage: mock-runner.py <input> <mask> <output>", 1)

    in_path, mask_path, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
    if not os.path.exists(in_path):
        err(f"input not found: {in_path}", 1)
    if not os.path.exists(mask_path):
        err(f"mask not found: {mask_path}", 1)

    try:
        from PIL import Image
    except ImportError:
        err("Pillow not installed (pip install Pillow)", 2)

    try:
        t0 = time.time()
        img = Image.open(in_path).convert("RGB")
        mask = Image.open(mask_path).convert("L")
        # Mask boyutu input'a uy — runner sözleşmesi
        if mask.size != img.size:
            mask = mask.resize(img.size)
        # Mock: maskelenen alanı gri (#888) boya
        gray = Image.new("RGB", img.size, (136, 136, 136))
        # Threshold uygula (simple-lama-inpainting binarize emsali)
        bin_mask = mask.point(lambda p: 255 if p > 127 else 0)
        result = Image.composite(gray, img, bin_mask)
        result.save(out_path, "PNG")
        elapsed_ms = int((time.time() - t0) * 1000)
    except Exception as e:
        err(f"mock inpaint failed: {e}", 3)

    emit({
        "ok": True,
        "outputPath": out_path,
        "elapsedMs": elapsed_ms,
        "width": result.width,
        "height": result.height,
        "mock": True,
    })


if __name__ == "__main__":
    main()
