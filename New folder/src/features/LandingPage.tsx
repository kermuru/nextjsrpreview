'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDate, isApiError } from '@/lib/api';
import { getInterment } from '@/services/interments';
import type { ReviewContext } from '@/types/api';

function extractNames(records: ReviewContext[]): string[] {
  return records.map((record) => record.occupant || record.name1 || '').filter(Boolean);
}

export default function LandingPage({ initialDocumentNo = '' }: { initialDocumentNo?: string }) {
  const router = useRouter();
  const [documentNo, setDocumentNo] = useState(initialDocumentNo);
  const [occupantStatus, setOccupantStatus] = useState<'valid' | 'wrongLink' | 'expired' | 'none'>(initialDocumentNo ? 'none' : 'none');
  const [occupantNames, setOccupantNames] = useState<string[]>([]);
  const [intermentDate, setIntermentDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [occupantMessage, setOccupantMessage] = useState('');

  useEffect(() => {
    if (initialDocumentNo) {
      void checkDocumentLink(initialDocumentNo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDocumentNo]);

  async function checkDocumentLink(value = documentNo) {
    const trimmed = value.trim();
    if (!trimmed) {
      setOccupantStatus('none');
      setOccupantNames([]);
      setIntermentDate('');
      setOccupantMessage('');
      return;
    }

    setLoading(true);
    setOccupantMessage('');

    try {
      const records = await getInterment(trimmed);
      setDocumentNo(trimmed);
      setOccupantNames(extractNames(records));
      setIntermentDate(formatDate(records[0]?.date_interment));
      setOccupantStatus('valid');
      if (!initialDocumentNo) {
        router.replace(`/interments/${trimmed}`);
      }
    } catch (error) {
      if (isApiError(error) && error.status === 403) {
        setOccupantStatus('expired');
        setOccupantMessage('This link has expired. Please contact the team for assistance.');
      } else {
        setOccupantStatus('wrongLink');
        setOccupantMessage('No records were found for this document number.');
      }
    } finally {
      setLoading(false);
    }
  }

  function goTo(path: string) {
    const trimmed = documentNo.trim();
    if (!trimmed) return;
    router.push(`${path}/${trimmed}`);
  }

  return (
    <div className="page-shell">
      <div className="center-column stack">
        <div className="hero-logo">
          <img src="/logo.png" alt="Renaissance Park logo" />
        </div>

        <div className="page-card narrow stack centered">
          <h1 style={{ margin: 0 }}>A Place to Remember</h1>
          <p className="muted" style={{ margin: 0 }}>
            Honor your loved one with care and respect. Share a review, upload a Lapida photo, or send slideshow photos.
          </p>

          <div className="stack" style={{ textAlign: 'left' }}>
            <label htmlFor="documentNo">Document Number</label>
            <div className="row">
              <input
                id="documentNo"
                className="input"
                value={documentNo}
                onChange={(event) => setDocumentNo(event.target.value)}
                placeholder="Enter document number"
              />
              <button className="button" type="button" onClick={() => void checkDocumentLink()} disabled={loading}>
                {loading ? 'Checking...' : 'Open'}
              </button>
            </div>
          </div>

          {occupantStatus === 'wrongLink' || occupantStatus === 'expired' ? (
            <div className="status-card error">{occupantMessage}</div>
          ) : null}

          {occupantStatus === 'none' ? (
            <div className="status-card">Use a valid document number to continue.</div>
          ) : null}

          {occupantStatus === 'valid' ? (
            <div className="stack">
              <div className="status-card success">
                <ul className="list">
                  {occupantNames.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
                <p style={{ marginBottom: 0 }}><strong>Date of Interment:</strong> {intermentDate}</p>
              </div>

              <div className="link-grid">
                <button className="button secondary" type="button" onClick={() => goTo('/intermentsReviewLink')}>
                  Share a Review
                </button>
                <button className="button secondary" type="button" onClick={() => goTo('/intermentsUploadInterredPhotoLink_ForPost')}>
                  Upload Lapida Photo
                </button>
                <button className="button secondary" type="button" onClick={() => goTo('/slideshow')}>
                  Upload Slideshow Photos
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
