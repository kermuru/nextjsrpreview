import SlideshowPage from '@/features/SlideshowPage';

export default async function Page({ params }: { params: Promise<{ documentNo: string }> }) {
  const { documentNo } = await params;
  return <SlideshowPage documentNo={documentNo} />;
}
