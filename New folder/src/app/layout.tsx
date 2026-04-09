import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RP Vespera',
  description: 'Next.js migration for the RP Vespera frontend.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
