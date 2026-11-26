"use client";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type Options = readonly (readonly [string,string])[];
export function NativeOption({label,options,value,initialValue,onChange}:{label:string;options:Options;value?:string;initialValue?:string;onChange?:(v:string)=>void}){
 return <label className="control-label">{label}<select className="native-control w-full" value={value} defaultValue={value===undefined?initialValue:undefined} onChange={e=>onChange?.(e.target.value)}>{options.map(([key,text])=><option key={key} value={key}>{text}</option>)}</select></label>;
}
export function Segmented({name,label,options,value,onChange}:{name:string;label:string;options:Options;value:string;onChange:(v:string)=>void}){
 return <fieldset className="segmented"><legend className="sr-only">{label}</legend><div>{options.map(([id,text])=><label key={id}><input className="sr-only" type="radio" name={name} value={id} checked={id===value} onChange={()=>onChange(id)}/><span>{text}</span></label>)}</div></fieldset>;
}
export function DemoButton({children,danger=false,primary=false,indigoOutline=false,wide=false,size,message="静态演示 · 未执行此操作。"}:{children:ReactNode;danger?:boolean;primary?:boolean;indigoOutline?:boolean;wide?:boolean;size?:"xs"|"sm";message?:string}){
 const [show,setShow]=useState(false);
 return <div className={wide?"demo-action demo-action-wide":"demo-action"}><Button type="button" size={size} aria-expanded={show} variant={danger?"destructive":primary?"default":indigoOutline?"indigo-outline":"outline"} onClick={()=>setShow(!show)}>{children}</Button><div role="status" className="demo-feedback">{show?message:null}</div></div>;
}
