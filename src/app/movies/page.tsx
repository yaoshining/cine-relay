import { Catalog } from "@/components/catalog";
export default async function MoviesPage({searchParams}:{searchParams:Promise<{q?:string|string[]}>}){
 const {q}=await searchParams;
 const query=typeof q==="string"?q:"";
 return <Catalog key={query} initialQuery={query}/>;
}
