'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isApiError } from '@/lib/api';
import { getLinks, storeLinks, updateLink, validateDocument } from '@/services/photolink';
import type { PhotoLinkRecord } from '@/types/api';

function emptyLink() {
  return { link: '', photographer_name: '' };
}

export default function PhotoLinkPage({ documentNo }: { documentNo: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [documentValid, setDocumentValid] = useState(false);
  const [occupantName, setOccupantName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [links, setLinks] = useState([emptyLink()]);
  const [savedLinks, setSavedLinks] = useState<PhotoLinkRecord[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLink, setEditLink] = useState('');
  const [editPhotographer, setEditPhotographer] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const result = await validateDocument(documentNo);
        setDocumentValid(true);
        if (Array.isArray(result) && result[0] && typeof result[0] === 'object') {
          const first = result[0] as Record<string, unknown>;
          setOccupantName(typeof first.occupant === 'string' ? first.occupant : '');
        }
        const existing = await getLinks(documentNo);
        setSavedLinks(existing);
      } catch (errorValue) {
        setDocumentValid(false);
        setSavedLinks([]);
        setError(isApiError(errorValue) ? errorValue.message : 'Invalid document number. Upload is disabled.');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [documentNo]);

  function updateFormRow(index: number, patch: Partial<{ link: string; photographer_name: string }>) {
    setLinks((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setLinks((current) => [...current, emptyLink()]);
  }

  function removeRow(index: number) {
    setLinks((current) => (current.length > 1 ? current.filter((_, rowIndex) => rowIndex !== index) : current));
  }

  async function saveLinks() {
    setMessage('');
    setError('');

    if (!documentValid) {
      setError('Invalid document number. Cannot save links.');
      return;
    }

    if (savedLinks.length) {
      setError('Links already exist for this document number. Please edit the saved record instead.');
      return;
    }

    const hasInvalid = links.some((row) => !row.link.trim() || !row.photographer_name.trim());
    if (hasInvalid) {
      setError('Please fill all fields correctly.');
      return;
    }

    setLoading(true);
    try {
      const result = await storeLinks(documentNo, links.map((row) => ({ link: row.link.trim(), photographer_name: row.photographer_name.trim() })));
      setSavedLinks(result);
      setMessage('Link saved successfully.');
      setLinks([emptyLink()]);
    } catch (errorValue) {
      setError(isApiError(errorValue) ? errorValue.message : 'Failed to save link.');
    } finally {
      setLoading(false);
    }
  }

  function beginEdit(item: PhotoLinkRecord) {
    setEditingId(item.id ?? null);
    setEditLink(item.link);
    setEditPhotographer(item.photographer_name);
    setMessage('');
    setError('');
  }

  async function saveEdit(item: PhotoLinkRecord) {
    if (!item.id) {
      setError('Invalid record ID.');
      return;
    }
    if (!editLink.trim() || !editPhotographer.trim()) {
      setError('Please fill all edit fields correctly.');
      return;
    }

    setLoading(true);
    try {
      const result = await updateLink(item.id, { link: editLink.trim(), photographer_name: editPhotographer.trim() });
      setSavedLinks((current) => current.map((saved) => (saved.id === item.id ? result : saved)));
      setMessage('Link updated successfully.');
      setEditingId(null);
    } catch (errorValue) {
      setError(isApiError(errorValue) ? errorValue.message : 'Failed to update link.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-shell plain">
      <div className="center-column stack">
        <div className="page-card wide stack">
          <div>
            <h1 style={{ marginBottom: 8 }}>Upload Photo Folder Link</h1>
            <p className="muted" style={{ marginTop: 0 }}>Document No: <strong>{documentNo}</strong></p>
            {occupantName ? <p className="muted">Occupant: <strong>{occupantName}</strong></p> : null}
          </div>

          {message ? <div className="status-card success">{message}</div> : null}
          {error ? <div className="status-card error">{error}</div> : null}
          {loading ? <div className="status-card">Processing...</div> : null}

          {!savedLinks.length && documentValid ? (
            <div className="stack">
              {links.map((row, index) => (
                <div key={index} className="two-column">
                  <input className="input" value={row.link} onChange={(event) => updateFormRow(index, { link: event.target.value })} placeholder="Folder link" />
                  <input className="input" value={row.photographer_name} onChange={(event) => updateFormRow(index, { photographer_name: event.target.value })} placeholder="Photographer name" />
                  <div className="row">
                    <button className="button ghost small" type="button" onClick={() => removeRow(index)} disabled={links.length === 1}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              <div className="row">
                <button className="button ghost" type="button" onClick={addRow}>Add Another Link</button>
                <button className="button secondary" type="button" onClick={() => void saveLinks()}>Save Link(s)</button>
              </div>
            </div>
          ) : null}

          {savedLinks.length ? (
            <div className="stack">
              <h2 style={{ marginBottom: 0 }}>Saved Links</h2>
              {savedLinks.map((item) => (
                <div key={item.id ?? item.link} className="page-card" style={{ padding: 18 }}>
                  {editingId === item.id ? (
                    <div className="stack">
                      <input className="input" value={editLink} onChange={(event) => setEditLink(event.target.value)} />
                      <input className="input" value={editPhotographer} onChange={(event) => setEditPhotographer(event.target.value)} />
                      <div className="row">
                        <button className="button secondary small" type="button" onClick={() => void saveEdit(item)}>Save</button>
                        <button className="button ghost small" type="button" onClick={() => setEditingId(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="stack">
                      <div><strong>Link:</strong> <a href={item.link} target="_blank" rel="noreferrer">{item.link}</a></div>
                      <div><strong>Photographer:</strong> {item.photographer_name}</div>
                      <div className="row">
                        <button className="button ghost small" type="button" onClick={() => beginEdit(item)}>Edit</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : null}

          <div className="row">
            <button className="button ghost" type="button" onClick={() => router.push(`/interments/${documentNo}`)}>Back to Home</button>
          </div>
        </div>
      </div>
    </div>
  );
}
