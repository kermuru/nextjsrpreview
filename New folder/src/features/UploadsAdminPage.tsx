'use client';

import { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/Modal';
import Pagination from '@/components/Pagination';
import { downloadRemoteFile } from '@/lib/images';
import { getAllLapidaUploads } from '@/services/upload-photo';
import type { UploadInterredPhotoContext } from '@/types/api';

export default function UploadsAdminPage() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<UploadInterredPhotoContext[]>([]);
  const [searchText, setSearchText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selected, setSelected] = useState<UploadInterredPhotoContext | null>(null);

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
              <strong>Uploaded Photo</strong>

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