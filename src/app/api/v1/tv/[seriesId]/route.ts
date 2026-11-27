import { handleTv } from '@/lib/consumer/tv-handler';

export async function GET(request: Request, { params }: { params: Promise<{ seriesId: string }> }) {
  return handleTv(request, 'series', await params);
}
