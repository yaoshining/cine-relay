import { z } from 'zod';

export const seriesId = z.string().regex(/^[1-9][0-9]{0,15}$/);
export const locale = z.enum(['zh-CN', 'en-US']);
export const searchId = z.uuid();
export const searchParams = z.strictObject({
  query: z.string().min(1).max(120), first_air_date_year: z.int().min(1000).max(9999).optional(),
  lang: locale.default('zh-CN'), page: z.int().min(1).max(500).default(1),
});
export const normalizeTitle = (s: string) => s.normalize('NFC').trim().replace(/\s+/gu, ' ');
const count = z.int().nonnegative();
const candidate = z.object({ seriesId, name: z.string(), originalName: z.string(), firstAirDate: z.iso.date().nullable(), overview: z.string().nullable() });
const meta = { locale, cache: z.enum(['hit', 'refreshed', 'stale']) };
export const searchResult = z.object({ searchId, locale, cache: z.enum(['hit', 'refreshed']), page: z.int().positive(), totalPages: count, totalResults: count, results: z.array(candidate) });
export const confirmation = z.strictObject({ searchId, seriesId });
export const seriesDetail = candidate.extend({ ...meta, seasons: z.array(z.object({ seasonNumber: count, name: z.string(), episodeCount: count })) });
export const episodeDetail = z.object({ ...meta, seriesId, seasonNumber: count, episodeNumber: z.int().positive(), name: z.string(), overview: z.string().nullable(), airDate: z.iso.date().nullable() });

const json = (s: z.ZodType) => ({ 'application/json': { schema: z.toJSONSchema(s) } });
const param = (name: string, location: 'path'|'query'|'header', schema: z.ZodType, required = true) => ({name, in:location, required, schema:z.toJSONSchema(schema)});
const lang = param('lang','query',searchParams.shape.lang,false);
const id = param('seriesId','path',seriesId);
const failure = (code: string) => ({ description:code, content:json(z.object({ error:z.literal(code) })) });
const responses = (success: z.ZodType) => ({200:{description:'成功',content:json(success)},400:failure('invalid_request'),401:{...failure('unauthorized'),headers:{'WWW-Authenticate':{schema:{type:'string',const:'Bearer'}}}},404:failure('not_found'),429:{...failure('rate_limited'),headers:{'Retry-After':{schema:{type:'integer',minimum:1}}}},503:{...failure('unavailable'),headers:{'Retry-After':{schema:{type:'integer',minimum:1}}}}});
export const tvPaths = {
  '/api/v1/search/tv': {get:{operationId:'searchTv',summary:'按剧名搜索有序候选',parameters:[param('X-Search-Id','header',searchId),param('query','query',searchParams.shape.query),param('first_air_date_year','query',searchParams.shape.first_air_date_year.unwrap(),false),lang,param('page','query',searchParams.shape.page,false)],responses:{...responses(searchResult),409:failure('conflict')}}},
  '/api/v1/search/tv/confirm':{post:{operationId:'confirmTvMatch',summary:'幂等确认一个已展示的候选',requestBody:{required:true,content:json(confirmation)},responses:{...responses(confirmation),409:failure('conflict')}}},
  '/api/v1/tv/{seriesId}':{get:{operationId:'getTvSeries',summary:'剧集详情与季摘要',parameters:[id,lang],responses:responses(seriesDetail)}},
  '/api/v1/tv/{seriesId}/season/{season}/episode/{episode}':{get:{operationId:'getTvEpisode',summary:'单集详情',parameters:[id,param('season','path',count),param('episode','path',z.int().positive()),lang],responses:responses(episodeDetail)}},
};
export const tvPreviewContract = {openapi:'3.1.0',info:{title:'CineRelay 剧集接口（联调契约）',version:'0.1.0',description:'本地合成数据服务；不表示 staging 或生产可用。'},servers:[{url:'http://127.0.0.1:4317'}],security:[{AppKey:[]}],components:{securitySchemes:{AppKey:{type:'http',scheme:'bearer'}}},paths:tvPaths};
