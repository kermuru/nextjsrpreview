import PhotoUploadPage from '@/features/PhotoUploadPage';

export default async function Page({ params }: { params: Promise<{ documentNo: string }> }) {
  const { documentNo } = await params;
  return <PhotoUploadPage documentNo={documentNo} />;
}
