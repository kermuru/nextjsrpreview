import ReviewPage from '@/features/ReviewPage';

export default async function Page({ params }: { params: Promise<{ documentNo: string }> }) {
  const { documentNo } = await params;
  return <ReviewPage documentNo={documentNo} />;
}
