// import { redirect } from 'next/navigation';

// export default function HomePage() {
//   redirect('/interments');
// }

import Link from 'next/link';

const adminMenuItems = [
  {
    title: 'Lapida Dashboard',
    description: 'Manage lapida-related company records.',
    href: '/lapidaDashboard',
  },
  {
    title: 'All Reviews',
    description: 'View submitted client reviews.',
    href: '/allReviews',
  },
  {
    title: 'Reviewed Email List',
    description: 'View reviewed email records.',
    href: '/isReviewedEmail',
  },
  {
    title: 'Supplier IO',
    description: 'Manage supplier items, assignments, and NLIO setup.',
    href: '/supplierio',
  },
  {
    title: 'Discord User ID',
    description: 'Manage Discord user mapping for suppliers/admin use.',
    href: '/supplierio/discord',
  },
  {
    title: 'Processing Monitor',
    description: 'Processed budget requests (IPR-IRB / ARB-IPR / EXB-ADV), tagged Java vs our system.',
    href: '/budget-monitor',
  },
  {
    title: 'LMC Payout History',
    description: 'Interment service payouts (emcee, singer, lapida, etc.). Cancel a processed (PR) payout to free its budget.',
    href: '/lmc-payout-history',
  },
  {
    title: 'Asset Image Library',
    description: 'Bulk-upload asset images. View in high/low def and download the high-def original.',
    href: '/asset-images',
  },
  {
    title: 'Close IPR-BOQ Lines',
    description:
      'Retire requisition lines left by the old IPR post route, which never drew down the BOQ budget. Close them before anyone raises a PO against them.',
    href: '/ipr-line-close',
  },
  {
    title: 'Auto BOQ Custodian',
    description: 'Choose the person Auto BOQ names as stage custodian on newly generated BOQs.',
    href: '/autoboq-custodian',
  },
];

export default function HomePage() {
  return (
    <div className="page-shell plain">
      <div className="center-column">
        <div className="hero-logo">
          <img src="/logo.png" alt="Renaissance Park logo" />
        </div>

        <div className="page-card stack">
          <div className="stack centered" style={{ gap: '8px' }}>
            <h1 style={{ margin: 0 }}>Admin Portal</h1>

          </div>

          <div className="admin-menu-grid">
            {adminMenuItems.map((item) => (
              <Link key={item.href} href={item.href} className="admin-menu-card">
                <div className="admin-menu-card-content">
                  <h2 style={{ margin: 0 }}>{item.title}</h2>
                  <p className="muted" style={{ margin: 0 }}>
                    {item.description}
                  </p>
                </div>

                <span className="button">Open</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
