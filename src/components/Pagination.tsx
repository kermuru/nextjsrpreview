'use client';

export default function Pagination({
  currentPage,
  totalPages,
  onChange
}: {
  currentPage: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="row" style={{ justifyContent: 'center', alignItems: 'center', marginTop: 20 }}>
      <button className="button ghost small" onClick={() => onChange(currentPage - 1)} disabled={currentPage <= 1}>
        Previous
      </button>
      <span className="helper">Page {currentPage} of {totalPages}</span>
      <button className="button ghost small" onClick={() => onChange(currentPage + 1)} disabled={currentPage >= totalPages}>
        Next
      </button>
    </div>
  );
}
