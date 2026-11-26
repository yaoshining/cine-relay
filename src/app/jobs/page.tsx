import { TemplatesList } from "@/components/templates-list";
import { JobWorkbench, type JobQuery } from "@/components/job-workbench";
export default async function Jobs({searchParams}:{searchParams:Promise<JobQuery>}){
 const query=await searchParams;
 return query.sample==="1"?<JobWorkbench query={query}/>:<TemplatesList/>;
}
