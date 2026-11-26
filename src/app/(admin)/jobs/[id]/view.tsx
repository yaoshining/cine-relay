import { notFound } from "next/navigation";
import { JobWorkbench, type JobQuery } from "@/components/job-workbench";
import { templates } from "@/lib/console-fixtures";
export default async function EditJob({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<JobQuery>}){
 const {id}=await params,template=templates.find(t=>t.id===id);
 if(!template)notFound();
 return <JobWorkbench key={id} template={template} query={await searchParams}/>;
}
