'use client';

import { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/Modal';
import Pagination from '@/components/Pagination';
import { downloadRemoteFile } from '@/lib/images';
import { getAllLapidaUploads, intermentPhotoUrl } from '@/services/upload-photo';
import { dressUpload, revertUpload } from '@/services/barong-editor';
import type { BarongUpload } from '@/services/barong-editor';
import { isApiError } from '@/lib/api';
import type { UploadInterredPhotoContext } from '@/types/api';


/**
 * The dress/revert endpoints answer in the Barong shape; this dashboard's rows
 * are UploadInterredPhotoContext. Map only the fields that actually change, so a
 * refresh of one row never clobbers the rest of it.
 */
function toRecord(p: BarongUpload): Partial<UploadInterredPhotoContext> {
  return {
    photo: p.photo_url ?? undefined,
    original_photo: p.original_url,
    barong_edit_id: p.barong_edit_id,
    gdrive_link: p.gdrive_link,
    barong_error: p.drive_error,
  };
}

export default function UploadsAdminPage() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<UploadInterredPhotoContext[]>([]);
  const [searchText, setSearchText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selected, setSelected] = useState<UploadInterredPhotoContext | null>(null);

  // Barong review actions, driven from this inspector so a dressed photo can be
  // judged and undone in the same place it is viewed.
  const [barongBusy, setBarongBusy] = useState(false);
  const [barongMsg, setBarongMsg] = useState<string | null>(null);
  const [barongErr, setBarongErr] = useState<string | null>(null);

  async function runDress(id: number, alreadyDressed: boolean) {
    const warn = alreadyDressed
      ? 'Re-dress this photo? This pays for another edit and replaces the current one, starting again from the family\'s original.'
      : 'Dress this photo? This is a paid edit, and it replaces the photo suppliers receive from their next service order onward. The original is kept.';
    if (!window.confirm(warn)) return;

    setBarongBusy(true); setBarongErr(null); setBarongMsg('Generating… this takes 1–3 minutes.');
    try {
      const r = await dressUpload(id, alreadyDressed);
      // Refresh both the row in the table and the open inspector.
      setRecords((cur) => cur.map((x) => (x.id === id ? { ...x, ...toRecord(r.photo) } : x)));
      setSelected((cur) => (cur && cur.id === id ? { ...cur, ...toRecord(r.photo) } : cur));
      setBarongMsg(r.photo.gdrive_link ? 'Dressed and archived to Drive.' : 'Dressed.');
    } catch (e: unknown) {
      setBarongErr(isApiError(e) ? e.message : 'The edit failed.');
      setBarongMsg(null);
    } finally {
      setBarongBusy(false);
    }
  }

  async function runRevert(id: number) {
    if (!window.confirm('Restore the family\'s original photo? Suppliers will receive it again from the next service order.')) return;

    setBarongBusy(true); setBarongErr(null);
    try {
      const r = await revertUpload(id);
      setRecords((cur) => cur.map((x) => (x.id === id ? { ...x, ...toRecord(r.photo) } : x)));
      setSelected((cur) => (cur && cur.id === id ? { ...cur, ...toRecord(r.photo) } : cur));
      setBarongMsg('Original restored.');
    } catch (e: unknown) {
      setBarongErr(isApiError(e) ? e.message : 'Could not revert.');
    } finally {
      setBarongBusy(false);
    }
  }

  useEffect(() => {
    async function load() {
      try {
        setRecords(await getAllLapidaUploads());
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const filtered = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    if (!keyword) return records;

    return records.filter((record) =>
      record.document_no?.toLowerCase().includes(keyword) ||
      record.occupant?.toLowerCase().includes(keyword) ||
      record.uploader_name?.toLowerCase().includes(keyword)
    );
  }, [records, searchText]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / 5));
  const paginated = filtered.slice((currentPage - 1) * 5, currentPage * 5);

  return (
    <div className="page-shell plain">
      <div className="">
        <div className="page-card wide stack">
          <div className="uploads-header stack-mobile">
            <h1 style={{ margin: 0 }} className="centered-mobile">
              Lapida Dashboard
            </h1>

            <input
              className="input uploads-search"
              value={searchText}
              onChange={(event) => {
                setSearchText(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search document, occupant or uploader"
            />
          </div>

          {loading ? <div className="status-card">Loading uploads...</div> : null}

          {!loading && paginated.length === 0 ? (
            <div className="status-card">No matching uploads found.</div>
          ) : null}

          {!loading && paginated.length > 0 ? (
            <>
              <div className="desktop-only table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Document No</th>
                      <th>Occupant</th>
                      <th>Uploader</th>
                      <th></th>
                      <th>Action</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((record) => (
                      <tr key={`${record.id}-${record.document_no}-${record.occupant}`}>
                        <td>{record.document_no || '-'}</td>
                        <td>{record.occupant || '-'}</td>
                        <td>{record.uploader_name || '-'}</td>
                        <td>
                          {/* <span
                            className={
                              record.is_valid === 1 ? 'pill success' : 'pill warning'
                            }
                          >
                            {record.is_valid === 1 ? 'Approved' : 'Pending'}
                          </span> */}
                        </td>
                        <td>
                          <button
                            className="button small"
                            type="button"
                            onClick={() => setSelected(record)}
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mobile-only upload-cards stack">
                {paginated.map((record) => (
                  <div
                    key={`${record.id}-${record.document_no}-${record.occupant}`}
                    className="upload-record-card stack"
                  >
                    <div className="row between gap-sm">
                      <strong>{record.occupant || 'No occupant'}</strong>
                      <span
                        className={
                          record.is_valid === 1 ? 'pill success' : 'pill warning'
                        }
                      >
                        {record.is_valid === 1 ? 'Approved' : 'Pending'}
                      </span>
                    </div>

                    <div className="upload-record-block">
                      <span className="helper">Document No</span>
                      <div className="upload-record-value">
                        {record.document_no || '-'}
                      </div>
                    </div>

                    <div className="upload-record-block">
                      <span className="helper">Uploader</span>
                      <div className="upload-record-value">
                        {record.uploader_name || '-'}
                      </div>
                    </div>

                    <button
                      className="button"
                      type="button"
                      onClick={() => setSelected(record)}
                    >
                      Open Upload
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onChange={setCurrentPage}
          />
        </div>
      </div>

      {selected ? (
        <Modal title="Lapida Upload Inspector" onClose={() => setSelected(null)}>
          <div className="stack">
            <div className="preview-frame stack">
              <strong>
                {selected.original_photo ? 'Sent to supplier (dressed)' : 'Uploaded Photo'}
              </strong>

              {selected.photo ? (
                <img src={selected.photo} alt={selected.occupant || 'Upload'} />
              ) : (
                <div className="helper">No uploaded photo.</div>
              )}

              {selected.photo ? (
                <button
                  className="button secondary small"
                  type="button"
                  onClick={() =>
                    void downloadRemoteFile(selected.photo!, 'lapida-photo.jpg')
                  }
                >
                  Download
                </button>
              ) : null}
            </div>

            {/* Only shown once a photo has been dressed: `original_photo` is set
                precisely when `photo` was swapped for a generated version, so it
                doubles as the flag and as the family's untouched upload. */}
            {selected.original_photo ? (
              <div className="preview-frame stack">
                <strong>Original from the family</strong>
                {intermentPhotoUrl(selected.original_photo) ? (
                  <img
                    src={intermentPhotoUrl(selected.original_photo)!}
                    alt="Original upload"
                  />
                ) : (
                  <div className="helper">Original not resolvable.</div>
                )}
              </div>
            ) : null}

            <div className="stack" style={{ gap: 8 }}>
              {barongMsg ? <div className="status-card">{barongMsg}</div> : null}
              {barongErr ? <div className="status-card error">{barongErr}</div> : null}

              {selected.gdrive_link ? (
                <a
                  className="button secondary small"
                  href={selected.gdrive_link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in Google Drive
                </a>
              ) : null}

              {selected.barong_error ? (
                <div className="helper">Drive archive failed: {selected.barong_error}</div>
              ) : null}

              <div className="row">
                <button
                  className="button small"
                  type="button"
                  disabled={barongBusy}
                  onClick={() => void runDress(selected.id!, !!selected.original_photo)}
                >
                  {barongBusy
                    ? 'Working…'
                    : selected.original_photo
                      ? 'Re-dress'
                      : 'Dress in Barong / Filipiniana'}
                </button>

                {selected.original_photo ? (
                  <button
                    className="button ghost small"
                    type="button"
                    disabled={barongBusy}
                    onClick={() => void runRevert(selected.id!)}
                  >
                    Restore original
                  </button>
                ) : null}
              </div>

              <div className="helper">
                Dressing replaces the photo the lapida engraver and video livestreaming
                supplier receive on their next service order. It takes 1&ndash;3 minutes and
                is a paid edit. The family&apos;s original is always kept.
              </div>
            </div>

            <div className="upload-details-grid">
              <div>
                <strong>Document Number</strong>
                <br />
                {selected.document_no || '-'}
              </div>

              <div>
                <strong>Occupant</strong>
                <br />
                {selected.occupant || '-'}
              </div>

              <div>
                <strong>Gender</strong>
                <br />
                {selected.gender || '-'}
              </div>

              <div>
                <strong>Uploader</strong>
                <br />
                {selected.uploader_name || '-'}
              </div>

              {/* <div>
                <strong>Status</strong>
                <br />
                {selected.is_valid === 1 ? 'Approved' : 'Pending'}
              </div> */}
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}