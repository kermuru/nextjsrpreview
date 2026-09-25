// The menu itself lives in src/features/AdminMenuPage.tsx, the same shape every
// other route in this app uses: a thin route file, a client feature component.
// Add a new tool to the FEATURES list there — nothing here needs to change.

import AdminMenuPage from '@/features/AdminMenuPage';

export default function HomePage() {
  return <AdminMenuPage />;
}
