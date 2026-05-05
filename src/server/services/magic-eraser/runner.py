#!/usr/bin/env python3
"""
Pass 29 — Magic Eraser LaMa inpainting runner.

I/O contract (stdin/stdout buffers — subprocess-friendly):
  - argv[1] = input image path (PNG/JPEG/WebP)
  - argv[2] = mask image path (PNG, grayscale; white=remove, black=keep)
  - argv[3] = output image path (PNG)

Exit codes:
  0  — success, output written
  1  — input/mask read failure
  2  — model load failure (LaMa not installed; install simple-lama-inpainting)
  3  — inpaint runtime failure
  4  — output write failure

EtsyHub mimari notu:
  Bu runner kasıtlı olarak self-contained — node tarafında subprocess.spawn
  ile çağrılır, stdout JSON döner. Production'da admin bağımsız Python env
  kurar (pip install simple-lama-inpainting). Tek modeli proses ömrü boyu
  cache'lemek için worker startup'ında pre-warm önerilir (pas 29 V1: lazy
  load — ilk çağrı 5-15s cold start, sonraki <1s).

Image-reviewer'dan adapte edilmiştir (inpainter.py); birebir kopya değil.
Farklar: argv-based I/O, stderr structured logging, mask normalization
(grayscale + binarize), JSON output line on stdout for parsing.
"""

import sys
import json
import os
import time


def emit(payload):
    """JSON-line stdout writer (worker bunu okuyacak)."""
    print(json.dumps(payload), flush=True)


def err(msg, exit_code):
    print(f"[magic-eraser-runner] ERROR: {msg}", file=sys.stderr, flush=True)
    emit({"ok": False, "error": msg, "exitCode": exit_code})
    sys.exit(exit_code)


def main():
    if len(sys.argv) < 4:
        err("usage: runner.py <input> <mask> <output>", 1)

    in_path, mask_path, out_path = sys.argv[1], sys.argv[2], sys.argv[3]

    if not os.path.exists(in_path):
        err(f"input not found: {in_path}", 1)
    if not os.path.exists(mask_path):
        err(f"mask not found: {mask_path}", 1)

    try:
        from PIL import Image
    except ImportError:
        err(
            "Pillow not installed. Run: pip install Pillow",
            2,
        )

    # Lazy import LaMa — kullanıcı kurulu değilse anlamlı hata.
    try:
        from simple_lama_inpainting import SimpleLama  # type: ignore
    except ImportError:
        err(
            "simple-lama-inpainting not installed. Run: "
            "pip install simple-lama-inpainting",
            2,
        )

    try:
        img = Image.open(in_path).convert("RGB")
        mask = Image.open(mask_path).convert("L")  # grayscale
        # Binarize: >127 = remove (255), else keep (0)
        mask = mask.point(lambda p: 255 if p > 127 else 0)
    except Exception as e:
        err(f"image/mask load failed: {e}", 1)

    try:
        t0 = time.time()
        lama = SimpleLama()
        result = lama(img, mask)
        elapsed_ms = int((time.time() - t0) * 1000)
    except Exception as e:
        err(f"inpaint runtime failed: {e}", 3)

    try:
        result.save(out_path, "PNG")
    except Exception as e:
        err(f"output write failed: {e}", 4)

    emit({
        "ok": True,
        "outputPath": out_path,
        "elapsedMs": elapsed_ms,
        "width": result.width,
        "height": result.height,
    })


if __name__ == "__main__":
    main()
