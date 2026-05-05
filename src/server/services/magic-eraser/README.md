# Magic Eraser (LaMa) — Pass 29

EtsyHub Selection Studio edit-op olarak entegre edilmiş, LaMa-based
inpainting servisi. Image-reviewer reposundan **adapte edilmiştir**;
birebir kopya değildir — DB-first mimari + storage-backed I/O ile
yeniden yerleştirilmiştir.

## Mimari

```
[UI: MagicEraserPanel + MaskCanvas]
        │ POST mask buffer
        ▼
[Endpoint: /api/selection/items/[id]/edit-ops/magic-eraser]
        │ enqueue MAGIC_ERASER_INPAINT
        ▼
[Worker: magic-eraser.worker.ts]
        │ subprocess(python3 runner.py …)
        ▼
[Python: runner.py — LaMa inpaint]
        │ output PNG
        ▼
[Storage upload → new Asset row → SelectionItem.editedAssetId]
```

## Setup

Admin/sysadmin sorumluluğunda Python env kurulumu:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r src/server/services/magic-eraser/requirements.txt
```

İlk çalıştırmada LaMa modeli `~/.cache/torch`'a indirilir (~150MB).
MPS (Apple Silicon) ve CPU otomatik seçilir.

## Env

- `MAGIC_ERASER_PYTHON` — runner'ı çalıştıracak python binary (default:
  PATH'teki `python3`).
- Eğer venv kullanılıyorsa: `MAGIC_ERASER_PYTHON=/path/to/.venv/bin/python`

## Honest sınırlar (V1)

- Cold start ~5-15s (model lazy load). Production'da worker startup
  pre-warm planlanabilir.
- 4096×4096+ asset'lerde RAM ~1-2GB peak. Worker concurrency 1 önerilir.
- LaMa kurulu değilse runner exit code 2 döner; worker FAILED state'e
  geçer, audit history'ye `failed: true, reason: "..."` yazılır
  (selection-edit emsali).
- Çıktı her zaman PNG (LaMa RGB output, mask binarize). Alpha channel
  korunmaz; transparent input için ayrı path V2.x carry.

## Image-reviewer'dan farklar

| | image-reviewer | EtsyHub |
|---|---|---|
| Trigger | Express POST + spawn | BullMQ worker subprocess |
| State | Filesystem temp + commit endpoint | DB SelectionItem.editedAssetId + storage upload |
| Multi-tenant | Yok | userId isolation, ownership check |
| Audit | `.logs.json` | AuditLog + editHistoryJson |
| Undo | last log entry | DB lastUndoableAssetId pattern |
| Concurrency | Yok | activeHeavyJobId DB lock |
