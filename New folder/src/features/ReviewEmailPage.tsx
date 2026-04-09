'use client';

import { useEffect, useMemo, useState } from 'react';
import Pagination from '@/components/Pagination';
import { getReviewEmails } from '@/services/review-email';
import type { ReviewedEmailRecord } from '@/types/api';

export default function ReviewEmailPage() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<ReviewedEmailRecord[]>([]);
  const [searchText, setSearchText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    async function load() {
      try {
        const response = await getReviewEmails();
        setRecords(Array.isArray(response) ? response : response.data || []);
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
      record.email_add?.toLowerCase().includes(keyword) ||
      record.occupant?.toLowerCase().includes(keyword)
    );
  }, [records, searchText]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / 10));
  const paginated = filtered.slice((currentPage - 1) * 10, currentPage * 10);

  return (
    <div className="page-shell plain">
      <div className="">
        <div className="page-card wide stack">
          <div className="email-list-header stack-mobile">
            <h1 className="centered-mobile" style={{ margin: 0 }}>
              Email List Portal
            </h1>

            <input
              className="input email-search"
              value={searchText}
              onChange={(event) => {
                setSearchText(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search document, email or occupant"
            />
          </div>

          {loading ? <div className="status-card">Loading records...</div> : null}

          {!loading && paginated.length === 0 ? (
            <div className="status-card">No matching records found.</div>
          ) : null}

          {!loading && paginated.length > 0 ? (
            <>
              <div className="desktop-only table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Document No</th>
                      <th>Occupant</th>
                      <th>Email Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((record) => (
                      <tr key={`${record.document_no}-${record.email_add}`}>
                        <td>{record.document_no || '-'}</td>
                        <td>{record.occupant || '-'}</td>
                        <td className="email-cell">{record.email_add || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mobile-only email-cards stack">
                {paginated.map((record) => (
                  <div
                    key={`${record.document_no}-${record.email_add}`}
                    className="email-record-card stack"
                  >
                    <div className="email-record-block">
                      <span className="helper">Document No</span>
                      <div className="email-record-value">
                        {record.document_no || '-'}
                      </div>
                    </div>

                    <div className="email-record-block">
                      <span className="helper">Occupant</span>
                      <div className="email-record-value">
                        {record.occupant || '-'}
                      </div>
                    </div>

                    <div className="email-record-block">
                      <span className="helper">Email Address</span>
                      <div className="email-record-value email-address">
                        {record.email_add || '-'}
                      </div>
                    </div>
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
    </div>
  );
}