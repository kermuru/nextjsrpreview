'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ImageCropModal from '@/components/ImageCropModal';
import { formatDate, isApiError } from '@/lib/api';
import { fileFromBlob, previewFromFile } from '@/lib/images';
import {
  getLapidaPhotosByDocument,
  getUploadPhotoContext,
  updateLapidaPhoto,
  uploadLapidaPhoto,
  validateLapidaPhoto
} from '@/services/upload-photo';
import type { ReviewContext, UploadInterredPhotoContext } from '@/types/api';

type RecordStatus = 'idle' | 'validating' | 'ready' | 'uploaded' | 'error';

interface UploadRecordState {
  occupant_name: string;
  gender: string;
  uploader_name: string;
  photo: File | null;
  preview: string;
  recordId: number | null;
  editing: boolean;
  status: RecordStatus;
  feedback: string;
}

function getNames(records: ReviewContext[]) {
  return records.map((record) => record.occupant || record.name1 || '').filter(Boolean);
}

function getStatusLabel(status: RecordStatus) {
  switch (status) {
    case 'validating':
      return 'Checking photo';
    case 'ready':
      return 'Ready to submit';
    case 'uploaded':
      return 'Uploaded';
    case 'error':
      return 'Needs attention';
    default:
      return 'Not started';
  }
}

function getStatusClass(status: RecordStatus) {
  switch (status) {
    case 'validating':
      return 'warning';
    case 'ready':
      return 'success';
    case 'uploaded':
      return 'success';
    case 'error':
      return 'error';
    default:
      return 'neutral';
  }
}

export default function PhotoUploadPage({ documentNo }: { documentNo: string }) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [occupantStatus, setOccupantStatus] = useState<'valid' | 'invalid' | 'expired'>('invalid');
  const [occupantMessage, setOccupantMessage] = useState('');
  const [records, setRecords] = useState<UploadRecordState[]>([]);
  const [pageMessage, setPageMessage] = useState('');
  const [pageError, setPageError] = useState('');
  const [intermentDate, setIntermentDate] = useState('');
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [cropIndex, setCropIndex] = useState<number | null>(null);

  useEffect(() => {
    async function loadContext() {
      setLoading(true);
      setPageError('');
      setPageMessage('');

      try {
        const context = await getUploadPhotoContext(documentNo);
        const names = getNames(context);

        setIntermentDate(formatDate(context[0]?.date_interment));
        setRecords(
          names.map((name) => ({
            occupant_name: name,
            gender: '',
            uploader_name: '',
            photo: null,
            preview: '',
            recordId: null,
            editing: false,
            status: 'idle',
            feedback: ''
          }))
        );
        setOccupantStatus('valid');

        try {
          const existing = await getLapidaPhotosByDocument(documentNo);

          setRecords((current) => {
            const next = [...current];

            existing.forEach((photo: UploadInterredPhotoContext) => {
              const index = next.findIndex((item) => item.occupant_name === photo.occupant);

              if (index >= 0) {
                next[index] = {
                  ...next[index],
                  gender: photo.gender || '',
                  uploader_name: photo.uploader_name || '',
                  preview: photo.photo || '',
                  recordId: photo.id ?? null,
                  editing: false,
                  status: photo.photo ? 'uploaded' : 'idle',
                  feedback: photo.photo ? 'A photo has already been uploaded for this occupant.' : ''
                };
              }
            });

            return next;
          });
        } catch {
          // Preserve existing Angular behavior: ignore lookup failures for existing photos.
        }
      } catch (errorValue) {
        if (isApiError(errorValue) && errorValue.status === 403) {
          setOccupantStatus('expired');
          setOccupantMessage('This upload link has expired.');
        } else {
          setOccupantStatus('invalid');
          setOccupantMessage(isApiError(errorValue) ? errorValue.message : 'Invalid link.');
        }
      } finally {
        setLoading(false);
      }
    }

    void loadContext();
  }, [documentNo]);

  const hasAnyRecordValidating = useMemo(
    () => records.some((record) => record.status === 'validating'),
    [records]
  );

  const canSubmit = useMemo(() => {
    return records.some((record) => record.photo || (record.recordId && !record.editing));
  }, [records]);

  function updateRecord(index: number, patch: Partial<UploadRecordState>) {
    setRecords((current) =>
      current.map((record, currentIndex) =>
        currentIndex === index ? { ...record, ...patch } : record
      )
    );
  }

  function setRecordFeedback(index: number, status: RecordStatus, feedback: string) {
    updateRecord(index, { status, feedback });
  }

  async function handleSelectFile(
    index: number,
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    setPageError('');
    setPageMessage('');

    if (!file.type.startsWith('image/')) {
      setRecordFeedback(index, 'error', 'Please choose an image file only.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setRecordFeedback(index, 'error', 'This photo is too large. Please use one under 10MB.');
      return;
    }

    setCropIndex(index);
    setCropSource(await previewFromFile(file, 1400));
  }

  async function handleCropConfirm(blob: Blob) {
    if (cropIndex === null) return;

    const currentIndex = cropIndex;
    const occupant = records[currentIndex];

    const croppedFile = fileFromBlob(
      blob,
      `${occupant.occupant_name || 'photo'}.jpg`,
      'image/jpeg'
    );

    const preview = await previewFromFile(croppedFile, 1000);

    updateRecord(currentIndex, {
      preview,
      photo: null,
      editing: true,
      status: 'validating',
      feedback: 'Checking photo quality...'
    });

    try {
      const formData = new FormData();
      formData.append('photo', croppedFile);

      const response = await validateLapidaPhoto(formData);
      const item = Array.isArray(response) ? response[0] : response;
      const result = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};

      const output =
        typeof result.output === 'string' ? result.output : 'Photo validation finished.';
      const isValid = result.is_valid === true || result.is_valid === 1;

      if (!isValid) {
        updateRecord(currentIndex, {
          photo: null,
          preview: '',
          editing: true,
          status: 'error',
          feedback: output
        });
      } else {
        updateRecord(currentIndex, {
          photo: croppedFile,
          preview,
          editing: true,
          status: 'ready',
          feedback: output
        });
      }
    } catch {
      updateRecord(currentIndex, {
        photo: null,
        preview: '',
        editing: true,
        status: 'error',
        feedback: 'We could not validate this photo right now. Please try again.'
      });
    } finally {
      setCropSource(null);
      setCropIndex(null);
    }
  }

  function handleEditRecord(index: number) {
    setPageError('');
    setPageMessage('');

    updateRecord(index, {
      editing: true,
      photo: null,
      status: 'idle',
      feedback: 'Please choose a new photo.'
    });
  }

  function handleRemoveSelectedPhoto(index: number) {
    updateRecord(index, {
      photo: null,
      preview: '',
      editing: true,
      status: 'idle',
      feedback: ''
    });
  }

  async function submit() {
    setPageError('');
    setPageMessage('');

    const activeRecords = records.filter((record) => record.photo || (record.recordId && !record.editing));

    if (!activeRecords.length) {
      setPageMessage('No changes to upload.');
      return;
    }

    const hasMissingRequiredFields = activeRecords.some(
      (record) => !record.uploader_name.trim() || !record.gender.trim()
    );

    if (hasMissingRequiredFields) {
      setPageError('Please complete the uploader name and gender for every photo before submitting.');
      return;
    }

    const updateRequests: Promise<unknown>[] = [];
    const createForm = new FormData();
    createForm.append('document_no', documentNo);

    let createIndex = 0;

    records.forEach((record) => {
      if (record.recordId && record.editing && record.photo) {
        const formData = new FormData();
        formData.append('photo', record.photo);
        formData.append('uploader_name', record.uploader_name.trim());
        formData.append('gender', record.gender);

        updateRequests.push(updateLapidaPhoto(record.recordId, formData));
      } else if (!record.recordId && record.photo) {
        createForm.append(`occupants[${createIndex}][occupant_name]`, record.occupant_name);
        createForm.append(`occupants[${createIndex}][gender]`, record.gender);
        createForm.append(`occupants[${createIndex}][uploader_name]`, record.uploader_name.trim());
        createForm.append(`occupants[${createIndex}][photo]`, record.photo);
        createIndex += 1;
      }
    });

    if (createIndex > 0) {
      updateRequests.unshift(uploadLapidaPhoto(createForm));
    }

    if (!updateRequests.length) {
      setPageMessage('No changes to upload.');
      return;
    }

    setSaving(true);

    try {
      await Promise.all(updateRequests);

      const fresh = await getLapidaPhotosByDocument(documentNo);

      setRecords((current) =>
        current.map((record) => {
          const existing = fresh.find((item) => item.occupant === record.occupant_name);

          if (!existing) return record;

          return {
            ...record,
            preview: existing.photo || record.preview,
            recordId: existing.id ?? null,
            editing: false,
            photo: null,
            uploader_name: existing.uploader_name || record.uploader_name,
            gender: existing.gender || record.gender,
            status: existing.photo ? 'uploaded' : record.status,
            feedback: existing.photo
              ? 'Photo uploaded successfully.'
              : record.feedback
          };
        })
      );

      setPageMessage('All photos were uploaded or updated successfully.');
    } catch (errorValue) {
      setPageError(isApiError(errorValue) ? errorValue.message : 'Upload failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-shell">
      <div className="center-column stack">
        <div className="hero-logo">
          <img src="/logo.png" alt="Renaissance Park logo" />
        </div>

        {loading ? <div className="page-card narrow centered">Loading upload link...</div> : null}

        {!loading && occupantStatus !== 'valid' ? (
          <div className="page-card narrow status-card error centered"
          
             style={{
              fontSize: '32px',
              fontFamily: 'Playfair Display',
              fontWeight: 500
            }}

          >{occupantMessage}</div>
        ) : null}

        {!loading && occupantStatus === 'valid' ? (
          <div className="page-card wide stack">
            <div className="centered stack" style={{ gap: 8 }}>
              <h1 style={{ margin: 0 }}>A Space to Remember</h1>
              <p className="muted" style={{ margin: 0 }}>
                Please choose one clear photo per occupant. The face should be sharp,
                centered, and shown from the lower chest upward.
              </p>

            </div>

            {pageMessage ? <div className="status-card success">{pageMessage}</div> : null}
            {pageError ? <div className="status-card error">{pageError}</div> : null}

            <div className="stack">
              {records.map((record, index) => {
                const statusLabel = getStatusLabel(record.status);
                const statusClass = getStatusClass(record.status);

                return (
                  <div
                    key={record.occupant_name}
                    className="page-card occupant-card"
                    style={{ padding: 18 }}
                  >
                    <div className="stack">
                      <div
                        className="row"
                        style={{
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: 12
                        }}
                      >
                        <div className="stack" style={{ gap: 4 }}>
                          <div>
                            <strong>Occupant:</strong> {record.occupant_name}
                                          {intermentDate ? (
                              <p style={{ margin: 0 }}>
                                <strong>Date of Interment:</strong> {intermentDate}
                              </p>
                            ) : null}
                          </div>
                          <div className="helper">
                            Upload one clear photo for this occupant.
                          </div>
                        </div>

                        {/* <span className={`status-pill ${statusClass}`}>{statusLabel}</span> */}
                      </div>

                      {record.feedback ? (
                        <div
                          className={`status-card ${
                            record.status === 'error' ? 'error' : 'success'
                          }`}
                        >
                          {record.feedback}
                        </div>
                      ) : null}

                      {record.preview && !record.editing ? (
                        <div className="preview-frame stack centered">
                          <img src={record.preview} alt={record.occupant_name} />
                          <div
                            className="row action-row"
                            style={{ justifyContent: 'center' }}
                          >
                            <button
                              className="button ghost small"
                              type="button"
                              onClick={() => handleEditRecord(index)}
                              disabled={saving}
                            >
                              Edit / Replace Photo
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="stack">
                          <div className="stack" style={{ gap: 12 }}>
                            <div className="stack" style={{ gap: 6 }}>
                              <label className="helper" htmlFor={`uploader_name_${index}`}>
                                Your full name
                              </label>
                              <input
                                id={`uploader_name_${index}`}
                                className="input"
                                value={record.uploader_name}
                                onChange={(event) =>
                                  updateRecord(index, { uploader_name: event.target.value })
                                }
                                placeholder="Enter your full name"
                                disabled={saving || record.status === 'validating'}
                              />
                            </div>

                            <div className="stack" style={{ gap: 6 }}>
                              <label className="helper" htmlFor={`gender_${index}`}>
                                Gender of the deceased
                              </label>
                              <select
                                id={`gender_${index}`}
                                className="select"
                                value={record.gender}
                                onChange={(event) =>
                                  updateRecord(index, { gender: event.target.value })
                                }
                                disabled={saving || record.status === 'validating'}
                              >
                                <option value="">Select gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Unknown">Unknown</option>
                              </select>
                            </div>
                          </div>

                          <label className="upload-dropzone">
                            <strong>Lapida Photo</strong>
                            <div className="helper">
                              Tap to choose a photo from your camera or gallery.
                            </div>
                            <div className="helper">
                              Accepted: image files only, maximum 10MB.
                            </div>

                            <input
                              type="file"
                              accept="image/*"
                              onChange={(event) => void handleSelectFile(index, event)}
                              style={{ display: 'block', marginTop: 12, width: '100%' }}
                              disabled={saving || record.status === 'validating'}
                            />
                          </label>

                          {record.preview ? (
                            <div className="preview-frame stack centered">
                              <img
                                src={record.preview}
                                alt={`${record.occupant_name} preview`}
                              />
                              <div
                                className="row action-row"
                                style={{ justifyContent: 'center' }}
                              >
                                <button
                                  className="button danger small"
                                  type="button"
                                  onClick={() => handleRemoveSelectedPhoto(index)}
                                  disabled={saving || record.status === 'validating'}
                                >
                                  Remove photo
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              className="stack"
              style={{ alignItems: 'stretch', width: '100%', maxWidth: 420, margin: '0 auto' }}
            >
              <button
                className="button secondary"
                type="button"
                onClick={() => void submit()}
                disabled={saving || hasAnyRecordValidating || !canSubmit}
                style={{ width: '100%' }}
              >
                {saving ? 'Uploading...' : 'Submit Photo'}
              </button>

              <button
                className="button ghost"
                type="button"
                onClick={() => router.push(`/interments/${documentNo}`)}
                disabled={saving || hasAnyRecordValidating}
                style={{ width: '100%' }}
              >
                Back to Home
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {cropSource ? (
        <ImageCropModal
          title="Crop Photo (Chest Up)"
          sourceUrl={cropSource}
          aspect={1}
          onCancel={() => {
            setCropSource(null);
            setCropIndex(null);
          }}
          onConfirm={handleCropConfirm}
        />
      ) : null}
    </div>
  );
}