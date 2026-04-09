'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ImageCropModal from '@/components/ImageCropModal';
import LoadingOverlay from '@/components/LoadingOverlay';
import { formatDate, isApiError } from '@/lib/api';
import { addPatternBorder, fileFromBlob, needsCrop, previewFromFile, readFileAsDataUrl, resizeImageFile } from '@/lib/images';
import {
  checkSlideshowOrientation,
  deleteSlideshowPhoto,
  getSlideshowByDocument,
  getSlideshowContext,
  uploadSlideshow
} from '@/services/slideshow';
import type { ReviewContext } from '@/types/api';

interface SlideshowImage {
  file: File;
  preview: string;
  needsCrop?: boolean;
  needsRotation?: boolean;
}

export default function SlideshowPage({ documentNo }: { documentNo: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploaderName, setUploaderName] = useState('');
  const [email, setEmail] = useState('');
  const [occupantName, setOccupantName] = useState('');
  const [intermentDate, setIntermentDate] = useState('');
  const [occupantStatus, setOccupantStatus] = useState<'valid' | 'invalid' | 'expired'>('invalid');
  const [occupantMessage, setOccupantMessage] = useState('');
  const [slideshowId, setSlideshowId] = useState<number | null>(null);
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [images, setImages] = useState<SlideshowImage[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [cropIndex, setCropIndex] = useState<number | null>(null);
  const [cropSource, setCropSource] = useState<string | null>(null);

  const MAX_PHOTOS = 50;
  const BATCH_SIZE = 5;
  const ALLOWED_TYPES = ['image/jpeg', 'image/png'];

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const context = await getSlideshowContext(documentNo);
        const record = Array.isArray(context) ? context[0] : null;
        if (!record) {
          setOccupantStatus('invalid');
          setOccupantMessage('Invalid or unavailable link.');
          return;
        }
        setOccupantName(record.occupant || record.name1 || '');
        setIntermentDate(formatDate(record.date_interment));
        setOccupantStatus('valid');

        try {
          const existing = await getSlideshowByDocument(documentNo);
          setExistingPhotos(existing.photo ?? []);
          setSlideshowId(existing.id ?? null);
          setUploaderName(existing.uploader_name ?? '');
          setEmail(existing.email_add ?? '');
        } catch {
          setExistingPhotos([]);
          setSlideshowId(null);
        }
      } catch (errorValue) {
        if (isApiError(errorValue) && errorValue.status === 403) {
          setOccupantStatus('expired');
          setOccupantMessage('This link has expired.');
        } else {
          setOccupantStatus('invalid');
          setOccupantMessage('Invalid or unavailable link.');
        }
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [documentNo]);

  const availableSlots = useMemo(() => MAX_PHOTOS - (existingPhotos.length + images.length), [existingPhotos.length, images.length]);

  async function processFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(event.target.files ?? []);
    if (!incoming.length) return;
    setError('');
    setMessage('');
    setProcessing(true);
    setProcessingProgress(0);

    const filesToProcess = incoming.slice(0, Math.max(availableSlots, 0));
    const nextImages: SlideshowImage[] = [];

    for (let index = 0; index < filesToProcess.length; index += 1) {
      const file = filesToProcess[index];
      if (!ALLOWED_TYPES.includes(file.type)) {
        setProcessingProgress(Math.round(((index + 1) / filesToProcess.length) * 100));
        continue;
      }

      try {
        const resizedForAi = await resizeImageFile(file, 768);
        const resizedForPreview = await resizeImageFile(file, 2048);
        const formData = new FormData();
        formData.append('photo', resizedForAi);
        const response = await checkSlideshowOrientation(formData);
        const raw = Array.isArray(response) ? response[0] : response;
        const result = raw && typeof raw === 'object' && 'body' in (raw as Record<string, unknown>) ? (raw as Record<string, unknown>).body : raw;
        const output = result && typeof result === 'object' ? (result as Record<string, unknown>) : {};

        if (Number(output.autodelete) === 1) {
          setProcessingProgress(Math.round(((index + 1) / filesToProcess.length) * 100));
          continue;
        }

        const preview = await previewFromFile(resizedForPreview, 800);
        const imageUrl = await readFileAsDataUrl(resizedForPreview);
        const image = new Image();
        const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
          image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
          image.onerror = () => reject(new Error('Unable to inspect image.'));
          image.src = imageUrl;
        });

        nextImages.push({
          file: resizedForPreview,
          preview,
          needsCrop: needsCrop(size.width, size.height),
          needsRotation: Number(output.upright) === 0
        });
      } catch {
        // Ignore single-file failures to match the Angular behavior.
      } finally {
        setProcessingProgress(Math.round(((index + 1) / filesToProcess.length) * 100));
      }
    }

    setImages((current) => [...current, ...nextImages]);
    setProcessing(false);
    event.target.value = '';
  }

  async function openCrop(index: number) {
    setCropIndex(index);
    setCropSource(await readFileAsDataUrl(images[index].file));
  }

  async function confirmCrop(blob: Blob) {
    if (cropIndex === null) return;
    const current = images[cropIndex];
    const nextFile = fileFromBlob(blob, current.file.name, 'image/jpeg');
    const preview = await previewFromFile(nextFile, 800);
    setImages((all) =>
      all.map((item, index) =>
        index === cropIndex
          ? { ...item, file: nextFile, preview, needsCrop: false, needsRotation: false }
          : item
      )
    );
    setCropIndex(null);
    setCropSource(null);
  }

  async function removeExisting(photoUrl: string) {
    if (!slideshowId) return;
    try {
      const response = await deleteSlideshowPhoto(slideshowId, photoUrl);
      setExistingPhotos(response.photos ?? []);
    } catch {
      setError('Failed to delete photo.');
    }
  }

  async function submit() {
    setError('');
    setMessage('');

    if (!uploaderName.trim() || !email.trim()) {
      setError('Please complete all required fields correctly.');
      return;
    }

    if (!images.length) {
      setError('Please select at least one slideshow photo to upload.');
      return;
    }

    setSaving(true);
    setUploadProgress(0);

    try {
      const totalBatches = Math.ceil(images.length / BATCH_SIZE);
      let processedCount = 0;
      let uploadedCount = 0;

      for (let start = 0; start < images.length; start += BATCH_SIZE) {
        const batch = images.slice(start, start + BATCH_SIZE);
        const processedFiles: File[] = [];

        for (const image of batch) {
          const bordered = await addPatternBorder(image.file, '/gold.PNG');
          processedFiles.push(bordered);
          processedCount += 1;
          setUploadProgress(Math.round((processedCount / images.length) * 50));
        }

        const formData = new FormData();
        formData.append('document_no', documentNo);
        formData.append('uploader_name', uploaderName.trim());
        formData.append('email_add', email.trim());
        processedFiles.forEach((file) => formData.append('photo[]', file, file.name));
        await uploadSlideshow(formData);
        uploadedCount += 1;
        setUploadProgress(50 + Math.round((uploadedCount / totalBatches) * 50));
      }

      setMessage('Upload successful.');
      setImages([]);
      const existing = await getSlideshowByDocument(documentNo);
      setExistingPhotos(existing.photo ?? []);
      setSlideshowId(existing.id ?? null);
    } catch (errorValue) {
      setError(isApiError(errorValue) ? errorValue.message : 'Upload failed. Please retry.');
    } finally {
      setSaving(false);
      setUploadProgress(0);
    }
  }

  return (
    <div className="page-shell">
      <div className="center-column stack">
        <div className="hero-logo">
          <img src="/logo.png" alt="Renaissance Park logo" />
        </div>

        {loading ? <div className="page-card narrow centered">Loading slideshow link...</div> : null}

        {!loading && occupantStatus !== 'valid' ? (
          <div className="page-card narrow centered status-card error"
          style={{
              fontSize: '32px',
              fontFamily: 'Playfair Display',
              fontWeight: 500
            }}
            >{occupantMessage}</div>
        ) : null}

        {!loading && occupantStatus === 'valid' ? (
          <div className="page-card wide stack">
            <div className="centered">
              <h1 style={{ marginBottom: 8 }}>Upload Photos for Slideshow</h1>
              <p className="muted" style={{ marginTop: 0 }}>Occupant: <strong>{occupantName}</strong></p>
              {intermentDate ? <p className="muted">Date of Interment: <strong>{intermentDate}</strong></p> : null}
            </div>

            <div className="two-column">
              <input className="input" value={uploaderName} onChange={(event) => setUploaderName(event.target.value)} placeholder="Your full name" />
              <input className="input" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Your email address" type="email" />
              <p className="muted" style={{ marginTop: 0, fontSize: "80%", paddingLeft: 10 }}>
                Used to access and manage the interment photos.
              </p>
            </div>

            <div className="status-card">
              <strong>Photo guide</strong>
              <div className="helper" style={{ marginTop: 8 }}>
                Use clear portraits or landscape photos, avoid very tall or very wide crops, and rotate/crop any image flagged below.
              </div>
            </div>

            <label className="upload-dropzone">
              <strong>Select Photos</strong>
              <div className="helper">Max {MAX_PHOTOS} images. {availableSlots} slot(s) remaining.</div>
              <input type="file" accept=".jpg,.jpeg,.png" multiple onChange={(event) => void processFiles(event)} style={{ display: 'block', marginTop: 12 }} />
            </label>

            {images.length ? (
              <div className="gallery">
                {images.map((image, index) => (
                  <div key={`${image.file.name}-${index}`} className="gallery-item">
                    <img src={image.preview} alt={image.file.name} />
                    <div className="overlay-actions">
                      {(image.needsCrop || image.needsRotation) ? (
                        <button className="button secondary small" type="button" onClick={() => void openCrop(index)}>
                          Fix
                        </button>
                      ) : null}
                      <button className="button danger small" type="button" onClick={() => setImages((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                        Remove
                      </button>
                    </div>
                    <div className="stack" style={{ marginTop: 10 }}>
                      {image.needsCrop ? <span className="pill warning">Needs crop</span> : null}
                      {image.needsRotation ? <span className="pill warning">Needs rotation</span> : null}
                      {!image.needsCrop && !image.needsRotation ? <span className="pill success">Ready</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {existingPhotos.length ? (
              <div className="stack">
                <h2 style={{ marginBottom: 0 }}>Existing Slideshow Photos</h2>
                <div className="gallery">
                  {existingPhotos.map((photo) => (
                    <div key={photo} className="gallery-item">
                      <img src={photo} alt="Existing slideshow" />
                      <div className="overlay-actions">
                        <button className="button danger small" type="button" onClick={() => void removeExisting(photo)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {message ? <div className="status-card success">{message}</div> : null}
            {error ? <div className="status-card error">{error}</div> : null}

            <div className="row" style={{ justifyContent: 'center' }}>
              <button className="button secondary" type="button" onClick={() => void submit()} disabled={saving}>
                {saving ? 'Uploading...' : 'Upload Photos'}
              </button>
              <button className="button ghost" type="button" onClick={() => router.push(`/interments/${documentNo}`)}>
                Back to Home
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {processing ? <LoadingOverlay label={`Processing photos... ${processingProgress}%`} progress={processingProgress} /> : null}
      {saving ? <LoadingOverlay label={`Uploading photos... ${uploadProgress}%`} progress={uploadProgress} /> : null}
      {cropSource ? (
        <ImageCropModal
          title="Crop slideshow photo"
          sourceUrl={cropSource}
          allowRotate
          onCancel={() => {
            setCropIndex(null);
            setCropSource(null);
          }}
          onConfirm={confirmCrop}
        />
      ) : null}
    </div>
  );
}
