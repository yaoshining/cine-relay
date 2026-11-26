import { useId } from "react";
import type { Movie } from "@/lib/demo";

const tones = {
  shore:["#59afb4","#ffe7b4","#137780"], planet:["#061727","#173c62","#fd994b"],
  rain:["#14283b","#ad7141","#f8bf6e"], ocean:["#09526a","#082332","#6cdce1"],
  dune:["#d5724a","#fbc47d","#a54f29"], snow:["#547593","#dce6e5","#233d57"],
  field:["#5c6857","#ffe2a1","#9a5b2a"], cinema:["#110e32","#673257","#ffbe69"],
  city:["#192c59","#ee9e83","#a8caf0"], valley:["#24527b","#adae76","#719344"],
} as const;

export function Poster({ movie, crop = false }: { movie: Movie; crop?: boolean }) {
  const id=useId(); const [sky,horizon,light]=tones[movie.art];
  return <svg viewBox="0 0 160 240" preserveAspectRatio={crop?"xMidYMid slice":undefined} className="poster" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-sky`} x2="0" y2="1" gradientUnits="objectBoundingBox"><stop stopColor={sky}/><stop offset=".55" stopColor={horizon}/><stop offset="1" stopColor={light}/></linearGradient>
      <radialGradient id={`${id}-shade`} cx=".55" cy=".44" r=".73"><stop offset=".32" stopColor="#020713" stopOpacity="0"/><stop offset="1" stopColor="#020713" stopOpacity=".78"/></radialGradient>
      <radialGradient id={`${id}-glow`} cx=".72" cy=".37" r=".65"><stop stopColor="#fff0cb" stopOpacity=".29"/><stop offset="1" stopColor="#fff0cb" stopOpacity="0"/></radialGradient>
      <radialGradient id={`${id}-orb`} cx=".38" cy=".32" r=".72"><stop stopColor={light}/><stop offset="1" stopColor={sky}/></radialGradient>
      <pattern id={`${id}-grain`} width="7" height="9" patternUnits="userSpaceOnUse"><path d="M1 1h1m3 5h1" stroke="#d9e1de" opacity=".18" strokeWidth=".65"/></pattern>
    </defs>
    <rect width="160" height="240" fill={`url(#${id}-sky)`}/>
    <rect width="160" height="240" fill={`url(#${id}-glow)`}/>
    {movie.art==="shore"&&<><path d="M0 94 29 84l31 15 19-8 36 17 45-8v22H0Z" fill="#3d8c82"/><path d="M0 106c58 0 79 12 160 14v120H0Z" fill={light}/><path d="M160 132Q93 157 0 202v38h160Z" fill="#efd6a0"/><path d="M160 128Q84 149 0 183m160-42Q94 167 0 202M6 125l37-4m47 14 31-5M3 154l66-14" stroke="#d3efe5" strokeWidth="2" fill="none"/><path d="M109 137c-11-4-15-15-9-22 10-12 23-2 22 10l-5 15 12 22 1 31-32 2-1-30z" fill="#203e4d"/><path d="m104 138-10 39 26 10 7-23-10-24z" fill="#f3eee2"/></>}
    {movie.art==="planet"&&<>{Array.from({length:32},(_,i)=><circle key={i} cx={(i*47+12)%159} cy={(i*29+8)%229} r={i%5?0.75:1.4} fill={i%5?"#a9d9ed":"#ffd398"}/>)}<ellipse cx="81" cy="128" rx="68" ry="16" transform="rotate(-35 81 128)" fill="none" stroke="#d68b4d" strokeWidth="4"/><circle cx="82" cy="113" r="45" fill={`url(#${id}-orb)`}/><path d="M43 99q25 2 37-11t38 4m-75 24q26 7 48-6t31-2m-70 22q24 5 58-12" stroke="#ffbb72" opacity=".66" fill="none" strokeWidth="4"/><path d="M26 168c18 13 105-52 124-77" stroke="#ffe094" strokeWidth="3" fill="none"/></>}
    {movie.art==="rain"&&<>{Array.from({length:18},(_,i)=><path key={i} d={`M${i*11-12} ${i%3*16}v141h2v-129m-6 112h9`} fill="none" stroke={i%2?"#c89156":"#527388"} opacity=".58"/>)}<path d="M0 187 55 163l105 23v54H0Z" fill="#523e34"/><path d="M39 114h81l-14-8-5-19-34-4-16 22zM63 116l-4 18-18 16-12 90h101l-8-82-20-22-3-20z" fill="#101822" stroke="#c69362" strokeWidth="1.4"/><path d="M63 140l20 36 19-40m-20 42 10 60" stroke="#6f6258" fill="none"/><path d="M12 177l19-3m116-14 11 2m-9 43 12 3" stroke={light} opacity=".8"/></>}
    {movie.art==="ocean"&&<><path d="m3 0 24 0 67 173Z M45 0h19l54 171zM90 0h17l38 182z" fill={light} opacity=".20"/><path d="M0 193q29-27 58 8t102-11v50H0Z" fill="#113245"/><path d="M0 230 29 203l31 14 20-11 80 10v24H0Z" fill="#081f31"/><path d="M32 133l7-13 17 1 8-9 25 1 9 7q18 0 23 8-4 10-22 12H47l-11-4-7 6v-17Z" fill="#103b4c" stroke="#498394"/><path d="M64 113l7-10 14 1 4 8m-16-8v-8h8" fill="#35778a" stroke="#5794a0" strokeWidth="1.5"/><path d="m111 127 49 24v-29z" fill="#a4dacc" opacity=".28"/><circle cx="108" cy="126" r="4" fill="#fef0c1"/><circle cx="94" cy="128" r="3" fill="#e4f1bd"/></>}
    {movie.art==="dune"&&<><circle cx="116" cy="73" r="24" fill="#ffe8a7"/><path d="M0 108 38 82l44 31 35-14 43 17v124H0Z" fill="#cc8551"/><path d="M0 135q26-31 57-6t103 3v108H0Z" fill="#e3a369"/><path d="M0 177q68-11 94-39t66 4v98H0Z" fill={light}/><path d="M0 194q65-11 112-48t48 4M0 220q70-12 113-42t47-9" fill="none" stroke="#efae6b" opacity=".65"/><path d="M53 184q17-13 27-12l16-21 7 1-4 7-9 20 13 16-7 2-12-12-11 1-8 13h-6l5-17-11 4Z" fill="#49312d"/><path d="M50 211q15-11 49-22" fill="none" stroke="#58332a" opacity=".45"/></>}
    {movie.art==="snow"&&<><path d="M0 133 65 46l21 33 17-11 57 73v99H0Z" fill={light}/><path d="M20 106 65 46l21 33 17-11 26 34-29-10-14 9-21-29-17 20z" fill="#dfeced"/><path d="M0 140 47 116l31 32 52-38 30 29v101H0Z" fill="#54768b"/><path d="M0 160q30 13 63 5t97 5v20H0Z" fill="#d4e4e7" opacity=".5"/><path d="M0 204 29 183l30 15 42-11 59 23v30H0Z" fill="#223747"/><path d="M81 194l12-11 13 10-4 1v7H84v-7Z" fill="#933e49"/><path d="M91 194h5v5h-5z" fill="#e4b890"/></>}
    <rect width="160" height="240" fill={`url(#${id}-grain)`}/>
    {movie.art==="field"&&<><path d="M0 103q33-24 72 0t88-5v142H0Z" fill="#926b42"/><path d="M0 123q37-23 76-2t84 5v114H0Z" fill="#dca04d"/><path d="M0 167q69-49 160-10v83H0Z" fill="#887044"/><path d="M83 142q39 20 34 34t-93 64H0q29-18 80-43t3-55" fill="#e1bc74"/><path d="M0 0h74L49 13 28 15 19 40 0 49Z" fill="#754628"/>{Array.from({length:17},(_,i)=><path key={i} d={`m${i*13%75} ${i*19%43} 7-6 6 3-4 6z`} fill={i%2?"#cb843a":"#59382d"}/>)}</>}
    {movie.art==="cinema"&&<><path d="M9 104 63 75l89 14v110L9 211Z" fill="#24142e"/><path d="M58 82v112M62 116l90 11M10 159l141-20" stroke="#f3a869" opacity=".6"/><path d="M69 43h16v72H69z" fill="#2e1b48" stroke="#ff75b4" strokeWidth="2"/><path d="M76 50v58M14 141l139-11v18L15 158Z" fill="#ef985f" stroke="#ffdb91" strokeWidth="3"/>{Array.from({length:12},(_,i)=><path key={i} d={`M${i*12+16} ${165-i*.9}v24`} stroke={i%3?"#ab3d71":"#ffd18f"} strokeWidth="2"/>)}<path d="M21 202l29-4-19 42H9m103-32 21-8 27 40h-22" fill="#d4869d" opacity=".34"/></>}
    {movie.art==="city"&&<>{[0,1,2].map(layer=><g key={layer} fill={["#776584","#3e4d72","#1a2848"][layer]}>{Array.from({length:11},(_,i)=>{const y=110+layer*28+(i*17)%36;return <g key={i}><path d={`M${i*16-layer*9} 240V${y}h${12+layer*2}v${240-y}Z`}/><path d={`M${i*16-layer*9+5} ${y+6}v12m5-12v15`} stroke="#ffbe91" opacity=".46" strokeDasharray="2 3"/></g>;})}</g>)}</>}
    {movie.art==="valley"&&<><path d="M0 137 37 61l16 24 25-12 23 28 32-44 27 33v150H0Z" fill="#344f63"/><path d="m17 102 20-41 16 24 25-12 23 28-24-13-18 6-8-3-10-13Z" fill="#dde3d3"/><path d="M0 144q46-39 87 9l73-51v138H0Z" fill="#6b884c"/><path d="M0 183q33-69 90-26t70 11v72H0Z" fill="#365838"/><path d="M114 174q-79 11-42 28t-30 38h-19q68-19 36-35t55-31" fill="#a4c6af"/></>}
    <rect width="160" height="240" fill={`url(#${id}-shade)`}/>
  </svg>;
}
