import { handleTv } from '@/lib/consumer/tv-handler';

export async function POST(request: Request) {
  return handleTv(request, 'confirm');
}
