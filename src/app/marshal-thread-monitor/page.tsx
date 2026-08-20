import type { Metadata } from 'next';
import MarshalThreadMonitorPage from '@/features/MarshalThreadMonitorPage';

export const metadata: Metadata = {
  title: 'Marshal Thread Monitor | RP Vespera',
};

export default function Page() {
  return <MarshalThreadMonitorPage />;
}
