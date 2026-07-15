'use client';

import { useEffect, useRef, useState } from 'react';
import Modal from '@/components/Modal';
import { isApiError, storageUrl } from '@/lib/api';
import {
  listAssetImages,
  uploadAssetImage,
  deleteAssetImage,
  bulkDeleteAssetImages,
  assetImageDownloadUrl,
  type AssetImage,
} from '@/services/asset-images';

type QueueItem = {
  id: string;
  name: string;
  progress: number;
  status: 'pending' | 'compressing' | 'uploading' | 'done' | 'error';
  error?: string;
};

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Trigger a browser download from the HD endpoint (server sets the filename). */
function triggerDownload(id: number) {
  const a = document.createElement('a');
  a.href = assetImageDownloadUrl(id);
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function AssetImagesPage() {
  const [items, setItems] = useState<AssetImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [viewer, setViewer] = useState<{ image: AssetImage; mode: 'hd' | 'ld' } | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        setItems(await listAssetImages());
      } catch {
        /* surfaced as empty state */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function patchQueue(id: string, patch: Partial<QueueItem>) {
    setQueue((q) => q.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;

    const entries: QueueItem[] = files.map((f, i) => ({
      id: `${Date.now()}-${i}-${f.name}`,
      name: f.name,
      progress: 0,
      status: 'pending',
    }));
    setQueue((q) => [...entries, ...q]);
    setUploading(true);

    // Sequential upload keeps per-file progress readable and avoids hammering the server.
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const entry = entries[i];
      try {
        patchQueue(entry.id, { status: 'compressing' });
        const created = await uploadAssetImage(file, {
          onProgress: (pct) => patchQueue(entry.id, { status: 'uploading', progress: pct }),
        });
        patchQueue(entry.id, { status: 'done', progress: 100 });
        setItems((prev) => [created, ...prev]);
      } catch (err) {
        patchQueue(entry.id, {
          status: 'error',
          error: isApiError(err) ? err.message : err instanceof Error ? err.message : 'Upload failed',
        });
      }
    }

    setUploading(false);
    // Clear finished-successfully entries after a short delay; keep errors visible.
    setTimeout(() => setQueue((q) => q.filter((item) => item.status === 'error')), 2500);
  }

  async function handleDelete(image: AssetImage) {
    if (!window.confirm(`Delete "${image.title || image.original_name}"? This cannot be undone.`)) return;
    setDeletingId(image.id);
    try {
      await deleteAssetImage(image.id);
      setItems((prev) => prev.filter((it) => it.id !== image.id));
      setSelected((prev) => { const next = new Set(prev); next.delete(image.id); return next; });
      if (viewer?.image.id === image.id) setViewer(null);
    } catch (err) {
      window.alert(isApiError(err) ? err.message : 'Failed to delete image.');
    } finally {
      setDeletingId(null);
    }
  }

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const allSelected = items.length > 0 && selected.size === items.length;
  function toggleSelectAll() {
    setSelected(allSelected ? new Set() : new Set(items.map((it) => it.id)));
  }

  async function handleBulkDelete() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} selected image${ids.length > 1 ? 's' : ''}? This cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      const res = await bulkDeleteAssetImages(ids);
      const removed = new Set(res.deleted);
      setItems((prev) => prev.filter((it) => !removed.has(it.id)));
      setSelected(new Set());
      if (viewer && removed.has(viewer.image.id)) setViewer(null);
    } catch (err) {
      window.alert(isApiError(err) ? err.message : 'Failed to delete selected images.');
    } finally {
      setBulkDeleting(false);
    }
  }

  return (
    <div className="page-shell plain">
      <div className="page-card wide stack">
        <div className="uploads-header stack-mobile">
          <div>
            <h1 style={{ margin: 0 }}>Asset Image Library</h1>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.82rem' }}>
              Bulk-upload images. Each is stored in high-def (for download) and a light preview (for fast viewing).
              Compression happens in your browser before upload.
            </p>
          </div>
          <button className="button" type="button" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? 'Uploading…' : 'Select Images'}
          </button>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); void handleFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
            background: dragOver ? 'rgba(0,0,0,0.02)' : 'transparent',
            borderRadius: 12, padding: '28px 16px', textAlign: 'center', cursor: 'pointer',
            color: 'var(--muted)', fontSize: '0.88rem', transition: 'border-color 0.15s, background 0.15s',
          }}
        >
          <strong style={{ color: 'var(--fg, inherit)' }}>Drop images here</strong> or click to browse.
          <div style={{ fontSize: '0.76rem', marginTop: 4 }}>JPG, PNG, WebP or GIF · multiple allowed</div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => { if (e.target.files) void handleFiles(e.target.files); e.target.value = ''; }}
          />
        </div>

        {/* Upload queue */}
        {queue.length > 0 && (
          <div className="stack" style={{ gap: 8 }}>
            {queue.map((q) => (
              <div key={q.id} className="row between gap-sm" style={{ alignItems: 'center', fontSize: '0.8rem' }}>
                <span style={{ flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {q.name}
                </span>
                {q.status === 'error' ? (
                  <span className="pill warning" title={q.error}>Failed</span>
                ) : q.status === 'done' ? (
                  <span className="pill success">Done</span>
                ) : (
                  <span style={{ flex: '0 0 140px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                      <span style={{ display: 'block', height: '100%', width: `${q.progress}%`, background: 'var(--accent)', transition: 'width 0.2s' }} />
                    </span>
                    <span style={{ width: 64, textAlign: 'right', color: 'var(--muted)' }}>
                      {q.status === 'compressing' ? 'Compressing' : `${q.progress}%`}
                    </span>
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="row between gap-sm" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <label className="row gap-sm" style={{ alignItems: 'center', fontSize: '0.82rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
              Select all ({items.length})
            </label>
            {selected.size > 0 && (
              <div className="row gap-sm" style={{ alignItems: 'center' }}>
                <span className="muted" style={{ fontSize: '0.82rem' }}>{selected.size} selected</span>
                <button className="button ghost small" type="button" onClick={() => setSelected(new Set())} disabled={bulkDeleting}>
                  Clear
                </button>
                <button className="button small" type="button" onClick={() => void handleBulkDelete()} disabled={bulkDeleting}
                  style={{ background: '#b91c1c' }}>
                  {bulkDeleting ? 'Deleting…' : `Delete Selected (${selected.size})`}
                </button>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="status-card">Loading images…</div>
        ) : items.length === 0 ? (
          <div className="status-card">No images yet. Upload some to get started.</div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: 14,
            }}
          >
            {items.map((img) => {
              const isSelected = selected.has(img.id);
              return (
              <div key={img.id} className="stack" style={{ gap: 8, border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`, boxShadow: isSelected ? '0 0 0 1px var(--accent)' : 'none', borderRadius: 12, padding: 8 }}>
                <div style={{ position: 'relative' }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(img.id)}
                    title="Select"
                    style={{ position: 'absolute', top: 6, left: 6, zIndex: 1, width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--accent)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setViewer({ image: img, mode: 'ld' })}
                    style={{ border: 'none', padding: 0, background: 'none', cursor: 'pointer', borderRadius: 8, overflow: 'hidden', aspectRatio: '1 / 1', display: 'block', width: '100%' }}
                    title="View"
                  >
                    <img
                      src={storageUrl(img.ld_path || img.hd_path)}
                      alt={img.title ?? img.original_name}
                      loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </button>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={img.original_name}>
                  {img.title || img.original_name}
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button className="button small" type="button" onClick={() => setViewer({ image: img, mode: 'ld' })} style={{ flex: 1 }}>
                    View
                  </button>
                  <button className="button secondary small" type="button" onClick={() => triggerDownload(img.id)} title="Download high-def">
                    ↓
                  </button>
                  <button className="button ghost small" type="button" onClick={() => void handleDelete(img)} disabled={deletingId === img.id} title="Delete">
                    {deletingId === img.id ? '…' : '✕'}
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {viewer && (
        <Modal title={viewer.image.title || viewer.image.original_name} onClose={() => setViewer(null)}>
          <div className="stack" style={{ gap: 12 }}>
            <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
              <button
                className={`button small ${viewer.mode === 'ld' ? '' : 'ghost'}`}
                type="button"
                onClick={() => setViewer((v) => (v ? { ...v, mode: 'ld' } : v))}
              >
                Low-def ({formatBytes(viewer.image.ld_size)})
              </button>
              <button
                className={`button small ${viewer.mode === 'hd' ? '' : 'ghost'}`}
                type="button"
                onClick={() => setViewer((v) => (v ? { ...v, mode: 'hd' } : v))}
              >
                High-def ({formatBytes(viewer.image.hd_size)})
              </button>
            </div>

            <div style={{ textAlign: 'center', background: 'var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <img
                src={storageUrl(viewer.mode === 'hd' ? viewer.image.hd_path : viewer.image.ld_path)}
                alt={viewer.image.title ?? viewer.image.original_name}
                style={{ maxWidth: '100%', maxHeight: '65vh', display: 'block', margin: '0 auto' }}
              />
            </div>

            <div className="row between gap-sm" style={{ fontSize: '0.78rem', color: 'var(--muted)', flexWrap: 'wrap' }}>
              <span>
                {viewer.image.width && viewer.image.height ? `${viewer.image.width}×${viewer.image.height}px source · ` : ''}
                Uploaded by {viewer.image.uploaded_by || 'unknown'}
              </span>
              <button className="button secondary small" type="button" onClick={() => triggerDownload(viewer.image.id)}>
                Download High-def
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
