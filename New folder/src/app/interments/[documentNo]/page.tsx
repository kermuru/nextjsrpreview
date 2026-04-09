import LandingPage from '@/features/LandingPage';

export default async function Page({ params }: { params: Promise<{ documentNo: string }> }) {
  const { documentNo } = await params;
  return <LandingPage initialDocumentNo={documentNo} />;
}
