import type { ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
export function DemoTable({columns,rows,label}:{columns:string[];rows:ReactNode[][];label:string}){
 return <Table aria-label={label}><TableHeader><TableRow>{columns.map(c=><TableHead scope="col" key={c}>{c}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map((row,i)=><TableRow key={i}>{row.map((cell,j)=><TableCell key={j}>{cell}</TableCell>)}</TableRow>)}</TableBody></Table>;
}
