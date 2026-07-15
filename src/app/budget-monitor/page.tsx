import type { Metadata } from 'next';
import BudgetMonitorPage from '@/features/BudgetMonitorPage';

export const metadata: Metadata = {
  title: 'Processing Monitor | RP Vespera',
};

export default function Page() {
  return <BudgetMonitorPage />;
}
