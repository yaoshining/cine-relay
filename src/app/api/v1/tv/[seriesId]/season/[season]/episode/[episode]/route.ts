import { handleTv } from '@/lib/consumer/tv-handler';

export async function GET(request: Request, { params }: { params: Promise<{ seriesId: string; season: string; episode: string }> }) {
  return handleTv(request, 'episode', await params);
}
