import { getAdmin } from '@/lib/admin/guard';
import { getDb } from '@/lib/db/client';
import { demandStats } from '@/lib/db/tv-demand';

export async function GET(){const headers={'Cache-Control':'private, no-store'};
  if(!await getAdmin())return Response.json({error:'unauthorized'},{status:401,headers});
  try{return Response.json(await demandStats(getDb()),{headers});}catch{return Response.json({error:'unavailable'},{status:503,headers});}
}
