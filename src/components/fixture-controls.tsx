import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function FixtureSearch({value,placeholder,onChange}:{value:string;placeholder:string;onChange:(value:string)=>void}) {
 return <label className="fixture-search"><Search aria-hidden="true"/><Input type="search" aria-label={placeholder} placeholder={placeholder} value={value} onChange={e=>onChange(e.target.value)}/></label>;
}
export function FixtureSelect({label,value,options,onChange}:{label:string;value:string;options:readonly (readonly [string,string])[];onChange:(value:string)=>void}) {
 return <select className="native-control" aria-label={label} value={value} onChange={e=>onChange(e.target.value)}>{options.map(([v,label])=><option key={v} value={v}>{label}</option>)}</select>;
}
export function FixturePager({page,total,size,unit,change}:{page:number;total:number;size:number;unit:string;change:(n:number)=>void}) {
 return <div className="fixture-pager"><span aria-live="polite">显示 {total?page*size+1:0}–{Math.min((page+1)*size,total)} / 共 {total} {unit}</span><Button variant="outline" size="icon-sm" disabled={page===0} onClick={()=>change(page-1)} aria-label="上一页"><ChevronLeft/></Button><span className="pager-index mono">{page+1}</span><Button variant="outline" size="icon-sm" disabled={(page+1)*size>=total} onClick={()=>change(page+1)} aria-label="下一页"><ChevronRight/></Button></div>;
}
export function FixtureEmpty(){return <p className="empty-panel">没有符合条件的示例记录。</p>;}
export const matchesQuery=(query:string,...fields:string[])=>fields.join(' ').toLowerCase().includes(query.trim().toLowerCase());
