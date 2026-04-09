'use client';

import { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/Modal';
import Pagination from '@/components/Pagination';
import { downloadRemoteFile } from '@/lib/images';
import { getAllReviews } from '@/services/review';
import type { Review } from '@/types/api';

export default function ReviewsAdminPage() {
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [searchText, setSearchText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selected, setSelected] = useState<Review | null>(null);

  useEffect(() => {
    async function loadReviews() {
      try {
        const response = await getAllReviews();
        setReviews(Array.isArray(response) ? response : []);
      } catch (error) {
        console.error('Failed to load reviews:', error);
        setReviews([]);
      } finally {
        setLoading(false);
      }
    }

    void loadReviews();
  }, []);

  const filteredReviews = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    if (!keyword) return reviews;

    return reviews.filter((review) => {
      const documentNo = review.document_no?.toLowerCase() || '';
      const reviewerName = review.reviewer_name?.toLowerCase() || '';
      const contactNumber = review.contact_number?.toLowerCase() || '';

      return (
        documentNo.includes(keyword) ||
        reviewerName.includes(keyword) ||
        contactNumber.includes(keyword)
      );
    });
  }, [reviews, searchText]);

  const pageSize = 5;
  const totalPages = Math.max(1, Math.ceil(filteredReviews.length / pageSize));
  const paginatedReviews = filteredReviews.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const openReview = (review: Review) => {
    setSelected(review);
  };

  const closeModal = () => {
    setSelected(null);
  };

  return (
    <div className="page-shell plain">
      <div className="">
        <div className="page-card wide stack">
          <div className="reviews-header stack-mobile">
            <h1 className="centered-mobile" style={{ margin: 0 }}>
              Reviews Portal
            </h1>

            <input
              className="input reviews-search"
              value={searchText}
              onChange={(event) => {
                setSearchText(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search reviewer, document, or contact"
            />
          </div>

          {loading ? <div className="status-card">Loading reviews...</div> : null}

          {!loading && filteredReviews.length === 0 ? (
            <div className="status-card">No matching reviews found.</div>
          ) : null}

          {!loading && filteredReviews.length > 0 ? (
            <>
              <div className="desktop-only table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Document No</th>
                      <th>Reviewer</th>
                      <th>Contact</th>
                      <th></th>
                      <th>Action</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedReviews.map((review) => (
                      <tr key={review.id}>
                        <td>{review.document_no || '-'}</td>
                        <td>{review.reviewer_name || '-'}</td>
                        <td>{review.contact_number || '-'}</td>
                        <td>
                          {/* <span
                            className={
                              review.is_valid === 1 ? 'pill success' : 'pill warning'
                            }
                          >
                            {review.is_valid === 1 ? 'Approved' : 'Pending'}
                          </span> */}
                        </td>
                        <td>
                          <button
                            className="button small"
                            type="button"
                            onClick={() => openReview(review)}
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mobile-only reviews-cards stack">
                {paginatedReviews.map((review) => (
                  <div key={review.id} className="review-card stack">
                    <div className="row between gap-sm">
                      <strong>{review.reviewer_name || 'No name'}</strong>
                      {/* <span
                        className={
                          review.is_valid === 1 ? 'pill success' : 'pill warning'
                        }
                      >
                        {review.is_valid === 1 ? 'Approved' : 'Pending'}
                      </span> */}
                    </div>

                    <div className="review-meta">
                      <div>
                        <span className="helper">Document No</span>
                        <div>{review.document_no || '-'}</div>
                      </div>

                      <div>
                        <span className="helper">Contact</span>
                        <div>{review.contact_number || '-'}</div>
                      </div>
                    </div>

                    <button
                      className="button"
                      type="button"
                      onClick={() => openReview(review)}
                    >
                      Open Review
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {!loading && filteredReviews.length > 0 ? (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onChange={setCurrentPage}
            />
          ) : null}
        </div>
      </div>

      {selected ? (
        <Modal title="Review Inspector" onClose={closeModal}>
          <div className="stack">
            <div className="review-image-grid">
              <div className="preview-frame stack">
                <strong>Facebook Review</strong>

                {selected.fb_screenshot ? (
                  <>
                    <img src={selected.fb_screenshot} alt="Facebook review" />
                    <button
                      className="button secondary small"
                      type="button"
                      onClick={() =>
                        void downloadRemoteFile(
                          selected.fb_screenshot!,
                          'fb-review.jpg'
                        )
                      }
                    >
                      Download
                    </button>
                  </>
                ) : (
                  <div className="helper">No screenshot uploaded.</div>
                )}
              </div>

              <div className="preview-frame stack">
                <strong>Google Review</strong>

                {selected.google_screenshot ? (
                  <>
                    <img src={selected.google_screenshot} alt="Google review" />
                    <button
                      className="button secondary small"
                      type="button"
                      onClick={() =>
                        void downloadRemoteFile(
                          selected.google_screenshot!,
                          'google-review.jpg'
                        )
                      }
                    >
                      Download
                    </button>
                  </>
                ) : (
                  <div className="helper">No screenshot uploaded.</div>
                )}
              </div>
            </div>

            <div className="review-details-grid">
              <div>
                <strong>Document Number</strong>
                <br />
                {selected.document_no || '-'}
              </div>

              <div>
                <strong>Reviewer</strong>
                <br />
                {selected.reviewer_name || '-'}
              </div>

              <div>
                <strong>Contact Number</strong>
                <br />
                {selected.contact_number || '-'}
              </div>

              {/* <div>
                <strong>Status</strong>
                <br />
                {selected.is_valid === 1 ? 'Approved' : 'Pending'}
              </div> */}

              <div>
                <strong>Public Question</strong>
                <br />
                {selected.selected_public_question || '-'}
              </div>

              <div>
                <strong>Private Question</strong>
                <br />
                {selected.selected_private_question || '-'}
              </div>

              <div>
                <strong>Private Answer</strong>
                <br />
                {selected.private_feedback || selected.private_faq_answer || '-'}
              </div>

              <div>
                <strong>Other Suggestions</strong>
                <br />
                {selected.others || selected.privateOthers || '-'}
              </div>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}