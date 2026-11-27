import { handleTv } from '@/lib/consumer/tv-handler';

export async function GET(request: Request) {
  return handleTv(request, 'search');
}
