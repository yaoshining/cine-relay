import { getDb } from '../db/client';
import { managedTvTransport } from '../tmdb/managed-client';
import { tvClient } from '../tmdb/tv-client';
import { tvApi, type TvAction } from './tv-api';

export const handleTv = (req:Request, action:TvAction, params:Record<string,string>={}) =>
  tvApi(req,action,params,getDb,()=>tvClient(managedTvTransport()));
