import { JobWorkbench, type JobQuery } from "@/components/job-workbench";
export default async function NewJob({searchParams}:{searchParams:Promise<JobQuery>}){
 return <JobWorkbench query={await searchParams}/>;
}
