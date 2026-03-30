import PhotoLinkPage from '@/features/PhotoLinkPage';

export default async function Page({ params }: { params: Promise<{ documentNo: string }> }) {
  const { documentNo } = await params;
  return <PhotoLinkPage documentNo={documentNo} />;
}
