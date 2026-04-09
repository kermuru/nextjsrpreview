import Link from 'next/link';

export default function SupplierIoPage() {
  return (
    <div className="page-shell plain">
      <div className="center-column">
        <div className="page-card narrow stack">
          <h1 style={{ margin: 0 }}>Supplier IO Portal</h1>
          <p className="muted" style={{ margin: 0 }}>
            Manage supplier item assignments and NLIO supplier assignments.
          </p>

          <div className="link-grid">
            <Link className="button" href="/supplierio/item-assignment">
              Supplier Item Assignment
            </Link>
            <Link className="button" href="/supplierio/items">
              Supplier Items
            </Link>
            <Link className="button" href="/supplierio/nlio-assignment">
              NLIO Supplier Assignment
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
