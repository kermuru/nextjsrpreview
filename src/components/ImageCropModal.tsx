'use client';

import { useEffect, useRef, useMemo, useState } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import { rotateDataUrl } from '@/lib/images';
import Modal from './Modal';

type Props = {
  title: string;
  sourceUrl: string;
  aspect?: number;
  allowRotate?: boolean;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void | Promise<void>;
};

export default function ImageCropModal({
  title,
  sourceUrl,
  aspect,
  allowRotate = false,
  onCancel,
  onConfirm
}: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [workingSource, setWorkingSource] = useState(sourceUrl);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setWorkingSource(sourceUrl);
    setCrop(undefined);
    setCompletedCrop(undefined);
  }, [sourceUrl]);

  const imageStyle = useMemo(() => ({ maxWidth: '100%', maxHeight: '65vh' }), []);

  async function rotate(delta: number) {
    const next = await rotateDataUrl(workingSource, delta);
    setWorkingSource(next);
    setCrop(undefined);
    setCompletedCrop(undefined);
  }

  async function confirm() {
    if (!completedCrop || !imgRef.current) return;

    const image = imgRef.current;
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const cropX = completedCrop.x * scaleX;
    const cropY = completedCrop.y * scaleY;
    const cropW = completedCrop.width * scaleX;
    const cropH = completedCrop.height * scaleY;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(cropW));
    canvas.height = Math.max(1, Math.round(cropH));

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(image, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);

    setSaving(true);
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Crop failed.'))),
          'image/jpeg',
          0.92
        );
      });
      await onConfirm(blob);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={title} onClose={onCancel}>
      <div className="stack">
        <div className="row" style={{ justifyContent: 'center', alignItems: 'center' }}>
          {allowRotate ? (
            <button type="button" className="button ghost small" onClick={() => rotate(-90)}>
              Rotate Left
            </button>
          ) : null}
          <div style={{ maxWidth: '100%', overflow: 'auto' }}>
            <ReactCrop
              crop={crop}
              onChange={(next) => setCrop(next)}
              onComplete={(pixels) => setCompletedCrop(pixels)}
              aspect={aspect}
              keepSelection
            >
              <img
                ref={imgRef}
                src={workingSource}
                alt="Crop preview"
                style={imageStyle}
                onLoad={(event) => {
                  const el = event.currentTarget;
                  const w = el.width;
                  const h = el.height;
                  const side = Math.min(w, h) * 0.8;
                  const targetW = aspect ? side : w * 0.8;
                  const targetH = aspect ? side / aspect : h * 0.8;
                  const initialCrop: PixelCrop = {
                    unit: 'px',
                    x: (w - targetW) / 2,
                    y: (h - targetH) / 2,
                    width: targetW,
                    height: targetH
                  };
                  setCrop(initialCrop);
                  setCompletedCrop(initialCrop);
                }}
              />
            </ReactCrop>
          </div>
          {allowRotate ? (
            <button type="button" className="button ghost small" onClick={() => rotate(90)}>
              Rotate Right
            </button>
          ) : null}
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="button ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={confirm}
            disabled={!completedCrop || saving}
          >
            {saving ? 'Saving...' : 'Confirm Crop'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
