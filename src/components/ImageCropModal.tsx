'use client';

import { useEffect, useMemo, useState } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import { cropDataUrl, rotateDataUrl } from '@/lib/images';
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
  const [workingSource, setWorkingSource] = useState(sourceUrl);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [saving, setSaving] = useState(false);
  const [metrics, setMetrics] = useState<{ naturalWidth: number; naturalHeight: number; width: number; height: number } | null>(null);

  useEffect(() => {
    setWorkingSource(sourceUrl);
    setCrop(undefined);
    setCompletedCrop(undefined);
    setMetrics(null);
  }, [sourceUrl]);

  const imageStyle = useMemo(() => ({ maxWidth: '100%', maxHeight: '65vh' }), []);

  async function rotate(delta: number) {
    const next = await rotateDataUrl(workingSource, delta);
    setWorkingSource(next);
    setCrop(undefined);
    setCompletedCrop(undefined);
    setMetrics(null);
  }

  async function confirm() {
    if (!completedCrop) return;
    setSaving(true);
    try {
      const blob = await cropDataUrl(workingSource, completedCrop, metrics || undefined);
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
                src={workingSource}
                alt="Crop preview"
                style={imageStyle}
                onLoad={(event) => {
                  const element = event.currentTarget;
                  const width = element.width;
                  const height = element.height;
                  setMetrics({
                    naturalWidth: element.naturalWidth,
                    naturalHeight: element.naturalHeight,
                    width,
                    height
                  });
                  const targetWidth = width * 0.8;
                  const targetHeight = aspect ? targetWidth / aspect : height * 0.8;
                  const safeHeight = Math.min(targetHeight, height * 0.8);
                  const safeWidth = Math.min(targetWidth, width * 0.8);
                  setCrop({
                    unit: 'px',
                    x: (width - safeWidth) / 2,
                    y: (height - safeHeight) / 2,
                    width: safeWidth,
                    height: safeHeight
                  });
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
          <button type="button" className="button secondary" onClick={confirm} disabled={!completedCrop || saving}>
            {saving ? 'Saving...' : 'Confirm Crop'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
