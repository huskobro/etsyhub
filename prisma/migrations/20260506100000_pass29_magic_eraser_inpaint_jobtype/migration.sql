-- Pass 29 — Magic Eraser inpainting (LaMa) Selection Studio edit-op.
-- Yeni JobType enum value. Geriye dönük uyumlu: mevcut row'lar etkilenmez.
ALTER TYPE "JobType" ADD VALUE 'MAGIC_ERASER_INPAINT';
