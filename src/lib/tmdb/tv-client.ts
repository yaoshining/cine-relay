import { z } from 'zod';
import { TmdbRequestError, type createTmdbTransport } from './movie-client';
import { searchParams, seriesDetail, episodeDetail, searchResult, seriesId, locale } from '../consumer/tv-contract';

const date = z.union([z.iso.date(), z.literal('')]).nullish().transform(v => v || null);
const show = z.object({id: z.int().positive(), name:z.string(), original_name:z.string(), overview:z.string().nullish(), first_air_date:date});
const summary = (r:z.infer<typeof show>)=>({seriesId:String(r.id), name:r.name, originalName:r.original_name, firstAirDate:r.first_air_date, overview:r.overview??null});
const listing=z.object({page:z.int().positive(),total_pages:z.int().nonnegative(),total_results:z.int().nonnegative(),results:z.array(show).max(100)});
const details=show.extend({seasons:z.array(z.object({season_number:z.int().nonnegative(),name:z.string(),episode_count:z.int().nonnegative()}))});
const episode=z.object({season_number:z.int().nonnegative(), episode_number:z.int().positive(), name:z.string(), overview:z.string().nullish(),air_date:date});
function checked<S extends z.ZodType>(schema:S,value:unknown):z.output<S>{const v=schema.safeParse(value);if(!v.success)throw new TmdbRequestError('invalid_response');return v.data;}
export type TvSearchPage=z.infer<typeof searchResult>['results'];
export function tvClient(request:ReturnType<typeof createTmdbTransport>){return {
  async search(input:z.infer<typeof searchParams>){
    const s=searchParams.parse(input),params=new URLSearchParams({query:s.query,language:s.lang,page:String(s.page),include_adult:'false'});
    if(s.first_air_date_year)params.set('first_air_date_year',String(s.first_air_date_year));
    const r=checked(listing,await request('/search/tv',params));if(r.page!==s.page)throw new TmdbRequestError('invalid_response');
    return {page:r.page,totalPages:r.total_pages,totalResults:r.total_results,results:r.results.map(summary),locale:s.lang};
  },
  async series(id:string,lang:z.infer<typeof locale>){
    const r=checked(details,await request(`/tv/${seriesId.parse(id)}`,new URLSearchParams({language:locale.parse(lang)})));
    if(String(r.id)!==id)throw new TmdbRequestError('invalid_response');
    return checked(seriesDetail.omit({cache:true}),{...summary(r),locale:lang,seasons:r.seasons.map(s=>({seasonNumber:s.season_number,name:s.name,episodeCount:s.episode_count}))});
  },
  async episode(id:string,s:number,e:number,lang:z.infer<typeof locale>){
    const r=checked(episode,await request(`/tv/${seriesId.parse(id)}/season/${z.int().nonnegative().parse(s)}/episode/${z.int().positive().parse(e)}`,new URLSearchParams({language:locale.parse(lang)})));
    if(r.season_number!==s||r.episode_number!==e)throw new TmdbRequestError('invalid_response');
    return checked(episodeDetail.omit({cache:true}),{seriesId:id,locale:lang,seasonNumber:s,episodeNumber:e,name:r.name,airDate:r.air_date,overview:r.overview??null});
  }
};}
