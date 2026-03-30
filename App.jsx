import { useState, useEffect, useRef } from "react";
import { loadCollection, saveCollection, checkSupabaseStatus } from './supabase';

const C={bg:"#f4f4f5",surface:"#ffffff",surface2:"#f9f9f9",border:"#e4e4e7",yellow:"#ca8a04",red:"#dc2626",cyan:"#0ea5e9",purple:"#7c3aed",green:"#16a34a",orange:"#f97316",pink:"#ec4899",blue:"#1d4ed8",text:"#18181b",muted:"#71717a",dim:"#e4e4e7"};
const CAT_META={power:{color:"#dc2626",icon:"⚡",label:"Power"},strength:{color:"#ca8a04",icon:"💪",label:"Strength"},hypertrophy:{color:"#f97316",icon:"🔥",label:"Hypertrophy"},mobility:{color:"#0ea5e9",icon:"🌊",label:"Mobility"},corrective:{color:"#7c3aed",icon:"🔧",label:"Corrective"},isometric:{color:"#16a34a",icon:"⏸",label:"Isometric"},eccentric:{color:"#ec4899",icon:"⬇",label:"Eccentric"},plyometric:{color:"#dc2626",icon:"🚀",label:"Plyometric"},med_ball:{color:"#7c3aed",icon:"🏐",label:"Med Ball"},cardio:{color:"#1d4ed8",icon:"🏃",label:"Cardio"}};
const BLOCK_COLORS={A:"#dc2626",B:"#ca8a04",C:"#0ea5e9",D:"#7c3aed",E:"#f97316",F:"#16a34a"};
const S={
  input:{background:"#ffffff",border:"1px solid #e4e4e7",borderRadius:8,color:"#18181b",padding:"8px 12px",fontFamily:"'Barlow',sans-serif",fontSize:16,outline:"none",width:"100%"},
  btn:(bg,col)=>({background:bg,color:col,border:"none",borderRadius:8,padding:"9px 20px",cursor:"pointer",fontFamily:"'Bebas Neue',sans-serif",fontSize:17,letterSpacing:.5}),
  card:{background:"#ffffff",border:"1px solid #e4e4e7",borderRadius:12,padding:"16px 18px",marginBottom:12,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"},
  label:{fontSize:10,color:"#71717a",fontFamily:"'Barlow',sans-serif",fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,marginBottom:6,display:"block"},
};
const Tag=({color,children})=><span style={{fontSize:10,padding:"2px 8px",borderRadius:4,background:color+"22",color,fontFamily:"'Barlow',sans-serif",fontWeight:700,textTransform:"uppercase"}}>{children}</span>;
const STitle=({children,sub})=><div style={{marginBottom:16}}><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,letterSpacing:1}}>{children}</div>{sub&&<div style={{fontSize:13,color:"#71717a",fontFamily:"'Barlow',sans-serif"}}>{sub}</div>}</div>;
const today=()=>new Date().toISOString().split("T")[0];
const fmtDate=iso=>new Date(iso).toLocaleDateString("en-US",{month:"short",day:"numeric"});
const daysAgo=n=>{const d=new Date();d.setDate(d.getDate()-n);return d.toISOString().split("T")[0];};
const getWeekStart=()=>{const d=new Date();d.setDate(d.getDate()-d.getDay());return d.toISOString().split("T")[0];};
const isThisWeek=iso=>iso>=getWeekStart();
const fmtSecs=s=>`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
const DEFAULT_GOALS=[{id:1,name:"Vertical Jump",unit:"in",current:24,target:36,category:"athletic"},{id:2,name:"Body Weight",unit:"lbs",current:185,target:170,category:"weight"},{id:3,name:"Back Squat",unit:"lbs",current:225,target:315,category:"strength"},{id:4,name:"Deadlift",unit:"lbs",current:275,target:405,category:"strength"},{id:5,name:"Bench Press",unit:"lbs",current:185,target:225,category:"strength"},{id:6,name:"Power Clean",unit:"lbs",current:135,target:185,category:"power"}];
const CAT_GOAL_META={strength:{color:"#ca8a04",icon:"💪"},athletic:{color:"#0ea5e9",icon:"⚡"},weight:{color:"#dc2626",icon:"⚖️"},power:{color:"#dc2626",icon:"🔥"},mobility:{color:"#0ea5e9",icon:"🌊"}};
function progressPct(c,t,cat){if(cat==="weight"){const s=c*1.15;return Math.min(100,Math.max(0,Math.round(((s-c)/(s-t))*100)));}return Math.min(100,Math.round((c/t)*100));}
const ACTIVATION=[{name:"Psoas Ball Release",duration:"60s",side:"Left",note:"Inside hip bone"},{name:"Piriformis Figure-4",duration:"60s",side:"Left",note:"Seated or supine"},{name:"90/90 Hip Switch",duration:"10 reps",side:"Both",note:"Controlled"},{name:"Banded Clamshell",duration:"15 reps",side:"Left",note:"Feel glute med"},{name:"VMO Wall Squeeze",duration:"10x5s",side:"Both",note:"Inner quad"},{name:"Ankle Hops",duration:"20 reps",side:"Both",note:"Stiff ankle"},{name:"World Greatest Stretch",duration:"5 ea",side:"Both",note:"Full range"}];

// ─── AI ───────────────────────────────────────────────────────────────────────
async function callCoach(system,messages,max_tokens=800){
  try{
    const res=await fetch("/api/coach",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({system,messages,max_tokens})});
    const data=await res.json();
    return data.content?.map(c=>c.text||"").join("")||"";
  }catch{return"";}
}

async function autoClassify(name){
  try{
    const text=await callCoach(
      `Classify this exercise for a basketball athlete. Respond ONLY valid JSON no extra text:
{"category":"power|strength|hypertrophy|mobility|corrective|isometric|eccentric|plyometric|med_ball|cardio","trackingType":"reps|duration","note":"one short cue","block":"A|B|C|D"}
Block: A=power/explosive, B=main compounds, C=accessories, D=mobility/corrective`,
      [{role:"user",content:`Classify: "${name}"`}],150
    );
    return JSON.parse(text.replace(/```json|```/g,"").trim());
  }catch{return null;}
}

async function buildAIWorkout(prompt,recentWorkouts,goals,checkIn){
  try{
    const ctx=`Basketball athlete, left knee patellofemoral issues. Goals: ${goals.map(g=>`${g.name} ${g.current}/${g.target}${g.unit}`).join(", ")}. Recent: ${recentWorkouts.slice(-3).map(w=>w.name).join(", ")||"none"}. Sleep ${checkIn?.sleep||"?"}h Energy ${checkIn?.energy||"?"}/5`;
    const text=await callCoach(
      `Expert strength coach. Return ONLY valid JSON, no extra text:
{"sessionName":"name","status":"ready_to_train","headline":"max 8 words","reasoning":"2-3 sentences why this order","estimatedDuration":"X mins","warnings":["knee/hip flags"],"quick_tip":"one cue","blocks":[{"label":"Block A — Power","category":"power","note":"rest note","exercises":["Exercise (sets x reps @ weight)"]}],"exercises":[{"name":"Name","sets":3,"reps":"8","weight":"suggestion","restSecs":120,"category":"strength","note":"cue","trackingType":"reps","block":"A","supersetWith":null,"supersetLabel":""}]}
Block guide: A=power first, B=compounds, C=accessories, D=mobility last. supersetWith=index or null. Consider left knee patellofemoral — avoid valgus, deep knee flexion under load.`,
      [{role:"user",content:`${ctx}\n\nBuild: ${prompt}`}],1200
    );
    return JSON.parse(text.replace(/```json|```/g,"").trim());
  }catch{return null;}
}

async function autoGroupBlocks(rows){
  try{
    const text=await callCoach(
      `Strength coach. Assign block letters and supersets. ONLY valid JSON:
{"assignments":[{"index":0,"block":"A","supersetWith":null,"supersetLabel":"A1"}]}
A=power, B=compounds, C=accessories, D=mobility. supersetWith=index or null.`,
      [{role:"user",content:`Exercises: ${rows.map((r,i)=>`${i}: ${r.exercise} (${r.category||"unknown"})`).join(", ")}`}],400
    );
    return JSON.parse(text.replace(/```json|```/g,"").trim()).assignments||[];
  }catch{return[];}
}

async function getProactiveSuggestions(workouts,bbLog,goals,prs){
  try{
    const daysSince=workouts.length?Math.floor((new Date()-new Date([...workouts].sort((a,b)=>b.date.localeCompare(a.date))[0].date))/(86400000)):99;
    const exDates={};workouts.forEach(w=>w.exercises?.forEach(e=>{if(!exDates[e.exercise]||w.date>exDates[e.exercise])exDates[e.exercise]=w.date;}));
    const gaps=Object.entries(exDates).filter(([,d])=>d<daysAgo(7)).map(([e])=>e).slice(0,4);
    const text=await callCoach(
      `Proactive coach. 3-4 smart suggestions. ONLY valid JSON:
{"suggestions":[{"type":"gap|milestone|warning|pr_chase","icon":"emoji","title":"short","body":"1-2 sentences","action":"specific action"}]}`,
      [{role:"user",content:`Days since workout: ${daysSince}. Ball this week: ${bbLog.filter(b=>isThisWeek(b.date)).length}. Goals: ${goals.map(g=>`${g.name} ${progressPct(g.current,g.target,g.category)}%`).join(", ")}. Gaps 7+ days: ${gaps.join(", ")||"none"}.`}],400
    );
    return JSON.parse(text.replace(/```json|```/g,"").trim()).suggestions||[];
  }catch{return[];}
}

function checkMilestones(workouts,prs,bbLog,goals){
  const m=[];
  [1,10,25,50,100].forEach(n=>{if(workouts.length===n)m.push({icon:"💪",title:`${n} Workouts!`,body:`You've logged ${n} sessions.`});});
  let streak=0;const all=new Set([...workouts.map(w=>w.date),...bbLog.map(b=>b.date)]);
  for(let i=0;i<365;i++){if(all.has(daysAgo(i)))streak++;else break;}
  [3,7,14,30].forEach(n=>{if(streak===n)m.push({icon:"🔥",title:`${n}-Day Streak!`,body:`${n} days straight.`});});
  goals.forEach(g=>{if(progressPct(g.current,g.target,g.category)>=100)m.push({icon:"🏆",title:`Goal: ${g.name}!`,body:`Hit ${g.target}${g.unit}.`});});
  return m;
}

// ─── REST TIMER ───────────────────────────────────────────────────────────────
function RestTimer({defaultSecs=90}){
  const [secs,setSecs]=useState(defaultSecs);
  const [running,setRunning]=useState(false);
  const [initial,setInitial]=useState(defaultSecs);
  const iv=useRef(null);
  useEffect(()=>{
    if(running){iv.current=setInterval(()=>setSecs(s=>{if(s<=1){setRunning(false);clearInterval(iv.current);if(navigator.vibrate)navigator.vibrate([200,100,200]);return 0;}return s-1;}),1000);}
    else clearInterval(iv.current);
    return()=>clearInterval(iv.current);
  },[running]);
  return(
    <div style={{background:"#f4f4f5",borderRadius:10,padding:"10px 12px",marginTop:8,border:"1px solid #1e1e1e"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
        <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:10,color:"#71717a",letterSpacing:1}}>REST TIMER</span>
        <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,color:secs<=10&&running?"#dc2626":"#ca8a04"}}>{fmtSecs(secs)}</span>
      </div>
      <div style={{height:3,background:"#e4e4e7",borderRadius:99,marginBottom:8}}>
        <div style={{width:`${(secs/initial)*100}%`,height:"100%",background:secs<=10?"#dc2626":"#16a34a",borderRadius:99,transition:"width 1s linear"}}/>
      </div>
      <div style={{display:"flex",gap:5,marginBottom:6}}>
        <button onClick={()=>setRunning(r=>!r)} style={{...S.btn(running?"#dc2626":"#16a34a","#000"),flex:1,padding:"6px",fontSize:13}}>{running?"PAUSE":"START"}</button>
        <button onClick={()=>{setRunning(false);setSecs(initial);}} style={{background:"#f9f9f9",border:"1px solid #1e1e1e",borderRadius:8,color:"#6b7280",cursor:"pointer",padding:"6px 10px"}}>↺</button>
      </div>
      <div style={{display:"flex",gap:3}}>
        {[30,45,60,90,120,180].map(p=><button key={p} onClick={()=>{setInitial(p);setSecs(p);setRunning(true);}} style={{flex:1,background:initial===p?"#ca8a0422":"transparent",color:initial===p?"#ca8a04":"#71717a",border:`1px solid ${initial===p?"#ca8a04":"#e4e4e7"}`,borderRadius:5,padding:"3px 1px",cursor:"pointer",fontFamily:"'Barlow',sans-serif",fontSize:9,fontWeight:700}}>{p}s</button>)}
      </div>
    </div>
  );
}

function WorkoutTimer({startTime}){
  const [elapsed,setElapsed]=useState(0);
  useEffect(()=>{const i=setInterval(()=>setElapsed(Math.floor((Date.now()-startTime)/1000)),1000);return()=>clearInterval(i);},[startTime]);
  return <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:"#ca8a04"}}>⏱ {fmtSecs(elapsed)}</span>;
}

// ─── SET TRACKER (per-set weight + reps + warmup) ────────────────────────────
function SetTracker({numSets,trackingType,setData,onChange,bestPrev}){
  const count=parseInt(numSets)||3;
  const [sets,setSets]=useState(()=>{
    const wus=(setData||[]).filter(s=>s.isWarmup);
    const wk=Array.from({length:count},(_,i)=>{const d=(setData||[]).filter(s=>!s.isWarmup)[i];return d||{weight:"",value:"",done:false,isWarmup:false};});
    return [...wus,...wk];
  });
  useEffect(()=>{
    setSets(prev=>{
      const wus=prev.filter(s=>s.isWarmup);
      const wk=prev.filter(s=>!s.isWarmup);
      return [...wus,...Array.from({length:count},(_,i)=>wk[i]||{weight:"",value:"",done:false,isWarmup:false})];
    });
  },[count]);
  useEffect(()=>{onChange(sets);},[sets]);

  function upd(i,f,v){setSets(p=>p.map((s,idx)=>idx===i?{...s,[f]:v}:s));}
  function tog(i){setSets(p=>p.map((s,idx)=>idx===i?{...s,done:!s.done}:s));}
  function addWU(){setSets(p=>{const fi=p.findIndex(s=>!s.isWarmup);const wu={weight:"",value:"",done:false,isWarmup:true};return fi===-1?[wu,...p]:[...p.slice(0,fi),wu,...p.slice(fi)];});}
  function rem(i){setSets(p=>p.filter((_,idx)=>idx!==i));}

  let wuN=0,wkN=0;
  return(
    <div style={{marginTop:8}}>
      {bestPrev!=null&&bestPrev>0&&(
        <div style={{background:"#fef9c3",border:"1px solid #fde047",borderRadius:8,padding:"6px 10px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:10,color:"#854d0e",fontFamily:"'Barlow',sans-serif",fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Best Previous</span>
          <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:"#854d0e"}}>{bestPrev} lbs</span>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"36px 1fr 1fr 36px 20px",gap:4,marginBottom:4}}>
        {["Set",trackingType==="duration"?"—":"Weight (lbs)",trackingType==="duration"?"Secs":"Reps","✓",""].map((h,hi)=>(
          <div key={hi} style={{fontSize:9,color:"#71717a",fontFamily:"'Barlow',sans-serif",fontWeight:700,textTransform:"uppercase",textAlign:hi===0||hi===3?"center":"left"}}>{h}</div>
        ))}
      </div>
      {sets.map((s,i)=>{
        const isW=s.isWarmup;
        if(isW)wuN++;else wkN++;
        const label=isW?`W${wuN}`:`${wkN}`;
        const lc=isW?"#f97316":s.done?"#16a34a":"#71717a";
        const bg=isW?"#fff7ed":s.done?"#f0fdf4":"#ffffff";
        const bc=isW?"#fed7aa":s.done?"#bbf7d0":"#e4e4e7";
        return(
          <div key={i} style={{display:"grid",gridTemplateColumns:"36px 1fr 1fr 36px 20px",gap:4,marginBottom:5,alignItems:"center"}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:13,color:lc,textAlign:"center",background:lc+"18",borderRadius:6,padding:"5px 2px",lineHeight:1,border:`1px solid ${lc}33`}}>
              {label}{isW&&<div style={{fontSize:7,color:"#f97316",lineHeight:1}}>WU</div>}
            </div>
            {trackingType!=="duration"
              ?<input type="number" inputMode="decimal" placeholder={bestPrev?String(bestPrev):"lbs"} value={s.weight}
                  onChange={e=>upd(i,"weight",e.target.value)}
                  style={{...S.input,padding:"8px 9px",background:bg,borderColor:bc,color:isW?"#f97316":"#18181b"}}/>
              :<div style={{background:"#f4f4f5",borderRadius:8,height:38,border:"1px solid #e4e4e7"}}/>
            }
            <input placeholder={trackingType==="duration"?"secs":"reps"} inputMode="numeric" value={s.value}
              onChange={e=>upd(i,"value",e.target.value)}
              style={{...S.input,padding:"8px 9px",background:bg,borderColor:bc,color:isW?"#f97316":"#18181b"}}/>
            <button onClick={()=>tog(i)}
              style={{width:36,height:38,borderRadius:8,border:`1px solid ${s.done?"#16a34a":"#e4e4e7"}`,background:s.done?"#dcfce7":"#fff",cursor:"pointer",fontSize:15,color:s.done?"#16a34a":"#71717a",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>
              {s.done?"✓":"○"}
            </button>
            <button onClick={()=>rem(i)} style={{background:"transparent",border:"none",color:"#d1d5db",cursor:"pointer",fontSize:14,padding:0,lineHeight:1}}>×</button>
          </div>
        );
      })}
      <button onClick={addWU} style={{background:"#fff7ed",border:"1px dashed #fed7aa",borderRadius:7,color:"#f97316",padding:"6px 14px",cursor:"pointer",fontFamily:"'Barlow',sans-serif",fontSize:11,fontWeight:700,marginTop:4}}>
        + Warmup Set
      </button>
    </div>
  );
}

// ─── EXERCISE ROW ─────────────────────────────────────────────────────────────
function ExerciseRow({row,index,total,rows,onDelete,onMove,onChange,onToggleSuperset,bestPrev}){
  const [open,setOpen]=useState(true);
  const [showRest,setShowRest]=useState(false);
  const meta=row.category?CAT_META[row.category]:null;
  const bc=row.block?BLOCK_COLORS[row.block]:"#e4e4e7";
  const isPaired=row.supersetWith!=null;

  return(
    <div style={{marginBottom:isPaired?3:10}}>
      <div style={{background:"#fff",border:`1px solid ${bc}`,borderLeft:`3px solid ${bc}`,borderRadius:12,overflow:"hidden"}}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:6,padding:"9px 12px",cursor:"pointer",borderBottom:open?"1px solid #1a1a1a":"none"}} onClick={()=>setOpen(o=>!o)}>
          {row.block&&<span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:13,color:bc,background:bc+"22",padding:"2px 7px",borderRadius:5,flexShrink:0}}>{row.supersetLabel||row.block}</span>}
          {isPaired&&<span style={{fontSize:9,padding:"2px 5px",borderRadius:3,background:bc+"22",color:bc,fontFamily:"'Barlow',sans-serif",fontWeight:700}}>SS</span>}
          <span style={{fontFamily:"'Barlow',sans-serif",fontWeight:700,fontSize:14,flex:1,color:row.exercise?"#18181b":"#52525b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.exercise||"New Exercise"}</span>
          {meta&&<Tag color={meta.color}>{meta.icon}</Tag>}
          <div style={{display:"flex",gap:3,marginLeft:4}} onClick={e=>e.stopPropagation()}>
            <button onClick={()=>onMove(index,-1)} disabled={index===0} style={{background:"transparent",border:"1px solid #1e1e1e",borderRadius:5,color:index===0?"#222":"#71717a",cursor:index===0?"default":"pointer",padding:"2px 6px",fontSize:10}}>▲</button>
            <button onClick={()=>onMove(index,1)} disabled={index===total-1} style={{background:"transparent",border:"1px solid #1e1e1e",borderRadius:5,color:index===total-1?"#222":"#71717a",cursor:index===total-1?"default":"pointer",padding:"2px 6px",fontSize:10}}>▼</button>
            <button onClick={()=>onDelete(index)} style={{background:"transparent",border:"none",color:"#3f3f46",cursor:"pointer",padding:"2px 6px",fontSize:14,lineHeight:1}}>×</button>
          </div>
          <span style={{color:"#d4d4d8",fontSize:11,marginLeft:2}}>{open?"▲":"▼"}</span>
        </div>

        {open&&<div style={{padding:"12px"}}>
          {/* Name input */}
          <div style={{position:"relative",marginBottom:10}}>
            <input placeholder="Exercise name..." value={row.exercise} onChange={e=>onChange(index,"exercise",e.target.value)}
              style={{...S.input,paddingRight:row.classifying?"32px":"12px",fontSize:14}}/>
            {row.classifying&&<span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:13,color:"#ca8a04",display:"inline-block",animation:"spin 1s linear infinite"}}>⟳</span>}
          </div>

          {/* Block selector + Tracking type */}
          <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
            <div style={{display:"flex",gap:3,alignItems:"center"}}>
              <span style={{fontSize:9,color:"#71717a",fontFamily:"'Barlow',sans-serif",fontWeight:700,textTransform:"uppercase"}}>Block:</span>
              {["A","B","C","D"].map(b=>(
                <button key={b} onClick={()=>onChange(index,"block",b)}
                  style={{background:row.block===b?BLOCK_COLORS[b]+"33":"transparent",color:row.block===b?BLOCK_COLORS[b]:"#52525b",border:`1px solid ${row.block===b?BLOCK_COLORS[b]:"#e4e4e7"}`,borderRadius:5,padding:"3px 8px",cursor:"pointer",fontFamily:"'Bebas Neue',sans-serif",fontSize:13}}>
                  {b}
                </button>
              ))}
            </div>
            <div style={{width:1,height:16,background:"#e4e4e7"}}/>
            <div style={{display:"flex",gap:3,alignItems:"center"}}>
              <span style={{fontSize:9,color:"#71717a",fontFamily:"'Barlow',sans-serif",fontWeight:700,textTransform:"uppercase"}}>Type:</span>
              {["reps","duration"].map(t=>(
                <button key={t} onClick={()=>onChange(index,"trackingType",t)}
                  style={{background:row.trackingType===t?"#0ea5e922":"transparent",color:row.trackingType===t?"#0ea5e9":"#52525b",border:`1px solid ${row.trackingType===t?"#0ea5e9":"#e4e4e7"}`,borderRadius:5,padding:"3px 8px",cursor:"pointer",fontFamily:"'Barlow',sans-serif",fontSize:11,fontWeight:700}}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Sets count picker */}
          <div style={{display:"flex",gap:5,alignItems:"center",marginBottom:10}}>
            <span style={{fontSize:9,color:"#71717a",fontFamily:"'Barlow',sans-serif",fontWeight:700,textTransform:"uppercase",whiteSpace:"nowrap"}}>Sets:</span>
            {[2,3,4,5,6].map(n=>(
              <button key={n} onClick={()=>onChange(index,"sets",String(n))}
                style={{flex:1,padding:"6px 2px",background:row.sets===String(n)?"#ca8a0422":"transparent",color:row.sets===String(n)?"#ca8a04":"#71717a",border:`1px solid ${row.sets===String(n)?"#ca8a04":"#e4e4e7"}`,borderRadius:6,cursor:"pointer",fontFamily:"'Bebas Neue',sans-serif",fontSize:15}}>
                {n}
              </button>
            ))}
            <input type="number" value={row.sets} onChange={e=>onChange(index,"sets",e.target.value)}
              style={{...S.input,width:48,padding:"5px 8px",textAlign:"center",fontSize:13}} placeholder="#"/>
          </div>

          {/* Per-set tracker */}
          <SetTracker
            numSets={row.sets}
            trackingType={row.trackingType}
            setData={row.setData||[]}
            onChange={data=>onChange(index,"setData",data)}
            bestPrev={bestPrev}
          />

          {/* Notes */}
          <input placeholder="Notes / coaching cue..." value={row.note} onChange={e=>onChange(index,"note",e.target.value)}
            style={{...S.input,marginTop:10,marginBottom:10,fontSize:12}}/>

          {/* Superset pairing */}
          {rows.length>1&&(
            <div style={{marginBottom:10}}>
              <span style={{...S.label,marginBottom:4}}>Pair as superset with:</span>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {rows.map((r,j)=>j!==index&&r.exercise.trim()&&(
                  <button key={j} onClick={()=>onToggleSuperset(index,j)}
                    style={{background:row.supersetWith===j?bc+"33":"transparent",color:row.supersetWith===j?bc:"#71717a",border:`1px solid ${row.supersetWith===j?bc:"#e4e4e7"}`,borderRadius:6,padding:"4px 9px",cursor:"pointer",fontFamily:"'Barlow',sans-serif",fontSize:11,fontWeight:600}}>
                    {r.exercise.slice(0,16)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button onClick={()=>setShowRest(s=>!s)}
            style={{background:"transparent",border:"1px solid #1e1e1e",borderRadius:7,color:"#71717a",padding:"4px 10px",cursor:"pointer",fontFamily:"'Barlow',sans-serif",fontSize:11,fontWeight:600}}>
            {showRest?"▲ Rest Timer":"⏱ Rest Timer"}
          </button>
          {showRest&&<RestTimer defaultSecs={row.restSecs||90}/>}
        </div>}
      </div>
      {/* Superset connector line */}
      {isPaired&&index<total-1&&rows[index+1]?.supersetWith===index&&(
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"2px 20px"}}>
          <div style={{flex:1,height:1,background:bc+"44"}}/>
          <span style={{fontSize:8,color:bc,fontFamily:"'Barlow',sans-serif",fontWeight:700,letterSpacing:1}}>SUPERSET</span>
          <div style={{flex:1,height:1,background:bc+"44"}}/>
        </div>
      )}
    </div>
  );
}

// ─── LOG TAB ──────────────────────────────────────────────────────────────────
function LogTab({workouts,onSave,onDelete,goals,checkIns,activeWorkout,setActiveWorkout,setTab}){
  const QUICK_PROGS=[
    {id:"pc",name:"Pelvic Correction",exercises:[{name:"Psoas Release",sets:"1",category:"corrective",block:"D",trackingType:"duration"},{name:"Piriformis Stretch",sets:"1",category:"corrective",block:"D",trackingType:"duration"},{name:"Single Leg Glute Bridge",sets:"3",category:"corrective",block:"D",trackingType:"reps"},{name:"Banded Clamshell",sets:"3",category:"corrective",block:"D",trackingType:"reps"},{name:"VMO Wall Squeeze",sets:"1",category:"isometric",block:"D",trackingType:"duration"}]},
    {id:"vj",name:"Vertical Jump",exercises:[{name:"Power Clean",sets:"4",category:"power",block:"A",trackingType:"reps"},{name:"Box Jump",sets:"4",category:"plyometric",block:"A",trackingType:"reps"},{name:"Back Squat",sets:"4",category:"strength",block:"B",trackingType:"reps"},{name:"Nordic Curl",sets:"3",category:"eccentric",block:"C",trackingType:"reps"},{name:"Depth Jump",sets:"4",category:"plyometric",block:"A",trackingType:"reps"}]},
    {id:"up",name:"Heavy Upper",exercises:[{name:"Bench Press",sets:"4",category:"strength",block:"B",trackingType:"reps"},{name:"Overhead Press",sets:"3",category:"strength",block:"B",trackingType:"reps"},{name:"Weighted Pull Up",sets:"4",category:"strength",block:"B",trackingType:"reps"},{name:"Push Press",sets:"3",category:"power",block:"A",trackingType:"reps"}]},
  ];

  const emptyRow=()=>({exercise:"",sets:"3",note:"",category:"",trackingType:"reps",classifying:false,block:"",supersetWith:null,supersetLabel:"",setData:[],restSecs:90});

  const {name,rows,sessionStart,sessionActive}=activeWorkout;
  const setName=n=>setActiveWorkout(w=>({...w,name:n}));
  const setRows=fn=>setActiveWorkout(w=>({...w,rows:typeof fn==="function"?fn(w.rows):fn}));

  const [histExpanded,setHistExpanded]=useState(null);
  const [aiPrompt,setAiPrompt]=useState("");
  const [aiBuilding,setAiBuilding]=useState(false);
  const [aiPlan,setAiPlan]=useState(null);
  const [showAI,setShowAI]=useState(false);
  const [grouping,setGrouping]=useState(false);
  const [saved,setSaved]=useState(false);
  const classifyTimers=useRef({});

  // Get best previous weight for exercise
  function getBestPrev(exName){
    if(!exName.trim())return null;
    let best=0;
    workouts.forEach(w=>{
      w.exercises?.forEach(ex=>{
        if(ex.exercise?.toLowerCase()===exName.toLowerCase()){
          const fromSets=ex.setData?.reduce((m,s)=>parseFloat(s.weight||0)>m?parseFloat(s.weight):m,0)||0;
          const fromField=parseFloat(ex.weight||0);
          best=Math.max(best,fromSets,fromField);
        }
      });
    });
    return best>0?best:null;
  }

  function handleChange(i,field,value){
    setRows(r=>r.map((row,idx)=>{
      if(idx!==i)return row;
      const updated={...row,[field]:value};
      if(field==="exercise"&&value.trim().length>2){
        if(classifyTimers.current[i])clearTimeout(classifyTimers.current[i]);
        classifyTimers.current[i]=setTimeout(async()=>{
          setRows(r2=>r2.map((rw,id2)=>id2===i?{...rw,classifying:true}:rw));
          const res=await autoClassify(value);
          if(res)setRows(r2=>r2.map((rw,id2)=>id2===i?{...rw,category:res.category||rw.category,trackingType:res.trackingType||rw.trackingType,block:rw.block||res.block||"",note:rw.note||res.note||"",classifying:false}:rw));
          else setRows(r2=>r2.map((rw,id2)=>id2===i?{...rw,classifying:false}:rw));
        },900);
      }
      return updated;
    }));
  }

  function moveRow(i,dir){
    setRows(r=>{const a=[...r];const j=i+dir;if(j<0||j>=a.length)return a;[a[i],a[j]]=[a[j],a[i]];return a;});
  }

  function toggleSuperset(i,j){
    setRows(r=>{
      const a=r.map(x=>({...x}));
      if(a[i].supersetWith===j){
        a[i].supersetWith=null;a[i].supersetLabel="";
        a[j].supersetWith=null;a[j].supersetLabel="";
      } else {
        const block=a[i].block||"A";
        a[i].supersetWith=j;a[i].supersetLabel=`${block}1`;
        a[j].supersetWith=i;a[j].supersetLabel=`${block}2`;a[j].block=block;
      }
      return a;
    });
  }

  async function handleAutoGroup(){
    if(!rows.some(r=>r.exercise.trim()))return;
    setGrouping(true);
    const assignments=await autoGroupBlocks(rows);
    if(assignments.length){
      setRows(r=>r.map((rw,i)=>{
        const a=assignments.find(x=>x.index===i);
        if(!a)return rw;
        return{...rw,block:a.block||rw.block,supersetWith:a.supersetWith??null,supersetLabel:a.supersetLabel||""};
      }));
    }
    setGrouping(false);
  }

  function loadProg(p){
    setName(p.name);
    setRows(p.exercises.map(e=>({...emptyRow(),exercise:e.name,sets:String(e.sets||3),category:e.category||"",trackingType:e.trackingType||"reps",block:e.block||""})));
    if(!sessionActive)setActiveWorkout(w=>({...w,sessionStart:Date.now(),sessionActive:true}));
  }

  // Used by Coach tab to push a workout here
  function loadPlan(plan){
    if(!plan?.exercises?.length)return;
    setName(plan.sessionName||"AI Workout");
    setRows(plan.exercises.map(e=>({...emptyRow(),exercise:e.name,sets:String(e.sets||3),note:e.note||"",category:e.category||"",trackingType:e.trackingType||"reps",restSecs:e.restSecs||90,block:e.block||"",supersetWith:typeof e.supersetWith==="number"?e.supersetWith:null,supersetLabel:e.supersetLabel||""})));
    setActiveWorkout(w=>({...w,sessionStart:Date.now(),sessionActive:true}));
  }
  // Expose for coach
  useEffect(()=>{window.__apexLoadPlan=loadPlan;},[]);

  async function handleBuildAI(){
    if(!aiPrompt.trim())return;
    setAiBuilding(true);setAiPlan(null);
    const ci=checkIns.find(c=>c.date===today());
    const plan=await buildAIWorkout(aiPrompt,workouts,goals,ci);
    setAiPlan(plan);setAiBuilding(false);
  }

  function handleSave(){
    if(!name.trim())return;
    const duration=sessionStart?Math.floor((Date.now()-sessionStart)/1000):0;
    onSave({id:Date.now(),date:today(),name,exercises:rows.filter(r=>r.exercise.trim()),duration});
    setSaved(true);
    setActiveWorkout(w=>({...w,name:"",rows:[emptyRow()],sessionStart:null,sessionActive:false}));
    setTimeout(()=>setSaved(false),2000);
  }

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <STitle sub="Per-set tracking · Supersets · Reorder">LOG WORKOUT</STitle>
        {sessionActive&&<WorkoutTimer startTime={sessionStart}/>}
      </div>

      {sessionActive&&(
        <div style={{background:"#16a34a18",border:"1px solid #22c55e33",borderRadius:10,padding:"7px 14px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontFamily:"'Barlow',sans-serif",fontSize:12,color:"#16a34a"}}>🟢 {name||"Workout"} — in progress</span>
          <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:11,color:"#16a34a"}}>TAB SAFE ✓</span>
        </div>
      )}

      {/* Quick load */}
      <span style={S.label}>Quick Load</span>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
        {QUICK_PROGS.map(p=>(
          <button key={p.id} onClick={()=>loadProg(p)} style={{background:"transparent",color:"#71717a",border:"1px solid #1e1e1e",borderRadius:20,padding:"5px 12px",cursor:"pointer",fontFamily:"'Barlow',sans-serif",fontWeight:600,fontSize:11}}>{p.name}</button>
        ))}
        <button onClick={()=>setShowAI(s=>!s)} style={{background:showAI?"#7c3aed33":"transparent",color:showAI?"#7c3aed":"#71717a",border:`1px solid ${showAI?"#7c3aed":"#e4e4e7"}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontFamily:"'Barlow',sans-serif",fontWeight:700,fontSize:11}}>🧠 AI Builder</button>
      </div>

      {/* AI Builder — full coach-style layout */}
      {showAI&&(
        <div style={{...S.card,background:"#7c3aed0d",border:"1px solid #B388FF33",marginBottom:14}}>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:"#7c3aed",marginBottom:10}}>🧠 AI WORKOUT BUILDER</div>
          <input placeholder="e.g. Heavy legs, 60 mins, game tomorrow..." value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleBuildAI()} style={{...S.input,marginBottom:8}}/>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
            {["Heavy legs + power","Upper push pull","Full body athletic","Mobility + corrective","Quick 20 min","Pre-game activate"].map(s=>(
              <button key={s} onClick={()=>setAiPrompt(s)} style={{background:"#7c3aed22",color:"#7c3aed",border:"1px solid #c4b5fd",borderRadius:8,padding:"5px 9px",cursor:"pointer",fontFamily:"'Barlow',sans-serif",fontSize:11,fontWeight:600}}>{s}</button>
            ))}
          </div>
          <button onClick={handleBuildAI} disabled={aiBuilding} style={{...S.btn("#7c3aed","#fff"),width:"100%",opacity:aiBuilding?.6:1}}>
            {aiBuilding?"BUILDING PLAN...":"BUILD WORKOUT"}
          </button>
          {aiBuilding&&(
            <div style={{textAlign:"center",padding:"20px 0"}}>
              <div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:8}}>
                {[0,1,2].map(i=><div key={i} style={{width:8,height:8,borderRadius:"50%",background:"#7c3aed",animation:`pulse 1.2s ${i*.4}s infinite`}}/>)}
              </div>
              <div style={{fontFamily:"'Barlow',sans-serif",fontSize:12,color:"#71717a"}}>Analyzing your training history...</div>
            </div>
          )}
          {aiPlan&&!aiBuilding&&(()=>{
            const SM_LOG={ready_to_train:{color:"#16a34a",icon:"🟢",label:"READY"},light_day:{color:"#ca8a04",icon:"🟡",label:"LIGHT DAY"},recovery_day:{color:"#f97316",icon:"🟠",label:"RECOVERY"}};
            const sm=SM_LOG[aiPlan.status]||SM_LOG.ready_to_train;
            const CC_LOG={power:"#dc2626",strength:"#ca8a04",mobility:"#0ea5e9",corrective:"#7c3aed",isometric:"#16a34a",cardio:"#60a5fa",hypertrophy:"#f97316"};
            return(
              <div style={{marginTop:14}}>
                {/* Status + headline */}
                <div style={{background:sm.color+"18",border:`1px solid ${sm.color}44`,borderRadius:12,padding:"12px 14px",marginBottom:10}}>
                  <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:6}}>
                    <span style={{fontSize:18}}>{sm.icon}</span>
                    <div>
                      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:13,color:sm.color}}>{sm.label} · {aiPlan.estimatedDuration}</div>
                      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,lineHeight:1.1}}>{aiPlan.headline||aiPlan.sessionName}</div>
                    </div>
                  </div>
                  {aiPlan.reasoning&&<div style={{fontFamily:"'Barlow',sans-serif",fontSize:12,color:"#52525b",lineHeight:1.5}}>{aiPlan.reasoning}</div>}
                </div>

                {/* Warnings */}
                {aiPlan.warnings?.length>0&&(
                  <div style={{background:"#dc26260d",border:"1px solid #FF3D0033",borderRadius:10,padding:"10px 14px",marginBottom:10}}>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:12,color:"#dc2626",marginBottom:5}}>⚠️ KEEP IN MIND</div>
                    {aiPlan.warnings.map((w,i)=>(
                      <div key={i} style={{display:"flex",gap:6,marginBottom:3}}>
                        <span style={{color:"#dc2626",fontSize:10}}>✕</span>
                        <span style={{fontFamily:"'Barlow',sans-serif",fontSize:12,color:"#374151"}}>{w}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Block-by-block breakdown */}
                {aiPlan.blocks?.length>0&&(
                  <div style={{...S.card,background:"#f9f9f9",padding:"12px 14px",marginBottom:10}}>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,color:"#ca8a04",marginBottom:10}}>SESSION PLAN</div>
                    {aiPlan.blocks.map((blk,bi)=>{
                      const bc=CC_LOG[blk.category]||"#71717a";
                      return(
                        <div key={bi} style={{marginBottom:12}}>
                          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:12,color:bc,borderBottom:`1px solid ${bc}33`,paddingBottom:3,marginBottom:6}}>
                            {blk.label}
                            {blk.note&&<span style={{fontSize:10,color:"#71717a",fontFamily:"'Barlow',sans-serif",marginLeft:8,fontWeight:400}}>{blk.note}</span>}
                          </div>
                          {blk.exercises?.map((ex,ei)=>(
                            <div key={ei} style={{padding:"6px 8px",background:"#fff",borderRadius:7,marginBottom:3,display:"flex",gap:8,alignItems:"center"}}>
                              <span style={{width:4,height:4,borderRadius:"50%",background:bc,flexShrink:0,display:"inline-block"}}/>
                              <span style={{fontFamily:"'Barlow',sans-serif",fontSize:13,color:"#18181b"}}>{ex}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Quick tip */}
                {aiPlan.quick_tip&&(
                  <div style={{background:"#0ea5e90d",border:"1px solid #00E5FF33",borderRadius:10,padding:"10px 14px",marginBottom:10}}>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:12,color:"#0ea5e9",marginBottom:3}}>💡 SESSION TIP</div>
                    <div style={{fontFamily:"'Barlow',sans-serif",fontSize:12,color:"#52525b",lineHeight:1.5}}>{aiPlan.quick_tip}</div>
                  </div>
                )}

                <button onClick={()=>{loadPlan(aiPlan);setShowAI(false);setAiPlan(null);setAiPrompt("");}}
                  style={{...S.btn("#ca8a04","#000"),width:"100%",fontSize:18}}>
                  → LOAD INTO LOG
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* Name + Start */}
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <input placeholder="Workout name..." value={name} onChange={e=>setName(e.target.value)} style={{...S.input,flex:1,fontSize:15}}/>
        {!sessionActive&&(
          <button onClick={()=>setActiveWorkout(w=>({...w,sessionStart:Date.now(),sessionActive:true}))}
            style={{...S.btn("#16a34a","#000"),padding:"8px 14px",fontSize:13,whiteSpace:"nowrap"}}>▶ START</button>
        )}
      </div>

      {/* AI Group */}
      {rows.some(r=>r.exercise.trim())&&(
        <button onClick={handleAutoGroup} disabled={grouping}
          style={{...S.btn("#ca8a0418","#ca8a04"),border:"1px solid #E8FF0033",fontSize:13,padding:"7px 14px",width:"100%",marginBottom:12,opacity:grouping?.6:1}}>
          {grouping?"🧠 GROUPING...":"🧠 AI — AUTO GROUP INTO BLOCKS & SUPERSETS"}
        </button>
      )}

      {/* Exercise rows */}
      {rows.map((row,i)=>(
        <ExerciseRow
          key={i}
          row={row}
          index={i}
          total={rows.length}
          rows={rows}
          onDelete={idx=>setRows(r=>r.filter((_,j)=>j!==idx))}
          onMove={moveRow}
          onChange={handleChange}
          onToggleSuperset={toggleSuperset}
          bestPrev={getBestPrev(row.exercise)}
        />
      ))}

      <div style={{display:"flex",gap:8,marginBottom:28}}>
        <button onClick={()=>setRows(r=>[...r,emptyRow()])} style={{...S.btn("transparent","#71717a"),border:"1px solid #1e1e1e",fontSize:13}}>+ Exercise</button>
        <button onClick={handleSave} style={{...S.btn(saved?"#16a34a":"#ca8a04",saved?"#fff":"#000"),flex:1}}>
          {saved?"✓ SAVED":sessionActive?"FINISH & SAVE":"SAVE WORKOUT"}
        </button>
      </div>

      {/* History */}
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,marginBottom:12}}>HISTORY</div>
      {workouts.length===0
        ?<div style={{color:"#d4d4d8",fontFamily:"'Barlow',sans-serif",fontSize:13,textAlign:"center",padding:"20px 0"}}>No workouts yet.</div>
        :[...workouts].reverse().map(w=>(
          <div key={w.id} style={{...S.card,padding:0,overflow:"hidden"}}>
            <div onClick={()=>setHistExpanded(histExpanded===w.id?null:w.id)}
              style={{padding:"12px 16px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:17}}>{w.name}</div>
                <div style={{fontSize:11,color:"#71717a",fontFamily:"'Barlow',sans-serif"}}>{fmtDate(w.date)} · {w.exercises?.length||0} exercises{w.duration?` · ${fmtSecs(w.duration)}`:""}</div>
              </div>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                <span style={{color:"#d4d4d8"}}>{histExpanded===w.id?"▲":"▼"}</span>
                <button onClick={e=>{e.stopPropagation();onDelete(w.id);}} style={{background:"none",border:"none",color:"#d4d4d8",cursor:"pointer"}}>🗑</button>
              </div>
            </div>
            {histExpanded===w.id&&(
              <div style={{padding:"0 16px 14px"}}>
                {w.exercises?.map((ex,i)=>{
                  const meta=ex.category?CAT_META[ex.category]:null;
                  const bc=ex.block?BLOCK_COLORS[ex.block]:"#71717a";
                  const bestSet=ex.setData?.reduce((b,s)=>parseFloat(s.weight||0)>b?parseFloat(s.weight):b,0)||null;
                  return(
                    <div key={i} style={{padding:"7px 0",borderBottom:"1px solid #181818"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div style={{display:"flex",gap:6,alignItems:"center"}}>
                          {ex.block&&<span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:10,color:bc,background:bc+"22",padding:"1px 5px",borderRadius:4}}>{ex.supersetLabel||ex.block}</span>}
                          <div>
                            <div style={{fontFamily:"'Barlow',sans-serif",fontSize:13}}>{ex.exercise}</div>
                            {meta&&<Tag color={meta.color}>{meta.icon} {meta.label}</Tag>}
                          </div>
                        </div>
                        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,color:"#ca8a04",textAlign:"right"}}>
                          {bestSet?`${bestSet}lbs`:`${ex.sets}×`}
                        </div>
                      </div>
                      {ex.setData?.some(s=>s.weight||s.value)&&(
                        <div style={{marginTop:5,display:"flex",gap:5,flexWrap:"wrap"}}>
                          {ex.setData.map((s,si)=>(s.weight||s.value)&&(
                            <span key={si} style={{fontSize:10,padding:"2px 7px",borderRadius:4,background:s.done?"#16a34a22":"#f9f9f9",color:s.done?"#16a34a":"#71717a",fontFamily:"'Barlow',sans-serif",fontWeight:700}}>
                              S{si+1}: {s.weight?`${s.weight}lb`:""}{s.value?` ×${s.value}`:""}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))
      }
      <style>{`@keyframes spin{from{transform:translateY(-50%) rotate(0deg)}to{transform:translateY(-50%) rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── COACH TAB ────────────────────────────────────────────────────────────────
function CoachTab({workouts,cardioLog,bbLog,goals,checkIns,injuries,prs,coachState,setCoachState,setActiveWorkout,setTab}){
  const {chat,advice,time,suggestions,sugLoaded,chatInput,customQ}=coachState;
  const set=(key,val)=>setCoachState(s=>({...s,[key]:typeof val==="function"?val(s[key]):val}));
  const [loading,setLoading]=useState(false);
  const [chatLoading,setChatLoading]=useState(false);
  const [sugLoading,setSugLoading]=useState(false);
  const chatEndRef=useRef(null);
  useEffect(()=>{chatEndRef.current?.scrollIntoView({behavior:"smooth"});},[chat]);

  function buildCtx(){
    const ci=checkIns.find(c=>c.date===today());
    const recent=[...workouts,...(cardioLog||[]).map(c=>({...c,_c:1})),...bbLog.map(b=>({...b,_b:1}))].filter(e=>e.date>=daysAgo(7)).sort((a,b)=>b.date.localeCompare(a.date));
    const fmt=items=>items.map(e=>e._b?`Ball(${e.sessionType})LKnee:${e.body?.kneeLeft||"?"}`:e._c?`Cardio:${e.type}`:`Lift:${e.name}(${(e.exercises||[]).slice(0,4).map(x=>x.exercise).join(",")})`).join("|")||"none";
    const histSummary=chat.slice(-30).map(m=>`${m.role==="user"?"You":"Coach"}: ${String(m.content).slice(0,120)}`).join("\n");
    return `ATHLETE: Basketball, left knee patellofemoral + left hip anterior rotation.
CHECK-IN: Sleep ${ci?.sleep||"?"}h Energy ${ci?.energy||"?"}/5 Soreness ${ci?.soreness||"?"}/5 LKnee ${ci?.kneeLeft||"?"}
TODAY: ${fmt(recent.filter(e=>e.date===today()))}
YESTERDAY: ${fmt(recent.filter(e=>e.date===daysAgo(1)))}
LAST 7D: ${fmt(recent.slice(0,8))}
GOALS: ${goals.map(g=>`${g.name}:${g.current}/${g.target}${g.unit}(${progressPct(g.current,g.target,g.category)}%)`).join(",")}
TIME: ${time} mins
CONVERSATION HISTORY:\n${histSummary||"None yet."}`;
  }

  function loadWorkoutToLog(plan){
    if(!plan?.exercises?.length)return;
    if(window.__apexLoadPlan){window.__apexLoadPlan(plan);setTab("LOG");}
    else{
      setActiveWorkout(w=>({...w,name:plan.sessionName||"AI Workout",rows:plan.exercises.map(e=>({exercise:e.name,sets:String(e.sets||3),note:e.note||"",category:e.category||"",trackingType:e.trackingType||"reps",restSecs:90,classifying:false,block:e.block||"",supersetWith:null,supersetLabel:"",setData:[]})),sessionStart:Date.now(),sessionActive:true}));
      setTab("LOG");
    }
  }

  async function loadSuggestions(){
    setSugLoading(true);
    const s=await getProactiveSuggestions(workouts,bbLog,goals,prs);
    set("suggestions",s);setSugLoading(false);set("sugLoaded",true);
  }

  async function getAdvice(prompt){
    setLoading(true);set("advice",null);
    set("chat",c=>[...c,{role:"user",content:prompt,ts:Date.now()}]);set("customQ","");
    try{
      const text=await callCoach(
        `Expert athletic coach. If user asks to build a workout, fill workout_plan. ONLY valid JSON:
{"status":"ready_to_train|light_day|recovery_day|rest_day","headline":"max 8 words","reasoning":"2-3 sentences","warnings":["avoid"],"recommended_session":{"type":"name","duration":"X mins","blocks":[{"category":"power|strength|mobility|corrective","label":"Block","exercises":["Ex (sets x reps)"],"note":"cue"}]},"workout_plan":null,"after_this":"24-48h tip","weekly_gaps":["list"],"quick_tip":"tip"}
workout_plan (only if explicitly asked): {"sessionName":"name","exercises":[{"name":"Name","sets":3,"reps":"8","weight":"suggestion","category":"strength","block":"A","note":"cue","trackingType":"reps"}]}`,
        [...chat.slice(-14).map(m=>({role:m.role,content:String(m.content)})),{role:"user",content:`${buildCtx()}\n\nQ: ${prompt}`}]
      );
      const parsed=JSON.parse(text.replace(/```json|```/g,"").trim());
      set("advice",parsed);
      set("chat",c=>[...c,{role:"assistant",content:parsed.headline+(parsed.reasoning?"\n\n"+parsed.reasoning:""),ts:Date.now()}]);
      if(parsed.workout_plan?.exercises?.length){
        set("chat",c=>[...c,{role:"assistant",content:"💪 Workout built and ready to load into your Log.",ts:Date.now(),workoutPlan:parsed.workout_plan}]);
      }
    }catch{set("advice",{error:"Couldn't reach AI. Check ANTHROPIC_API_KEY in Vercel env vars."});}
    setLoading(false);
  }

  async function sendChat(msg){
    if(!msg.trim())return;
    set("chat",c=>[...c,{role:"user",content:msg,ts:Date.now()}]);set("chatInput","");
    setChatLoading(true);
    try{
      const history=chat.slice(-16).map(m=>({role:m.role,content:String(m.content)}));
      const reply=await callCoach(
        `Expert athletic coach for basketball player with left knee patellofemoral issues. Direct, specific, under 200 words. Build on conversation history.
If asked to build/create/make a workout ONLY respond with this JSON: {"text":"your message","workout_plan":{"sessionName":"name","exercises":[{"name":"Name","sets":3,"reps":"8","weight":"suggestion","category":"strength","block":"A","note":"cue","trackingType":"reps"}]}}
Otherwise respond with PLAIN TEXT only.\n\n${buildCtx()}`,
        [...history,{role:"user",content:msg}],500
      );
      let content=reply;let workoutPlan=null;
      try{const p=JSON.parse(reply.replace(/```json|```/g,"").trim());if(p.text){content=p.text;workoutPlan=p.workout_plan||null;}}catch{}
      set("chat",c=>[...c,{role:"assistant",content,ts:Date.now()}]);
      if(workoutPlan?.exercises?.length){
        set("chat",c=>[...c,{role:"assistant",content:"💪 Workout built — tap below to load it straight into your Log.",ts:Date.now(),workoutPlan}]);
      }
    }catch{set("chat",c=>[...c,{role:"assistant",content:"Connection error. Check deployment.",ts:Date.now()}]);}
    setChatLoading(false);
  }

  const SM={ready_to_train:{color:"#16a34a",icon:"🟢",label:"READY"},light_day:{color:"#ca8a04",icon:"🟡",label:"LIGHT DAY"},recovery_day:{color:"#f97316",icon:"🟠",label:"RECOVERY"},rest_day:{color:"#dc2626",icon:"🔴",label:"REST DAY"}};
  const CC={power:"#dc2626",strength:"#ca8a04",mobility:"#0ea5e9",corrective:"#7c3aed",isometric:"#16a34a",cardio:"#60a5fa",hypertrophy:"#f97316"};
  const QUICK=[{label:"What to do today?",p:`What should I train today? ${time} mins available.`},{label:"Played ball yesterday",p:"I played basketball yesterday. What can I lift today?"},{label:"Game tomorrow",p:"I have a game tomorrow. What do I do today?"},{label:"Build me a power workout",p:`Build me a complete power workout for ${time} minutes with A/B/C/D blocks.`},{label:"Recovery day plan",p:"Design an optimal recovery day for me."},{label:"What's missing this week?",p:"What training types am I missing this week based on my log?"}];

  return(
    <div>
      <STitle sub="All-time memory · Persists tabs · One-tap load to Log">🧠 COACH</STitle>

      {/* Smart Suggestions */}
      <div style={{...S.card,background:"#f9f9f9",marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,color:"#ca8a04"}}>⚡ SMART SUGGESTIONS</div>
          <button onClick={loadSuggestions} disabled={sugLoading}
            style={{...S.btn("#ca8a0422","#ca8a04"),border:"1px solid #fde047",padding:"5px 10px",fontSize:12,opacity:sugLoading?.6:1}}>
            {sugLoading?"...":(sugLoaded?"REFRESH":"LOAD")}
          </button>
        </div>
        {!sugLoaded&&<div style={{fontSize:12,color:"#71717a",fontFamily:"'Barlow',sans-serif"}}>Tap Load for proactive suggestions from your training history.</div>}
        {suggestions.map((s,i)=>{
          const pc=s.type==="warning"?"#dc2626":s.type==="pr_chase"?"#ca8a04":"#0ea5e9";
          return(
            <div key={i} style={{background:pc+"0d",border:`1px solid ${pc}33`,borderRadius:10,padding:"9px 12px",marginBottom:6}}>
              <div style={{display:"flex",gap:8}}><span style={{fontSize:18}}>{s.icon}</span><div>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,color:pc}}>{s.title}</div>
                <div style={{fontFamily:"'Barlow',sans-serif",fontSize:12,color:"#52525b",lineHeight:1.4}}>{s.body}</div>
                {s.action&&<div style={{fontSize:11,color:"#ca8a04",fontFamily:"'Barlow',sans-serif",fontWeight:700,marginTop:2}}>→ {s.action}</div>}
              </div></div>
            </div>
          );
        })}
      </div>

      {/* Time */}
      <span style={S.label}>Time available</span>
      <div style={{display:"flex",gap:6,marginBottom:14}}>
        {["20","30","45","60","90"].map(t=>(
          <button key={t} onClick={()=>set("time",t)}
            style={{flex:1,padding:"7px 4px",background:time===t?"#ca8a04":"transparent",color:time===t?"#000":"#71717a",border:`1px solid ${time===t?"#ca8a04":"#e4e4e7"}`,borderRadius:8,cursor:"pointer",fontFamily:"'Bebas Neue',sans-serif",fontSize:16}}>
            {t}m
          </button>
        ))}
      </div>

      {/* Quick prompts */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
        {QUICK.map(q=>(
          <button key={q.label} onClick={()=>getAdvice(q.p)}
            style={{background:"#f9f9f9",color:"#71717a",border:"1px solid #1e1e1e",borderRadius:10,padding:"10px 12px",cursor:"pointer",fontFamily:"'Barlow',sans-serif",fontWeight:600,fontSize:11,textAlign:"left",lineHeight:1.3}}>
            {q.label}
          </button>
        ))}
      </div>
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        <input placeholder="Ask anything..." value={customQ} onChange={e=>set("customQ",e.target.value)} onKeyDown={e=>e.key==="Enter"&&customQ.trim()&&getAdvice(customQ)} style={{...S.input,flex:1}}/>
        <button onClick={()=>customQ.trim()&&getAdvice(customQ)} style={{...S.btn("#ca8a04","#000"),padding:"8px 14px",fontSize:15}}>ASK</button>
      </div>

      {/* Advice card */}
      {loading&&(
        <div style={{...S.card,background:"#f9f9f9",textAlign:"center",padding:"28px"}}>
          <div style={{fontSize:28,marginBottom:8}}>🧠</div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:"#ca8a04"}}>ANALYZING YOUR DATA...</div>
          <div style={{display:"flex",justifyContent:"center",gap:6,marginTop:12}}>
            {[0,1,2].map(i=><div key={i} style={{width:8,height:8,borderRadius:"50%",background:"#ca8a04",animation:`pulse 1.2s ${i*.4}s infinite`}}/>)}
          </div>
        </div>
      )}
      {advice?.error&&<div style={{...S.card,background:"#dc26260d",border:"1px solid #FF3D0033"}}><div style={{color:"#dc2626",fontFamily:"'Barlow',sans-serif",fontSize:13}}>{advice.error}</div></div>}
      {advice&&!advice.error&&!loading&&(()=>{
        const sm=SM[advice.status]||SM.ready_to_train;
        return(
          <div style={{marginBottom:16}}>
            <div style={{background:sm.color+"18",border:`1px solid ${sm.color}44`,borderRadius:14,padding:"14px 16px",marginBottom:10}}>
              <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:6}}>
                <span style={{fontSize:18}}>{sm.icon}</span>
                <div>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,color:sm.color}}>{sm.label}</div>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,lineHeight:1.1}}>{advice.headline}</div>
                </div>
              </div>
              <div style={{fontFamily:"'Barlow',sans-serif",fontSize:13,color:"#52525b",lineHeight:1.5}}>{advice.reasoning}</div>
            </div>
            {advice.warnings?.length>0&&(
              <div style={{...S.card,background:"#dc26260d",border:"1px solid #FF3D0033",marginBottom:10}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:13,color:"#dc2626",marginBottom:6}}>⚠️ AVOID TODAY</div>
                {advice.warnings.map((w,i)=><div key={i} style={{display:"flex",gap:6,marginBottom:4}}><span style={{color:"#dc2626",fontSize:11}}>✕</span><span style={{fontFamily:"'Barlow',sans-serif",fontSize:13,color:"#374151"}}>{w}</span></div>)}
              </div>
            )}
            {advice.recommended_session&&(
              <div style={{...S.card,background:"#f9f9f9",marginBottom:10}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:17,color:"#ca8a04",marginBottom:2}}>{advice.recommended_session.type}</div>
                <div style={{fontSize:11,color:"#71717a",fontFamily:"'Barlow',sans-serif",marginBottom:10}}>{advice.recommended_session.duration}</div>
                {advice.recommended_session.blocks?.map((blk,bi)=>{
                  const bc=CC[blk.category]||"#71717a";
                  return(
                    <div key={bi} style={{marginBottom:10}}>
                      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:12,color:bc,borderBottom:`1px solid ${bc}33`,paddingBottom:3,marginBottom:5}}>
                        {blk.label}{blk.note&&<span style={{fontSize:10,color:"#71717a",fontFamily:"'Barlow',sans-serif",marginLeft:8}}>{blk.note}</span>}
                      </div>
                      {blk.exercises?.map((ex,ei)=>(
                        <div key={ei} style={{padding:"5px 8px",background:"#fff",borderRadius:6,marginBottom:3,display:"flex",gap:8,alignItems:"center"}}>
                          <span style={{width:4,height:4,borderRadius:"50%",background:bc,flexShrink:0,display:"inline-block"}}/>
                          <span style={{fontFamily:"'Barlow',sans-serif",fontSize:13}}>{ex}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
                {advice.workout_plan?.exercises?.length>0&&(
                  <button onClick={()=>loadWorkoutToLog(advice.workout_plan)} style={{...S.btn("#ca8a04","#000"),width:"100%",marginTop:6}}>→ LOAD INTO LOG</button>
                )}
              </div>
            )}
            {advice.quick_tip&&(
              <div style={{...S.card,background:"#0ea5e90d",border:"1px solid #00E5FF33"}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:13,color:"#0ea5e9",marginBottom:4}}>💡 TIP</div>
                <div style={{fontFamily:"'Barlow',sans-serif",fontSize:13,color:"#52525b",lineHeight:1.5}}>{advice.quick_tip}</div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Chat */}
      <div style={{marginTop:8}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18}}>COACH CHAT</div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {chat.length>0&&<span style={{fontSize:10,color:"#71717a",fontFamily:"'Barlow',sans-serif"}}>{chat.length} msgs</span>}
            {chat.length>0&&<button onClick={()=>set("chat",[])} style={{...S.btn("transparent","#3f3f46"),border:"1px solid #1e1e1e",fontSize:11,padding:"3px 8px"}}>Clear</button>}
          </div>
        </div>
        {chat.length===0&&(
          <div style={{fontSize:12,color:"#71717a",fontFamily:"'Barlow',sans-serif",marginBottom:12,padding:"12px",background:"#f9f9f9",borderRadius:8,lineHeight:1.6}}>
            All-time conversation history. Stays when you switch tabs. AI remembers your previous messages. Say "build me a workout" and tap Load to send it straight to the Log.
          </div>
        )}
        {chat.length>0&&(
          <div style={{marginBottom:12,maxHeight:420,overflowY:"auto",display:"flex",flexDirection:"column",gap:8}}>
            {chat.map((msg,i)=>(
              <div key={i} style={{display:"flex",flexDirection:"column",alignItems:msg.role==="user"?"flex-end":"flex-start"}}>
                <div style={{maxWidth:"88%",padding:"9px 13px",borderRadius:msg.role==="user"?"14px 14px 4px 14px":"14px 14px 14px 4px",background:msg.role==="user"?"#ca8a04":"#e4e4e7",color:msg.role==="user"?"#000":"#18181b",fontFamily:"'Barlow',sans-serif",fontSize:13,lineHeight:1.5,whiteSpace:"pre-wrap"}}>
                  {msg.content}
                </div>
                {msg.workoutPlan?.exercises?.length>0&&(
                  <button onClick={()=>loadWorkoutToLog(msg.workoutPlan)} style={{...S.btn("#ca8a04","#000"),marginTop:5,padding:"8px 16px",fontSize:14,alignSelf:"flex-start"}}>
                    → LOAD INTO LOG
                  </button>
                )}
                {msg.ts&&<div style={{fontSize:9,color:"#d4d4d8",fontFamily:"'Barlow',sans-serif",marginTop:2,marginLeft:4,marginRight:4}}>{new Date(msg.ts).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>}
              </div>
            ))}
            {chatLoading&&(
              <div style={{display:"flex",justifyContent:"flex-start"}}>
                <div style={{background:"#e4e4e7",borderRadius:"14px 14px 14px 4px",padding:"10px 14px",display:"flex",gap:5}}>
                  {[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:"#ca8a04",animation:`pulse 1.2s ${i*.4}s infinite`}}/>)}
                </div>
              </div>
            )}
            <div ref={chatEndRef}/>
          </div>
        )}
        <div style={{display:"flex",gap:8}}>
          <input placeholder="Ask or say what you want to do..." value={chatInput} onChange={e=>set("chatInput",e.target.value)} onKeyDown={e=>e.key==="Enter"&&!chatLoading&&sendChat(chatInput)} style={{...S.input,flex:1}}/>
          <button onClick={()=>sendChat(chatInput)} disabled={chatLoading} style={{...S.btn("#ca8a04","#000"),padding:"8px 14px",fontSize:15,opacity:chatLoading?.5:1}}>→</button>
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:.2}50%{opacity:1}}`}</style>
    </div>
  );
}

// ─── SHARED ACTIVITY HELPERS ──────────────────────────────────────────────────
function getActivityForDate(date, workouts, bbLog, cardioLog){
  const acts=[];
  workouts.filter(w=>w.date===date).forEach(w=>{
    const cats=[...new Set((w.exercises||[]).map(e=>e.category).filter(Boolean))];
    acts.push({type:"workout",label:w.name,cats,icon:"💪",color:"#ca8a04"});
  });
  bbLog.filter(b=>b.date===date).forEach(b=>{
    acts.push({type:"ball",label:b.sessionType?.replace("_"," ")||"Ball",icon:"🏀",color:"#f97316"});
  });
  (cardioLog||[]).filter(c=>c.date===date).forEach(c=>{
    acts.push({type:"cardio",label:c.type||"Cardio",icon:"🏃",color:"#60a5fa"});
  });
  return acts;
}

function calcStreaks(workouts, bbLog, cardioLog){
  const all=new Set([...workouts.map(w=>w.date),...bbLog.map(b=>b.date),...(cardioLog||[]).map(c=>c.date)]);
  let current=0; for(let i=0;i<365;i++){if(all.has(daysAgo(i)))current++;else break;}
  let longest=0,run=0;
  for(let i=364;i>=0;i--){if(all.has(daysAgo(i))){run++;longest=Math.max(longest,run);}else run=0;}
  return{current,longest,total:all.size};
}

// ─── WEEKLY STRIP (used on Dashboard) ────────────────────────────────────────
function WeekStrip({workouts,bbLog,cardioLog,setTab}){
  const days=[];
  const todayDate=today();
  // Build Sun–Sat of current week
  const now=new Date();
  const dow=now.getDay();
  for(let i=0;i<7;i++){
    const d=new Date(now);d.setDate(now.getDate()-dow+i);
    days.push(d.toISOString().split("T")[0]);
  }
  const DAY_LABELS=["S","M","T","W","T","F","S"];

  return(
    <div style={{...S.card,padding:"14px 12px",marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,letterSpacing:1}}>THIS WEEK</div>
        <button onClick={()=>setTab("MONTHLY")} style={{background:"transparent",border:"1px solid #1e1e1e",borderRadius:6,color:"#71717a",padding:"3px 10px",cursor:"pointer",fontFamily:"'Barlow',sans-serif",fontSize:11,fontWeight:700}}>Full Calendar →</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
        {days.map((d,i)=>{
          const acts=getActivityForDate(d,workouts,bbLog,cardioLog);
          const isToday=d===todayDate;
          const isFuture=d>todayDate;
          const hasAny=acts.length>0;
          return(
            <div key={d} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
              <div style={{fontSize:9,fontFamily:"'Barlow',sans-serif",fontWeight:700,color:isToday?"#ca8a04":"#3f3f46",textTransform:"uppercase"}}>{DAY_LABELS[i]}</div>
              <div style={{fontSize:9,fontFamily:"'Barlow',sans-serif",color:isToday?"#ca8a04":"#52525b"}}>{new Date(d+"T12:00:00").getDate()}</div>
              {/* Activity dots */}
              <div style={{width:32,minHeight:36,background:isToday?"#E8FF0008":"#fff",border:`1px solid ${isToday?"#ca8a0433":hasAny?"#d4d4d8":"#f0f0f0"}`,borderRadius:8,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,padding:"4px 2px",opacity:isFuture?0.3:1}}>
                {acts.length===0
                  ?<div style={{width:5,height:5,borderRadius:"50%",background:"#e4e4e7"}}/>
                  :acts.slice(0,3).map((a,ai)=>(
                    <div key={ai} style={{fontSize:10,lineHeight:1}}>{a.icon}</div>
                  ))
                }
              </div>
              {/* Activity type tags */}
              {hasAny&&<div style={{display:"flex",flexDirection:"column",gap:1,width:"100%",alignItems:"center"}}>
                {acts.slice(0,2).map((a,ai)=>(
                  <div key={ai} style={{width:24,height:3,borderRadius:99,background:a.color}}/>
                ))}
              </div>}
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div style={{display:"flex",gap:10,marginTop:10,flexWrap:"wrap"}}>
        {[{c:"#ca8a04",l:"Lift"},{c:"#f97316",l:"Ball"},{c:"#60a5fa",l:"Cardio"}].map(x=>(
          <div key={x.l} style={{display:"flex",alignItems:"center",gap:4}}>
            <div style={{width:8,height:8,borderRadius:2,background:x.c}}/>
            <span style={{fontSize:9,color:"#71717a",fontFamily:"'Barlow',sans-serif"}}>{x.l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({workouts,goals,cardioLog,bbLog,checkIns,bodyLog,prs,setTab}){
  const [dismissed,setDismissed]=useState([]);
  const ci=checkIns.find(c=>c.date===today());
  const thisWeekW=workouts.filter(w=>isThisWeek(w.date)).length;
  const thisWeekB=bbLog.filter(b=>isThisWeek(b.date)).length;
  const latest=bodyLog.length?[...bodyLog].sort((a,b)=>b.date.localeCompare(a.date))[0]:null;
  const milestones=checkMilestones(workouts,prs,bbLog,goals).filter(m=>!dismissed.includes(m.title));
  const {current:streak,longest}=calcStreaks(workouts,bbLog,cardioLog);

  const WEEKLY_TARGETS=[
    {label:"Strength",target:2,done:workouts.filter(w=>isThisWeek(w.date)&&w.exercises?.some(e=>["strength","power"].includes(e.category))).length,color:"#ca8a04"},
    {label:"Power",target:1,done:workouts.filter(w=>isThisWeek(w.date)&&w.exercises?.some(e=>e.category==="power")).length,color:"#dc2626"},
    {label:"Mobility",target:2,done:workouts.filter(w=>isThisWeek(w.date)&&w.exercises?.some(e=>["mobility","corrective"].includes(e.category))).length,color:"#0ea5e9"},
    {label:"Ball",target:2,done:thisWeekB,color:"#f97316"},
    {label:"Zone 2",target:1,done:(cardioLog||[]).filter(c=>isThisWeek(c.date)).length,color:"#60a5fa"},
  ];

  return(
    <div>
      {/* Hero */}
      <div style={{background:"linear-gradient(135deg,#18181b,#3f3f46)",border:"1px solid #1e1e1e",borderRadius:14,padding:"18px 18px 14px",marginBottom:12}}>
        <div style={{fontSize:12,color:"#71717a",fontFamily:"'Barlow',sans-serif",marginBottom:4}}>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</div>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:32,letterSpacing:1,marginBottom:10}}><span style={{color:"#ca8a04"}}>APEX</span>TRACK</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
          {[{v:thisWeekW,l:"Lifts",c:"#ca8a04"},{v:thisWeekB,l:"Ball",c:"#f97316"},{v:streak,l:"Streak 🔥",c:streak>=7?"#dc2626":streak>=3?"#f97316":"#0ea5e9"},{v:ci?.energy||"—",l:"Energy",c:"#7c3aed"}].map(s=>(
            <div key={s.l} style={{textAlign:"center"}}>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,color:s.c,lineHeight:1}}>{s.v}</div>
              <div style={{fontSize:9,color:"#71717a",fontFamily:"'Barlow',sans-serif",textTransform:"uppercase",letterSpacing:.5}}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {!ci&&(
        <div onClick={()=>setTab("CHECKIN")} style={{background:"#ca8a040d",border:"1px solid #E8FF0033",borderRadius:10,padding:"10px 14px",marginBottom:12,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontFamily:"'Barlow',sans-serif",fontSize:13,color:"#ca8a04"}}>📋 Log today's check-in</span>
          <span style={{color:"#ca8a04"}}>→</span>
        </div>
      )}

      {/* Milestones */}
      {milestones.map(m=>(
        <div key={m.title} style={{background:"linear-gradient(135deg,#fef9c3,#ffedd5)",border:"1px solid #fde047",borderRadius:12,padding:"12px 16px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <span style={{fontSize:22}}>{m.icon}</span>
            <div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:17,color:"#ca8a04"}}>{m.title}</div>
              <div style={{fontFamily:"'Barlow',sans-serif",fontSize:12,color:"#52525b"}}>{m.body}</div>
            </div>
          </div>
          <button onClick={()=>setDismissed(d=>[...d,m.title])} style={{background:"none",border:"none",color:"#71717a",cursor:"pointer",fontSize:16}}>×</button>
        </div>
      ))}

      {/* ── WEEKLY STRIP ── */}
      <WeekStrip workouts={workouts} bbLog={bbLog} cardioLog={cardioLog} setTab={setTab}/>

      {/* Streak stats */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
        {[{l:"Current Streak",v:`${streak} day${streak!==1?"s":""}`,c:streak>=7?"#dc2626":streak>=3?"#f97316":"#ca8a04",icon:"🔥"},{l:"Longest Streak",v:`${longest} day${longest!==1?"s":""}`,c:"#7c3aed",icon:"🏆"}].map(s=>(
          <div key={s.l} style={{background:"#fff",border:"1px solid #1e1e1e",borderRadius:12,padding:"12px 14px"}}>
            <div style={{fontSize:18,marginBottom:4}}>{s.icon}</div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:s.c}}>{s.v}</div>
            <div style={{fontSize:10,color:"#71717a",fontFamily:"'Barlow',sans-serif",textTransform:"uppercase",letterSpacing:1}}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Weekly targets */}
      <div style={S.card}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,marginBottom:12}}>WEEKLY TARGETS</div>
        {WEEKLY_TARGETS.map(t=>{const pct=Math.min(100,(t.done/t.target)*100);return(
          <div key={t.label} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <span style={{fontFamily:"'Barlow',sans-serif",fontSize:12,color:"#52525b"}}>{t.label}</span>
              <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,color:pct>=100?t.color:"#71717a"}}>{t.done}/{t.target}</span>
            </div>
            <div style={{height:4,background:"#e4e4e7",borderRadius:99}}>
              <div style={{width:`${pct}%`,height:"100%",background:t.color,borderRadius:99,transition:"width .5s"}}/>
            </div>
          </div>
        );})}
      </div>

      {/* Body stats */}
      {latest&&(
        <div style={S.card}>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,marginBottom:10}}>BODY — {fmtDate(latest.date)}</div>
          <div style={{display:"flex",gap:16}}>
            {latest.weight&&<div><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,color:"#dc2626"}}>{latest.weight}</div><div style={{fontSize:10,color:"#71717a",fontFamily:"'Barlow',sans-serif"}}>lbs</div></div>}
            {latest.vertical&&<div><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,color:"#0ea5e9"}}>{latest.vertical}"</div><div style={{fontSize:10,color:"#71717a",fontFamily:"'Barlow',sans-serif"}}>vertical</div></div>}
            {latest.waist&&<div><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,color:"#f97316"}}>{latest.waist}"</div><div style={{fontSize:10,color:"#71717a",fontFamily:"'Barlow',sans-serif"}}>waist</div></div>}
          </div>
        </div>
      )}

      {/* Recent workouts */}
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,marginBottom:10}}>RECENT</div>
      {workouts.length===0&&<div style={{color:"#d4d4d8",fontFamily:"'Barlow',sans-serif",fontSize:12,textAlign:"center",padding:"16px 0"}}>No sessions yet — tap Log to start.</div>}
      {[...workouts].reverse().slice(0,4).map(w=>(
        <div key={w.id} style={{...S.card,padding:"10px 14px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15}}>{w.name}</div>
              <div style={{fontSize:11,color:"#71717a",fontFamily:"'Barlow',sans-serif"}}>{fmtDate(w.date)} · {w.exercises?.length||0} exercises</div>
            </div>
            {w.duration&&<span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,color:"#ca8a04"}}>{fmtSecs(w.duration)}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── MONTHLY LOG ──────────────────────────────────────────────────────────────
function MonthlyLog({workouts,bbLog,cardioLog,checkIns}){
  const now=new Date();
  const [year,setYear]=useState(now.getFullYear());
  const [month,setMonth]=useState(now.getMonth()); // 0-indexed
  const [selectedDay,setSelectedDay]=useState(null);

  const {current:streak,longest,total}=calcStreaks(workouts,bbLog,cardioLog);

  // Build calendar grid
  const firstDay=new Date(year,month,1).getDay(); // 0=Sun
  const daysInMonth=new Date(year,month+1,0).getDate();
  const monthName=new Date(year,month,1).toLocaleDateString("en-US",{month:"long",year:"numeric"});

  function isoDate(d){
    return `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  }

  function prevMonth(){if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1);setSelectedDay(null);}
  function nextMonth(){if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1);setSelectedDay(null);}

  // Aggregate all activity across the whole month for stats
  const monthDates=Array.from({length:daysInMonth},(_,i)=>isoDate(i+1));
  const activeDays=monthDates.filter(d=>getActivityForDate(d,workouts,bbLog,cardioLog).length>0);
  const monthWorkouts=workouts.filter(w=>w.date>=isoDate(1)&&w.date<=isoDate(daysInMonth));
  const monthBall=bbLog.filter(b=>b.date>=isoDate(1)&&b.date<=isoDate(daysInMonth));
  const monthCardio=(cardioLog||[]).filter(c=>c.date>=isoDate(1)&&c.date<=isoDate(daysInMonth));

  const selectedDate=selectedDay?isoDate(selectedDay):null;
  const selectedActs=selectedDate?getActivityForDate(selectedDate,workouts,bbLog,cardioLog):[];
  const selectedCI=selectedDate?checkIns.find(c=>c.date===selectedDate):null;

  // Day cell color
  function dayColor(d){
    const date=isoDate(d);
    const acts=getActivityForDate(date,workouts,bbLog,cardioLog);
    if(!acts.length)return null;
    const types=acts.map(a=>a.type);
    if(types.includes("workout")&&types.includes("ball"))return"#f97316";
    if(types.includes("workout"))return"#ca8a04";
    if(types.includes("ball"))return"#f97316";
    if(types.includes("cardio"))return"#60a5fa";
    return"#16a34a";
  }

  const todayStr=today();

  return(
    <div>
      <STitle sub="Tap any day to see what you did">MONTHLY LOG</STitle>

      {/* Streak banner */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
        {[{l:"Current Streak",v:`${streak}d`,c:streak>=7?"#dc2626":streak>=3?"#f97316":"#ca8a04",icon:"🔥"},{l:"Longest",v:`${longest}d`,c:"#7c3aed",icon:"🏆"},{l:"Active Days",v:total,c:"#16a34a",icon:"📅"}].map(s=>(
          <div key={s.l} style={{background:"#fff",border:"1px solid #1e1e1e",borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
            <div style={{fontSize:16}}>{s.icon}</div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:s.c,lineHeight:1.1}}>{s.v}</div>
            <div style={{fontSize:9,color:"#71717a",fontFamily:"'Barlow',sans-serif",textTransform:"uppercase",letterSpacing:.5,marginTop:2}}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Month navigation */}
      <div style={{...S.card,padding:"14px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <button onClick={prevMonth} style={{background:"#f9f9f9",border:"1px solid #1e1e1e",borderRadius:8,color:"#18181b",cursor:"pointer",padding:"6px 14px",fontFamily:"'Bebas Neue',sans-serif",fontSize:16}}>‹</button>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:1}}>{monthName}</div>
          <button onClick={nextMonth} style={{background:"#f9f9f9",border:"1px solid #1e1e1e",borderRadius:8,color:"#18181b",cursor:"pointer",padding:"6px 14px",fontFamily:"'Bebas Neue',sans-serif",fontSize:16}}>›</button>
        </div>

        {/* Day-of-week headers */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:4}}>
          {["S","M","T","W","T","F","S"].map((d,i)=>(
            <div key={i} style={{textAlign:"center",fontSize:9,fontFamily:"'Barlow',sans-serif",fontWeight:700,color:"#3f3f46",padding:"2px 0"}}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
          {/* Empty cells before month start */}
          {Array.from({length:firstDay}).map((_,i)=><div key={`e${i}`}/>)}
          {/* Day cells */}
          {Array.from({length:daysInMonth},(_,i)=>i+1).map(d=>{
            const date=isoDate(d);
            const color=dayColor(d);
            const isToday=date===todayStr;
            const isSel=selectedDay===d;
            const isFuture=date>todayStr;
            const acts=getActivityForDate(date,workouts,bbLog,cardioLog);
            return(
              <div key={d} onClick={()=>setSelectedDay(isSel?null:d)}
                style={{
                  aspectRatio:"1",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                  borderRadius:8,cursor:isFuture?"default":"pointer",position:"relative",
                  background:isSel?"#ca8a0422":color?color+"18":"#fff",
                  border:`1px solid ${isSel?"#ca8a04":isToday?"#ca8a0466":color?color+"44":"#f0f0f0"}`,
                  opacity:isFuture?0.25:1,
                }}>
                <span style={{fontFamily:"'Barlow',sans-serif",fontSize:11,fontWeight:isToday?700:400,color:isToday?"#ca8a04":color||"#71717a"}}>{d}</span>
                {color&&<div style={{width:14,height:3,borderRadius:99,background:color,marginTop:2}}/>}
                {acts.length>1&&<div style={{position:"absolute",top:3,right:3,width:5,height:5,borderRadius:"50%",background:"#fff",opacity:.4}}/>}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{display:"flex",gap:10,marginTop:12,flexWrap:"wrap"}}>
          {[{c:"#ca8a04",l:"Lift"},{c:"#f97316",l:"Lift+Ball"},{c:"#f97316",l:"Ball",opacity:.5},{c:"#60a5fa",l:"Cardio"}].map((x,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:4}}>
              <div style={{width:10,height:10,borderRadius:3,background:x.c,opacity:x.opacity||1}}/>
              <span style={{fontSize:9,color:"#71717a",fontFamily:"'Barlow',sans-serif"}}>{x.l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Selected day detail */}
      {selectedDay&&(
        <div style={{...S.card,background:"#fafafa",border:"1px solid #E8FF0033"}}>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:"#ca8a04",marginBottom:10}}>
            {new Date(isoDate(selectedDay)+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}
          </div>
          {selectedActs.length===0
            ?<div style={{fontFamily:"'Barlow',sans-serif",fontSize:13,color:"#d4d4d8",padding:"8px 0"}}>Rest day — no activity logged.</div>
            :selectedActs.map((act,i)=>(
              <div key={i} style={{background:"#fff",borderRadius:10,padding:"10px 12px",marginBottom:8,borderLeft:`3px solid ${act.color}`}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <span style={{fontSize:16}}>{act.icon}</span>
                  <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,color:act.color,textTransform:"capitalize"}}>{act.label}</span>
                </div>
                {act.type==="workout"&&(()=>{
                  const w=workouts.find(x=>x.date===selectedDate&&x.name===act.label);
                  if(!w)return null;
                  return(<div>
                    {w.duration&&<div style={{fontSize:11,color:"#71717a",fontFamily:"'Barlow',sans-serif",marginBottom:4}}>⏱ {fmtSecs(w.duration)}</div>}
                    <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                      {(w.exercises||[]).map((ex,ei)=>{
                        const bc=ex.block?BLOCK_COLORS[ex.block]:"#71717a";
                        const bestSet=ex.setData?.reduce((b,s)=>parseFloat(s.weight||0)>b?parseFloat(s.weight):b,0)||null;
                        return(
                          <div key={ei} style={{background:"#f9f9f9",borderRadius:6,padding:"4px 8px",borderLeft:`2px solid ${bc}`}}>
                            <div style={{fontFamily:"'Barlow',sans-serif",fontSize:11,color:"#52525b"}}>{ex.exercise}</div>
                            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:12,color:bc}}>{ex.sets}× {bestSet?`${bestSet}lb`:""}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>);
                })()}
                {act.type==="ball"&&(()=>{
                  const b=bbLog.find(x=>x.date===selectedDate);
                  if(!b)return null;
                  return(<div style={{fontSize:11,color:"#6b7280",fontFamily:"'Barlow',sans-serif"}}>
                    {b.duration&&`${b.duration} min`}
                    {b.result&&<span style={{color:b.result==="W"?"#16a34a":"#dc2626",fontWeight:700,marginLeft:8}}>{b.result}</span>}
                    {b.shoe&&<span style={{color:"#0ea5e9",marginLeft:8}}>👟 {b.shoe}</span>}
                  </div>);
                })()}
              </div>
            ))
          }
          {selectedCI&&(
            <div style={{background:"#fff",borderRadius:8,padding:"8px 12px",borderLeft:"3px solid #B388FF"}}>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:13,color:"#7c3aed",marginBottom:4}}>CHECK-IN</div>
              <div style={{display:"flex",gap:12,fontFamily:"'Barlow',sans-serif",fontSize:11,color:"#6b7280",flexWrap:"wrap"}}>
                {selectedCI.sleep&&<span>😴 {selectedCI.sleep}h</span>}
                {selectedCI.energy&&<span>⚡ Energy {selectedCI.energy}/5</span>}
                {selectedCI.soreness&&<span>💪 Soreness {selectedCI.soreness}/5</span>}
                {selectedCI.kneeLeft&&selectedCI.kneeLeft!=="none"&&<span style={{color:"#f97316"}}>🦵 LKnee: {selectedCI.kneeLeft}</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Month summary stats */}
      <div style={S.card}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,marginBottom:12}}>
          {new Date(year,month,1).toLocaleDateString("en-US",{month:"long"})} SUMMARY
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:12}}>
          {[
            {l:"Active",v:activeDays.length,u:"days",c:"#16a34a"},
            {l:"Workouts",v:monthWorkouts.length,u:"sessions",c:"#ca8a04"},
            {l:"Ball",v:monthBall.length,u:"sessions",c:"#f97316"},
            {l:"Cardio",v:monthCardio.length,u:"sessions",c:"#60a5fa"},
          ].map(s=>(
            <div key={s.l} style={{background:"#f9f9f9",borderRadius:10,padding:"10px 8px",textAlign:"center"}}>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:s.c,lineHeight:1}}>{s.v}</div>
              <div style={{fontSize:8,color:"#71717a",fontFamily:"'Barlow',sans-serif",textTransform:"uppercase",marginTop:2}}>{s.l}</div>
            </div>
          ))}
        </div>
        {/* Mini activity bar across month */}
        <div style={{display:"flex",gap:2,height:28,alignItems:"flex-end"}}>
          {monthDates.map(d=>{
            const acts=getActivityForDate(d,workouts,bbLog,cardioLog);
            const h=acts.length===0?4:acts.length===1?14:acts.length===2?20:28;
            const col=acts.length===0?"#e4e4e7":acts.some(a=>a.type==="workout")&&acts.some(a=>a.type==="ball")?"#f97316":acts.some(a=>a.type==="workout")?"#ca8a04":acts.some(a=>a.type==="ball")?"#f97316":"#60a5fa";
            const isT=d===todayStr;
            return<div key={d} style={{flex:1,height:h,borderRadius:3,background:isT?col+"ff":col,opacity:isT?1:0.7,transition:"height .3s"}}/>;
          })}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
          <span style={{fontSize:9,color:"#3f3f46",fontFamily:"'Barlow',sans-serif"}}>1</span>
          <span style={{fontSize:9,color:"#3f3f46",fontFamily:"'Barlow',sans-serif"}}>{daysInMonth}</span>
        </div>
      </div>
    </div>
  );
}

// ─── BODY TAB ─────────────────────────────────────────────────────────────────
function BodyTab({bodyLog,onSave,goals,onUpdateGoal}){
  const [weight,setWeight]=useState("");const [waist,setWaist]=useState("");const [vertical,setVertical]=useState("");const [notes,setNotes]=useState("");const [saved,setSaved]=useState(false);const [view,setView]=useState("weight");
  function handleSave(){if(!weight&&!waist&&!vertical)return;const e={id:Date.now(),date:today(),weight:weight?parseFloat(weight):null,waist:waist?parseFloat(waist):null,vertical:vertical?parseFloat(vertical):null,notes};onSave(e);if(weight){const g=goals.find(g=>g.name==="Body Weight");if(g)onUpdateGoal(g.id,parseFloat(weight));}if(vertical){const g=goals.find(g=>g.name==="Vertical Jump");if(g)onUpdateGoal(g.id,parseFloat(vertical));}setSaved(true);setTimeout(()=>{setSaved(false);setWeight("");setWaist("");setVertical("");setNotes("");},1800);}
  const wl=bodyLog.filter(e=>e.weight).sort((a,b)=>a.date.localeCompare(b.date));const vl=bodyLog.filter(e=>e.vertical).sort((a,b)=>a.date.localeCompare(b.date));
  const latest=bodyLog.length?[...bodyLog].sort((a,b)=>b.date.localeCompare(a.date))[0]:null;
  function MiniChart({data,vk,color,unit}){
    if(data.length<2)return<div style={{color:"#d4d4d8",fontFamily:"'Barlow',sans-serif",fontSize:12,padding:"16px 0",textAlign:"center"}}>Log 2+ entries to see trend</div>;
    const vals=data.map(d=>d[vk]);const mn=Math.min(...vals);const mx=Math.max(...vals);const range=mx-mn||1;const W=280;const H=70;
    const pts=data.map((d,i)=>({x:(i/(data.length-1))*W,y:H-((d[vk]-mn)/range)*(H-12)-6}));
    const path=pts.map((p,i)=>`${i===0?"M":"L"}${p.x},${p.y}`).join(" ");
    return(<div><svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{overflow:"visible"}}><path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>{pts.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="4" fill={color}/>)}</svg><div style={{display:"flex",justifyContent:"space-between",fontFamily:"'Barlow',sans-serif",fontSize:10,color:"#71717a",marginTop:4}}><span>{fmtDate(data[0].date)}</span><span style={{color}}>{vals[vals.length-1]} {unit}</span><span>{fmtDate(data[data.length-1].date)}</span></div></div>);
  }
  return(<div><STitle sub="Weight · Waist · Vertical Jump">BODY TRACKER</STitle>
    {latest&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>{[{l:"Weight",v:latest.weight,u:"lbs",c:"#dc2626"},{l:"Waist",v:latest.waist,u:"in",c:"#f97316"},{l:"Vertical",v:latest.vertical,u:"in",c:"#0ea5e9"}].map(s=><div key={s.l} style={{background:"#f9f9f9",border:"1px solid #1e1e1e",borderRadius:10,padding:12,textAlign:"center"}}><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,color:s.v?s.c:"#d4d4d8",lineHeight:1}}>{s.v||"—"}</div><div style={{fontSize:10,color:"#71717a",fontFamily:"'Barlow',sans-serif"}}>{s.u}</div></div>)}</div>}
    <div style={{...S.card,background:"#f9f9f9"}}><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,color:"#ca8a04",marginBottom:10}}>LOG MEASUREMENTS</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
        <div><span style={S.label}>Weight</span><input type="number" placeholder="185" value={weight} onChange={e=>setWeight(e.target.value)} style={S.input}/></div>
        <div><span style={S.label}>Waist (in)</span><input type="number" placeholder="32" value={waist} onChange={e=>setWaist(e.target.value)} style={S.input}/></div>
        <div><span style={S.label}>Vertical (in)</span><input type="number" placeholder="28" value={vertical} onChange={e=>setVertical(e.target.value)} style={S.input}/></div>
      </div>
      <input placeholder="Notes" value={notes} onChange={e=>setNotes(e.target.value)} style={{...S.input,marginBottom:10}}/>
      <button onClick={handleSave} style={{...S.btn(saved?"#16a34a":"#ca8a04",saved?"#fff":"#000"),width:"100%"}}>{saved?"✓ SAVED":"LOG"}</button>
    </div>
    {(wl.length>0||vl.length>0)&&<div>
      <div style={{display:"flex",gap:8,marginBottom:10}}>{[{id:"weight",l:"Weight",c:"#dc2626"},{id:"vertical",l:"Vertical",c:"#0ea5e9"},{id:"waist",l:"Waist",c:"#f97316"}].map(v=><button key={v.id} onClick={()=>setView(v.id)} style={{flex:1,padding:"6px",background:view===v.id?v.c+"22":"transparent",color:view===v.id?v.c:"#71717a",border:`1px solid ${view===v.id?v.c:"#e4e4e7"}`,borderRadius:8,cursor:"pointer",fontFamily:"'Barlow',sans-serif",fontWeight:700,fontSize:11}}>{v.l}</button>)}</div>
      <div style={S.card}>{view==="weight"&&<MiniChart data={wl} vk="weight" color="#dc2626" unit="lbs"/>}{view==="vertical"&&<MiniChart data={vl} vk="vertical" color="#0ea5e9" unit="in"/>}{view==="waist"&&<MiniChart data={bodyLog.filter(e=>e.waist).sort((a,b)=>a.date.localeCompare(b.date))} vk="waist" color="#f97316" unit="in"/>}</div>
      {[...bodyLog].reverse().slice(0,6).map(e=><div key={e.id} style={{...S.card,padding:"9px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{fontFamily:"'Barlow',sans-serif",fontSize:11,color:"#71717a"}}>{fmtDate(e.date)}</div><div style={{display:"flex",gap:12}}>{e.weight&&<span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:17,color:"#dc2626"}}>{e.weight}<span style={{fontSize:9,color:"#71717a"}}>lbs</span></span>}{e.vertical&&<span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:17,color:"#0ea5e9"}}>{e.vertical}<span style={{fontSize:9,color:"#71717a"}}>″</span></span>}{e.waist&&<span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:17,color:"#f97316"}}>{e.waist}<span style={{fontSize:9,color:"#71717a"}}>″</span></span>}</div></div>)}
    </div>}
  </div>);
}

// ─── PR TAB ───────────────────────────────────────────────────────────────────
function PRTab({prs,onSave,onDelete}){
  const [exercise,setExercise]=useState("");const [weight,setWeight]=useState("");const [reps,setReps]=useState("1");const [notes,setNotes]=useState("");const [saved,setSaved]=useState(false);const [selected,setSelected]=useState(null);const [search,setSearch]=useState("");
  const COMMON=["Back Squat","Deadlift","Bench Press","Overhead Press","Power Clean","Romanian Deadlift","Pull Up","Front Squat","Hip Thrust","Incline Press","Bent Over Row"];
  function handleSave(){if(!exercise||!weight)return;onSave({id:Date.now(),date:today(),exercise,weight:parseFloat(weight),reps:parseInt(reps)||1,notes});setSaved(true);setTimeout(()=>{setSaved(false);setWeight("");setNotes("");},1800);}
  const grouped={};prs.forEach(pr=>{if(!grouped[pr.exercise])grouped[pr.exercise]=[];grouped[pr.exercise].push(pr);});Object.values(grouped).forEach(arr=>arr.sort((a,b)=>b.date.localeCompare(a.date)));
  const exList=Object.keys(grouped).filter(e=>!search||e.toLowerCase().includes(search.toLowerCase()));
  return(<div><STitle sub="Personal records per exercise">PR TRACKER</STitle>
    <div style={{...S.card,background:"#f9f9f9"}}>
      <input placeholder="Exercise name" value={exercise} onChange={e=>setExercise(e.target.value)} style={{...S.input,marginBottom:8}}/>
      <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>{COMMON.filter(l=>!exercise||l.toLowerCase().includes(exercise.toLowerCase())).slice(0,6).map(l=><button key={l} onClick={()=>setExercise(l)} style={{background:exercise===l?"#ca8a0422":"transparent",color:exercise===l?"#ca8a04":"#71717a",border:`1px solid ${exercise===l?"#ca8a04":"#e4e4e7"}`,borderRadius:6,padding:"4px 9px",cursor:"pointer",fontFamily:"'Barlow',sans-serif",fontSize:11,fontWeight:600}}>{l}</button>)}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}><div><span style={S.label}>Weight (lbs)</span><input type="number" placeholder="225" value={weight} onChange={e=>setWeight(e.target.value)} style={S.input}/></div><div><span style={S.label}>Reps</span><input type="number" placeholder="1" value={reps} onChange={e=>setReps(e.target.value)} style={S.input}/></div></div>
      <input placeholder="Notes" value={notes} onChange={e=>setNotes(e.target.value)} style={{...S.input,marginBottom:10}}/>
      <button onClick={handleSave} style={{...S.btn(saved?"#16a34a":"#ca8a04",saved?"#fff":"#000"),width:"100%"}}>{saved?"✓ LOGGED":"LOG LIFT"}</button>
    </div>
    {exList.length>0&&<div><input placeholder="Search lifts..." value={search} onChange={e=>setSearch(e.target.value)} style={{...S.input,marginBottom:10}}/>
      {exList.map(ex=>{const hist=grouped[ex];const best=Math.max(...hist.map(p=>p.weight));const recent=hist.slice(0,6).reverse();
        return(<div key={ex} style={{...S.card,borderLeft:"3px solid #E8FF00"}}>
          <div onClick={()=>setSelected(selected===ex?null:ex)} style={{cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:17}}>{ex}</div><div style={{fontSize:11,color:"#71717a",fontFamily:"'Barlow',sans-serif"}}>{hist.length} sessions</div></div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}><span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:"#ca8a04"}}>{best}<span style={{fontSize:11,color:"#71717a"}}>lbs</span></span><span style={{color:"#d4d4d8"}}>{selected===ex?"▲":"▼"}</span></div>
          </div>
          {selected===ex&&<div style={{marginTop:12,borderTop:"1px solid #1e1e1e",paddingTop:12}}>
            {recent.length>=2&&<svg width="100%" viewBox="0 0 280 55" style={{overflow:"visible",marginBottom:8}}>{(()=>{const vals=recent.map(r=>r.weight);const mn=Math.min(...vals);const mx=Math.max(...vals);const range=mx-mn||1;const pts=recent.map((d,i)=>({x:(i/(recent.length-1))*280,y:55-((d.weight-mn)/range)*(55-10)-5}));const path=pts.map((p,i)=>`${i===0?"M":"L"}${p.x},${p.y}`).join(" ");return(<><path d={path} fill="none" stroke="#ca8a04" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>{pts.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="4" fill={i===pts.length-1?"#ca8a04":"#e4e4e7"} stroke="#ca8a04" strokeWidth="1.5"/>)}</>);})()}</svg>}
            {hist.slice(0,5).map(p=><div key={p.id} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #1e1e1e"}}><span style={{fontFamily:"'Barlow',sans-serif",fontSize:11,color:"#71717a"}}>{fmtDate(p.date)}</span><span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,color:p.weight===best?"#ca8a04":"#18181b"}}>{p.weight}lbs{p.reps>1?` ×${p.reps}`:""}</span></div>)}
          </div>}
        </div>);})}
    </div>}
  </div>);
}

// ─── CHECK-IN ─────────────────────────────────────────────────────────────────
function CheckInTab({checkIns,onSave}){
  const te=checkIns.find(c=>c.date===today());
  const [sleep,setSleep]=useState(te?.sleep||"");const [energy,setEnergy]=useState(te?.energy||"");const [soreness,setSoreness]=useState(te?.soreness||"");const [mood,setMood]=useState(te?.mood||"");const [kl,setKl]=useState(te?.kneeLeft||"none");const [kr,setKr]=useState(te?.kneeRight||"none");const [back,setBack]=useState(te?.back||"none");const [notes,setNotes]=useState(te?.notes||"");const [saved,setSaved]=useState(false);
  function handleSave(){onSave({date:today(),sleep,energy,soreness,mood,kneeLeft:kl,kneeRight:kr,back,notes});setSaved(true);setTimeout(()=>setSaved(false),1800);}
  const Scale=({label,val,setVal,color})=><div style={{marginBottom:12}}><span style={S.label}>{label}</span><div style={{display:"flex",gap:6}}>{[1,2,3,4,5].map(n=><button key={n} onClick={()=>setVal(n)} style={{flex:1,padding:"8px 4px",background:val>=n?(color||"#ca8a04")+"33":"transparent",border:`1px solid ${val>=n?(color||"#ca8a04"):"#e4e4e7"}`,borderRadius:8,cursor:"pointer",fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:val>=n?(color||"#ca8a04"):"#d4d4d8"}}>{n}</button>)}</div></div>;
  const BP=({label,val,setVal})=>{const opts=[{v:"none",l:"✅",c:"#16a34a"},{v:"mild",l:"😐",c:"#ca8a04"},{v:"moderate",l:"⚠️",c:"#f97316"},{v:"bad",l:"🚨",c:"#dc2626"}];return(<div style={{marginBottom:12}}><span style={S.label}>{label}</span><div style={{display:"flex",gap:6}}>{opts.map(o=><button key={o.v} onClick={()=>setVal(o.v)} style={{flex:1,padding:"8px 4px",background:val===o.v?o.c+"33":"transparent",border:`1px solid ${val===o.v?o.c:"#e4e4e7"}`,borderRadius:8,cursor:"pointer",fontSize:18}}>{o.l}</button>)}</div></div>);};
  return(<div><STitle sub="Log daily for better coach recommendations">DAILY CHECK-IN</STitle>
    {te&&<div style={{background:"#16a34a18",border:"1px solid #22c55e33",borderRadius:10,padding:"9px 14px",marginBottom:12,fontFamily:"'Barlow',sans-serif",fontSize:13,color:"#16a34a"}}>✓ Today logged</div>}
    <div style={{...S.card,background:"#f9f9f9"}}>
      <div style={{marginBottom:12}}><span style={S.label}>Sleep (hours)</span><input type="number" placeholder="7.5" value={sleep} onChange={e=>setSleep(e.target.value)} style={{...S.input,width:100}}/></div>
      <Scale label="Energy" val={energy} setVal={setEnergy} color="#0ea5e9"/>
      <Scale label="Soreness" val={soreness} setVal={setSoreness} color="#f97316"/>
      <Scale label="Mood" val={mood} setVal={setMood} color="#ca8a04"/>
      <div style={{height:1,background:"#e4e4e7",margin:"12px 0"}}/>
      <BP label="Left Knee" val={kl} setVal={setKl}/><BP label="Right Knee" val={kr} setVal={setKr}/><BP label="Lower Back" val={back} setVal={setBack}/>
      <input placeholder="Notes" value={notes} onChange={e=>setNotes(e.target.value)} style={{...S.input,marginBottom:10}}/>
      <button onClick={handleSave} style={{...S.btn(saved?"#16a34a":"#ca8a04",saved?"#fff":"#000"),width:"100%"}}>{saved?"✓ LOGGED":"SAVE CHECK-IN"}</button>
    </div>
    {checkIns.length>0&&<div style={S.card}><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,marginBottom:10}}>RECENT</div>
      {[...checkIns].reverse().slice(0,5).map(c=><div key={c.date} style={{display:"grid",gridTemplateColumns:"70px 1fr 1fr 1fr",gap:5,padding:"5px 0",borderBottom:"1px solid #1e1e1e"}}>
        <div style={{fontFamily:"'Barlow',sans-serif",fontSize:11,color:"#71717a"}}>{fmtDate(c.date)}</div>
        <div style={{fontFamily:"'Barlow',sans-serif",fontSize:12,color:c.sleep<6?"#dc2626":c.sleep<7?"#f97316":"#16a34a"}}>{c.sleep}h</div>
        <div style={{display:"flex",gap:2,alignItems:"center"}}>{[1,2,3,4,5].map(n=><div key={n} style={{width:7,height:7,borderRadius:"50%",background:c.energy>=n?"#0ea5e9":"#e4e4e7"}}/>)}</div>
        <div style={{display:"flex",gap:2,alignItems:"center"}}>{[1,2,3,4,5].map(n=><div key={n} style={{width:7,height:7,borderRadius:"50%",background:c.soreness>=n?"#f97316":"#e4e4e7"}}/>)}</div>
      </div>)}
    </div>}
  </div>);
}

// ─── BALL TAB ─────────────────────────────────────────────────────────────────
function BallTab({bbLog,onSave}){
  const ST=[{key:"pickup_5v5",label:"Pickup Full Court",icon:"🏀"},{key:"game_5v5",label:"Organized Game",icon:"🏆"},{key:"shooting",label:"Shooting Around",icon:"🎯"},{key:"drills",label:"Skill Work",icon:"⚡"}];
  const DR={"Shooting":["Mikan Drill","Form Shooting","Catch & Shoot","Pull Up Mid","3-Point Spots","Off Dribble 3s","Fadeaway","Free Throws","Corner 3s","Step Back"],"Handles":["2-Ball Dribble","Pound Dribble","Crossover","Between Legs","Behind Back","Hesitation","Speed Cones","Figure 8"],"Finishing":["Mikan Both Hands","Reverse Layup","Euro Step","Up & Under","Left Hand","Floater","Running Hook","Drop Step"],"Conditioning":["Suicides","17s","Layup Sprints","Closeout Drill"]};
  const [st,setSt]=useState("pickup_5v5");const [dur,setDur]=useState("");const [result,setResult]=useState("");const [shoe,setShoe]=useState("");const [shoeFeel,setShoeFeel]=useState("");const [drills,setDrills]=useState([]);const [dc,setDc]=useState("Shooting");const [bf,setBf]=useState("");const [kl,setKl]=useState("none");const [notes,setNotes]=useState("");const [saved,setSaved]=useState(false);
  const allShoes=[...new Set(bbLog.filter(e=>e.shoe).map(e=>e.shoe))];
  const isGame=["pickup_5v5","game_5v5"].includes(st);const isDrills=["drills","shooting"].includes(st);
  function toggle(d){setDrills(p=>p.includes(d)?p.filter(x=>x!==d):[...p,d]);}
  function handleSave(){onSave({id:Date.now(),date:today(),sessionType:st,duration:dur,result,shoe,shoeFeel,drills,body:{overall:bf,kneeLeft:kl},notes});setSaved(true);setTimeout(()=>{setSaved(false);setDur("");setResult("");setShoe("");setShoeFeel("");setDrills([]);setBf("");setKl("none");setNotes("");},1800);}
  const KO=[{v:"none",l:"✅",c:"#16a34a"},{v:"mild",l:"😐",c:"#ca8a04"},{v:"moderate",l:"⚠️",c:"#f97316"},{v:"bad",l:"🚨",c:"#dc2626"}];
  return(<div><STitle sub="Pickup · Games · Shooting · Drills">BASKETBALL</STitle>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>{ST.map(s=><button key={s.key} onClick={()=>setSt(s.key)} style={{background:st===s.key?"#f9731622":"transparent",color:st===s.key?"#f97316":"#71717a",border:`1px solid ${st===s.key?"#f97316":"#e4e4e7"}`,borderRadius:10,padding:"10px 12px",cursor:"pointer",fontFamily:"'Barlow',sans-serif",fontWeight:700,fontSize:13,textAlign:"left"}}>{s.icon} {s.label}</button>)}</div>
    <div style={{display:"grid",gridTemplateColumns:isGame?"1fr 1fr":"1fr",gap:10,marginBottom:10}}><div><span style={S.label}>Duration (min)</span><input placeholder="60" value={dur} onChange={e=>setDur(e.target.value)} style={S.input}/></div>{isGame&&<div><span style={S.label}>Result</span><input placeholder="W / L" value={result} onChange={e=>setResult(e.target.value)} style={S.input}/></div>}</div>
    {isDrills&&<div style={{marginBottom:12}}><div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>{Object.keys(DR).map(cat=><button key={cat} onClick={()=>setDc(cat)} style={{background:dc===cat?"#f97316":"#f9f9f9",color:dc===cat?"#000":"#71717a",border:`1px solid ${dc===cat?"#f97316":"#e4e4e7"}`,borderRadius:20,padding:"5px 10px",cursor:"pointer",fontFamily:"'Barlow',sans-serif",fontWeight:700,fontSize:11}}>{cat}</button>)}</div><div style={{display:"flex",flexWrap:"wrap",gap:5}}>{DR[dc].map(d=><button key={d} onClick={()=>toggle(d)} style={{background:drills.includes(d)?"#f9731633":"#f9f9f9",color:drills.includes(d)?"#f97316":"#71717a",border:`1px solid ${drills.includes(d)?"#f97316":"#e4e4e7"}`,borderRadius:8,padding:"5px 9px",cursor:"pointer",fontFamily:"'Barlow',sans-serif",fontSize:11}}>{d}</button>)}</div></div>}
    <div style={{...S.card,background:"#fafafa",padding:"12px 14px",marginBottom:10}}><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,color:"#0ea5e9",marginBottom:8}}>👟 SHOE</div>
      <input placeholder="Shoe name..." value={shoe} onChange={e=>setShoe(e.target.value)} style={{...S.input,marginBottom:6}}/>
      {allShoes.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:6}}>{allShoes.map(s=><button key={s} onClick={()=>setShoe(s)} style={{background:shoe===s?"#0ea5e922":"#f9f9f9",color:shoe===s?"#0ea5e9":"#71717a",border:`1px solid ${shoe===s?"#0ea5e9":"#e4e4e7"}`,borderRadius:8,padding:"4px 9px",cursor:"pointer",fontFamily:"'Barlow',sans-serif",fontSize:11}}>{s}</button>)}</div>}
      <div style={{display:"flex",flexWrap:"wrap",gap:5}}>{["🔥 Locked","👍 Solid","😐 Okay","👎 Slipping"].map(f=><button key={f} onClick={()=>setShoeFeel(f)} style={{background:shoeFeel===f?"#0ea5e922":"transparent",color:shoeFeel===f?"#0ea5e9":"#71717a",border:`1px solid ${shoeFeel===f?"#0ea5e9":"#e4e4e7"}`,borderRadius:8,padding:"5px 8px",cursor:"pointer",fontFamily:"'Barlow',sans-serif",fontSize:11}}>{f}</button>)}</div>
    </div>
    <div style={{...S.card,background:"#fafafa",padding:"12px 14px",marginBottom:10}}><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,color:"#7c3aed",marginBottom:8}}>🩺 BODY</div>
      <div style={{display:"flex",gap:8,marginBottom:8}}>{[{v:"great",l:"🔥"},{v:"good",l:"👍"},{v:"okay",l:"😐"},{v:"rough",l:"😓"}].map(f=><button key={f.v} onClick={()=>setBf(f.v)} style={{flex:1,padding:"8px",background:bf===f.v?"#7c3aed33":"transparent",border:`1px solid ${bf===f.v?"#7c3aed":"#e4e4e7"}`,borderRadius:8,cursor:"pointer",fontSize:18}}>{f.l}</button>)}</div>
      <span style={S.label}>Left Knee</span><div style={{display:"flex",gap:5}}>{KO.map(k=><button key={k.v} onClick={()=>setKl(k.v)} style={{flex:1,padding:"6px",background:kl===k.v?k.c+"33":"transparent",border:`1px solid ${kl===k.v?k.c:"#e4e4e7"}`,borderRadius:6,cursor:"pointer",fontSize:16}}>{k.l}</button>)}</div>
    </div>
    <input placeholder="Notes" value={notes} onChange={e=>setNotes(e.target.value)} style={{...S.input,marginBottom:10}}/>
    <button onClick={handleSave} style={{...S.btn(saved?"#16a34a":"#f97316",saved?"#fff":"#000"),width:"100%"}}>{saved?"✓ SAVED":"LOG SESSION"}</button>
    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,margin:"18px 0 10px"}}>HISTORY</div>
    {[...bbLog].reverse().slice(0,8).map(e=>{const s=ST.find(x=>x.key===e.sessionType)||{};const lkc=e.body?.kneeLeft==="none"?"#16a34a":e.body?.kneeLeft==="bad"?"#dc2626":"#f97316";return(<div key={e.id} style={{...S.card,borderLeft:"3px solid #f97316"}}>
      <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15}}>{s.icon} {s.label}</span><div style={{textAlign:"right"}}><div style={{fontSize:11,color:"#71717a",fontFamily:"'Barlow',sans-serif"}}>{fmtDate(e.date)}{e.duration?` · ${e.duration}min`:""}</div>{e.result&&<div style={{color:e.result==="W"?"#16a34a":"#dc2626",fontFamily:"'Barlow',sans-serif",fontWeight:700,fontSize:13}}>{e.result}</div>}</div></div>
      {e.drills?.length>0&&<div style={{marginTop:5,display:"flex",flexWrap:"wrap",gap:3}}>{e.drills.slice(0,5).map(d=><span key={d} style={{fontSize:9,padding:"2px 5px",borderRadius:4,background:"#f9731622",color:"#f97316",fontFamily:"'Barlow',sans-serif"}}>{d}</span>)}</div>}
      {e.shoe&&<div style={{marginTop:4,fontSize:12,fontFamily:"'Barlow',sans-serif",color:"#0ea5e9"}}>👟 {e.shoe}</div>}
      {e.body?.kneeLeft&&<span style={{fontSize:11,color:lkc,fontFamily:"'Barlow',sans-serif",marginTop:4,display:"block"}}>LKnee: {e.body.kneeLeft}</span>}
    </div>);})}
  </div>);
}

// ─── GOALS ────────────────────────────────────────────────────────────────────
function GoalsTab({goals,onUpdate,onAdd,onDelete}){
  const [showAdd,setShowAdd]=useState(false);const [editId,setEditId]=useState(null);const [editVal,setEditVal]=useState("");const [form,setForm]=useState({name:"",unit:"lbs",current:"",target:"",category:"strength"});
  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:16}}><STitle sub="Track your targets">GOALS</STitle><button onClick={()=>setShowAdd(s=>!s)} style={S.btn("#ca8a04","#000")}>+ NEW</button></div>
    {showAdd&&<div style={{...S.card,background:"#f9f9f9",marginBottom:12}}>
      <input placeholder="Goal name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={{...S.input,marginBottom:8}}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}><input placeholder="Current" type="number" value={form.current} onChange={e=>setForm(f=>({...f,current:e.target.value}))} style={S.input}/><input placeholder="Target" type="number" value={form.target} onChange={e=>setForm(f=>({...f,target:e.target.value}))} style={S.input}/><input placeholder="Unit" value={form.unit} onChange={e=>setForm(f=>({...f,unit:e.target.value}))} style={S.input}/></div>
      <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={{...S.input,marginBottom:10}}><option value="strength">Strength</option><option value="power">Power</option><option value="athletic">Athletic</option><option value="weight">Weight</option><option value="mobility">Mobility</option></select>
      <button onClick={()=>{if(!form.name||!form.current||!form.target)return;onAdd({...form,id:Date.now(),current:parseFloat(form.current),target:parseFloat(form.target)});setForm({name:"",unit:"lbs",current:"",target:"",category:"strength"});setShowAdd(false);}} style={{...S.btn("#ca8a04","#000"),width:"100%"}}>ADD GOAL</button>
    </div>}
    {goals.map(g=>{const meta=CAT_GOAL_META[g.category]||CAT_GOAL_META.strength;const pp=progressPct(g.current,g.target,g.category);return(<div key={g.id} style={S.card}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:16}}>{meta.icon}</span><span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:17}}>{g.name}</span><Tag color={meta.color}>{g.category}</Tag></div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>{editId===g.id?(<><input type="number" value={editVal} onChange={e=>setEditVal(e.target.value)} style={{...S.input,width:70,padding:"4px 8px"}}/><button onClick={()=>{onUpdate(g.id,parseFloat(editVal));setEditId(null);}} style={S.btn(meta.color,"#000")}>SAVE</button></>):(<><span style={{fontFamily:"'Barlow',sans-serif",fontSize:12}}><span style={{color:meta.color,fontWeight:700}}>{g.current}</span><span style={{color:"#71717a"}}> / {g.target} {g.unit}</span></span><button onClick={()=>{setEditVal(g.current);setEditId(g.id);}} style={{...S.btn("#f9f9f9","#71717a"),padding:"4px 10px",fontSize:12}}>UPDATE</button><button onClick={()=>onDelete(g.id)} style={{background:"none",border:"none",color:"#d4d4d8",cursor:"pointer"}}>🗑</button></>)}</div>
      </div>
      <div style={{height:6,background:"#f9f9f9",borderRadius:99,overflow:"hidden"}}><div style={{width:`${pp}%`,height:"100%",background:`linear-gradient(90deg,${meta.color}66,${meta.color})`,borderRadius:99,transition:"width 0.5s"}}/></div>
      <div style={{textAlign:"right",fontSize:10,color:"#71717a",marginTop:3,fontFamily:"'Barlow',sans-serif"}}>{pp}%</div>
    </div>);})}
  </div>);
}

// ─── INJURY ───────────────────────────────────────────────────────────────────
function InjuryTab({injuries,onSave,onDelete}){
  const [area,setArea]=useState("");const [severity,setSeverity]=useState("mild");const [trigger,setTrigger]=useState("");const [helped,setHelped]=useState("");const [notes,setNotes]=useState("");const [saved,setSaved]=useState(false);
  const AREAS=["Left Knee (patella)","Left Knee (lateral)","Left Knee (medial)","Right Knee","Left Hip","Lower Back","Left Ankle","Right Ankle","Hamstring","Quad","Groin","Shoulder","Other"];
  const SEVS=[{v:"mild",l:"Mild",c:"#ca8a04"},{v:"moderate",l:"Moderate",c:"#f97316"},{v:"severe",l:"Severe",c:"#dc2626"},{v:"resolved",l:"Resolved",c:"#16a34a"}];
  function handleSave(){if(!area)return;onSave({id:Date.now(),date:today(),area,severity,trigger,helped,notes});setSaved(true);setTimeout(()=>{setSaved(false);setArea("");setSeverity("mild");setTrigger("");setHelped("");setNotes("");},1800);}
  const pm={};injuries.forEach(i=>{if(!pm[i.area])pm[i.area]=0;pm[i.area]++;});
  const recurring=Object.entries(pm).filter(([,n])=>n>=2);
  return(<div><STitle sub="Pain · Flare-ups · What helped">HEALTH JOURNAL</STitle>
    {recurring.length>0&&<div style={{...S.card,background:"#dc26260d",border:"1px solid #FF3D0033",marginBottom:12}}><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,color:"#dc2626",marginBottom:6}}>🔁 RECURRING</div>{recurring.map(([a,n])=><div key={a} style={{display:"flex",justifyContent:"space-between",fontFamily:"'Barlow',sans-serif",fontSize:12,padding:"3px 0"}}><span style={{color:"#374151"}}>{a}</span><span style={{color:"#dc2626",fontWeight:700}}>{n}×</span></div>)}</div>}
    <div style={{...S.card,background:"#f9f9f9"}}>
      <span style={S.label}>Area</span><div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>{AREAS.map(a=><button key={a} onClick={()=>setArea(a)} style={{background:area===a?"#FF3D0022":"transparent",color:area===a?"#dc2626":"#71717a",border:`1px solid ${area===a?"#dc2626":"#e4e4e7"}`,borderRadius:8,padding:"5px 8px",cursor:"pointer",fontFamily:"'Barlow',sans-serif",fontSize:11,fontWeight:area===a?700:400}}>{a}</button>)}</div>
      <div style={{display:"flex",gap:6,marginBottom:10}}>{SEVS.map(s=><button key={s.v} onClick={()=>setSeverity(s.v)} style={{flex:1,padding:"7px 4px",background:severity===s.v?s.c+"33":"transparent",border:`1px solid ${severity===s.v?s.c:"#e4e4e7"}`,borderRadius:8,cursor:"pointer",fontFamily:"'Barlow',sans-serif",fontSize:12,fontWeight:700,color:severity===s.v?s.c:"#71717a"}}>{s.l}</button>)}</div>
      <input placeholder="What triggered it?" value={trigger} onChange={e=>setTrigger(e.target.value)} style={{...S.input,marginBottom:7}}/>
      <input placeholder="What helped?" value={helped} onChange={e=>setHelped(e.target.value)} style={{...S.input,marginBottom:7}}/>
      <input placeholder="Notes" value={notes} onChange={e=>setNotes(e.target.value)} style={{...S.input,marginBottom:10}}/>
      <button onClick={handleSave} style={{...S.btn(saved?"#16a34a":"#dc2626","#fff"),width:"100%"}}>{saved?"✓ LOGGED":"LOG ISSUE"}</button>
    </div>
    {[...injuries].reverse().map(i=>{const sev=SEVS.find(s=>s.v===i.severity)||SEVS[0];return(<div key={i.id} style={{...S.card,borderLeft:`3px solid ${sev.c}`}}>
      <div style={{display:"flex",justifyContent:"space-between"}}><div><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15}}>{i.area}</div><Tag color={sev.c}>{sev.l}</Tag></div><div style={{display:"flex",gap:8,alignItems:"center"}}><span style={{fontSize:11,color:"#71717a",fontFamily:"'Barlow',sans-serif"}}>{fmtDate(i.date)}</span><button onClick={()=>onDelete(i.id)} style={{background:"none",border:"none",color:"#d4d4d8",cursor:"pointer"}}>🗑</button></div></div>
      {i.trigger&&<div style={{fontSize:11,color:"#71717a",fontFamily:"'Barlow',sans-serif",marginTop:4}}>⚡ {i.trigger}</div>}
      {i.helped&&<div style={{fontSize:11,color:"#16a34a",fontFamily:"'Barlow',sans-serif",marginTop:2}}>✓ {i.helped}</div>}
    </div>);})}
  </div>);
}

// ─── MORE ─────────────────────────────────────────────────────────────────────
function MoreTab({workouts,cardioLog,bbLog,prs,bodyLog,checkIns,injuries,setTab}){
  const [timerOpen,setTimerOpen]=useState(false);const [activOpen,setActivOpen]=useState(false);const [step,setStep]=useState(0);const [done,setDone]=useState([]);
  function exportCSV(){
    const rows=[["Date","Type","Name","Detail","Notes"]];
    workouts.forEach(w=>{w.exercises?.forEach(e=>{const sd=e.setData?.filter(s=>s.weight||s.value).map((s,i)=>`S${i+1}:${s.weight||""}lb×${s.value||""}`).join(" ")||`${e.sets}×`;rows.push([w.date,"Workout",w.name,`${e.exercise} ${sd}`,e.note||""]);});});
    bbLog.forEach(b=>rows.push([b.date,"Ball",b.sessionType,`${b.duration||""}min`,`LKnee:${b.body?.kneeLeft||""}`]));
    prs.forEach(p=>rows.push([p.date,"PR",p.exercise,`${p.weight}lbs ×${p.reps}`,p.notes||""]));
    bodyLog.forEach(b=>rows.push([b.date,"Body",`Wt:${b.weight||""} Vert:${b.vertical||""}`,"",(b.notes||"")]));
    checkIns.forEach(c=>rows.push([c.date,"Check-in",`Sleep:${c.sleep}h`,`E:${c.energy} S:${c.soreness}`,(c.notes||"")]));
    injuries.forEach(i=>rows.push([i.date,"Injury",i.area,i.severity,(i.trigger||"")]));
    const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob=new Blob([csv],{type:"text/csv"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`apextrack_${today()}.csv`;a.click();URL.revokeObjectURL(url);
  }
  const all=new Set([...workouts.map(w=>w.date),...bbLog.map(b=>b.date)]);let streak=0;for(let i=0;i<365;i++){if(all.has(daysAgo(i)))streak++;else break;}
  return(<div>
    <STitle sub="Tools · Timer · Activation · Export">MORE</STitle>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
      {[{icon:"⏱",label:"Rest Timer",color:"#16a34a",action:()=>setTimerOpen(t=>!t)},{icon:"🔥",label:"Pre-game Activation",color:"#f97316",action:()=>setActivOpen(t=>!t)},{icon:"🩹",label:"Health Journal",color:"#dc2626",action:()=>setTab("INJURY")},{icon:"📊",label:"Export CSV",color:"#0ea5e9",action:exportCSV}].map(item=>(
        <button key={item.label} onClick={item.action} style={{background:item.color+"18",border:`1px solid ${item.color}33`,borderRadius:12,padding:"16px 14px",cursor:"pointer",textAlign:"left"}}>
          <div style={{fontSize:22,marginBottom:4}}>{item.icon}</div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,color:item.color}}>{item.label}</div>
        </button>
      ))}
    </div>
    {timerOpen&&<div style={{...S.card,marginBottom:14}}><RestTimer/></div>}
    {activOpen&&(
      <div style={{...S.card,background:"#f9731610",border:"1px solid #f9731633",marginBottom:14}}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:"#f97316",marginBottom:12}}>🔥 PRE-GAME ACTIVATION</div>
        {ACTIVATION.map((a,i)=>(
          <div key={i} onClick={()=>setDone(d=>d.includes(i)?d.filter(x=>x!==i):[...d,i])} style={{display:"flex",gap:12,alignItems:"center",padding:"10px 12px",background:done.includes(i)?"#16a34a18":"#f9f9f9",border:`1px solid ${done.includes(i)?"#22c55e44":"#e4e4e7"}`,borderRadius:10,marginBottom:6,cursor:"pointer"}}>
            <div style={{width:22,height:22,borderRadius:"50%",border:`2px solid ${done.includes(i)?"#16a34a":"#71717a"}`,background:done.includes(i)?"#16a34a":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              {done.includes(i)&&<span style={{color:"#000",fontSize:11,fontWeight:700}}>✓</span>}
            </div>
            <div style={{flex:1}}>
              <div style={{fontFamily:"'Barlow',sans-serif",fontWeight:700,fontSize:13,color:done.includes(i)?"#16a34a":"#18181b"}}>{a.name}</div>
              <div style={{fontSize:11,color:"#71717a"}}>{a.duration} · {a.side} · {a.note}</div>
            </div>
          </div>
        ))}
        <div style={{marginTop:8,fontFamily:"'Bebas Neue',sans-serif",fontSize:14,color:"#71717a"}}>{done.length}/{ACTIVATION.length} complete</div>
      </div>
    )}
    <div style={S.card}>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,marginBottom:10}}>ALL-TIME STATS</div>
      {[{l:"Total Workouts",v:workouts.length,c:"#ca8a04"},{l:"Ball Sessions",v:bbLog.length,c:"#f97316"},{l:"Exercises Logged",v:workouts.reduce((s,w)=>s+(w.exercises?.length||0),0),c:"#0ea5e9"},{l:"Current Streak",v:`${streak} days`,c:"#7c3aed"},{l:"PRs Tracked",v:prs.length,c:"#16a34a"}].map(s=>(
        <div key={s.l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #1a1a1a"}}>
          <span style={{fontFamily:"'Barlow',sans-serif",fontSize:13,color:"#6b7280"}}>{s.l}</span>
          <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:17,color:s.c}}>{s.v}</span>
        </div>
      ))}
    </div>
    <div style={S.card}>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,marginBottom:10}}>ACTIVITY STREAK</div>
      {(()=>{const days=[];for(let i=83;i>=0;i--)days.push(daysAgo(i));const weeks=[];for(let i=0;i<days.length;i+=7)weeks.push(days.slice(i,i+7));const gc=d=>{const hw=workouts.some(w=>w.date===d);const hb=bbLog.some(b=>b.date===d);const hc=(cardioLog||[]).some(c=>c.date===d);if(hw&&hb)return"#f97316";if(hw)return"#ca8a04";if(hb)return"#f9731688";if(hc)return"#60a5fa";return"#e4e4e7";};return(<div style={{display:"flex",gap:3}}>{weeks.map((wk,wi)=><div key={wi} style={{display:"flex",flexDirection:"column",gap:3}}>{wk.map(d=><div key={d} style={{width:9,height:9,borderRadius:2,background:gc(d)}}/>)}</div>)}</div>);})()}
    </div>
  </div>);
}

// ─── BOTTOM NAV ───────────────────────────────────────────────────────────────
// ─── PROGRAM DATA ─────────────────────────────────────────────────────────────
const SESSION_TYPES={
  "Lower A":{color:"#ca8a04",icon:"⚡",tag:"Sprint · Squat PAP · Vertical"},
  "Lower B":{color:"#f97316",icon:"🚀",tag:"Sprint · Hip PAP · Horizontal"},
  "Upper A":{color:"#0ea5e9",icon:"💪",tag:"Pull · Push · Core"},
  "Upper B":{color:"#16a34a",icon:"🏀",tag:"Pull · Push · Athletic"},
  "Pickup":{color:"#dc2626",icon:"🏀",tag:"Basketball"},
  "Rest":{color:"#71717a",icon:"😴",tag:"Recovery"},
  "Skill Work":{color:"#7c3aed",icon:"🎯",tag:"Shooting / Drills"},
};

const INTENSITY_TABLE=[
  {week:1,phase:"Eccentric",pct:"65%",reps:"5×6",tempo:"5s down / 1s pause / explode",plyoPct:"80%",color:"#0ea5e9"},
  {week:2,phase:"Eccentric",pct:"70%",reps:"4×6",tempo:"4s down / 1s pause / explode",plyoPct:"80%",color:"#0ea5e9"},
  {week:3,phase:"Eccentric",pct:"75%",reps:"4×5",tempo:"3s down / 1s pause / explode",plyoPct:"85%",color:"#0ea5e9"},
  {week:4,phase:"Isometric",pct:"75%",reps:"4×5",tempo:"1s down / 3s pause / explode",plyoPct:"85%",color:"#ca8a04"},
  {week:5,phase:"Isometric",pct:"80%",reps:"4×4",tempo:"1s down / 3s pause / explode",plyoPct:"90%",color:"#ca8a04"},
  {week:6,phase:"Isometric",pct:"85%",reps:"3×4",tempo:"1s down / 3s pause / explode",plyoPct:"90%",color:"#ca8a04"},
  {week:7,phase:"Concentric",pct:"85%",reps:"4×4",tempo:"Normal / explode fast",plyoPct:"95%",color:"#f97316"},
  {week:8,phase:"Concentric",pct:"90%",reps:"4×3",tempo:"Normal / max intent",plyoPct:"100%",color:"#f97316"},
  {week:9,phase:"Concentric",pct:"95%",reps:"3×3",tempo:"Normal / max intent",plyoPct:"100%",color:"#f97316"},
  {week:10,phase:"Deload",pct:"60%",reps:"3×5",tempo:"Normal",plyoPct:"70%",color:"#7c3aed"},
  {week:11,phase:"Peak",pct:"90%",reps:"3×3",tempo:"Max intent",plyoPct:"100%",color:"#dc2626"},
  {week:12,phase:"Peak / Test",pct:"100%",reps:"1–3 RM",tempo:"Max intent — PR day",plyoPct:"MAX",color:"#dc2626"},
];

const PROGRAM_DAYS={
  "Lower A":{
    color:"#ca8a04",icon:"⚡",est:"40 min",
    sections:[
      {title:"ACTIVATION + NEURAL PRIMING",color:"#71717a",items:[
        {name:"90/90 Hip Switches",sets:"2",reps:"8/side",note:"Hip IR/ER prep. Non-negotiable.",restSecs:30},
        {name:"Isometric Squat Hold — Max Push",sets:"3",reps:"5s hold",note:"90° bend. Push floor as hard as possible. Primes motor unit recruitment.",restSecs:30},
        {name:"Ankle Pogos",sets:"2",reps:"20s",note:"Bilateral fast. Tendon spring primer.",restSecs:20},
        {name:"Banded Ankle Pogos",sets:"2",reps:"20s",note:"Band anchored behind hips. Forces higher CNS recruitment than free pogos.",restSecs:20},
      ]},
      {title:"SPRINT BLOCK",color:"#dc2626",items:[
        {name:"Acceleration Starts 10m",sets:"8",reps:"10m",note:"3-point stance. Drive phase only. Max effort. 80m total.",restSecs:60},
      ]},
      {title:"PAP COMPLEX A — SQUAT → DEPTH DROP",color:"#f97316",items:[
        {name:"Box Squat / Pin Squat at Parallel",sets:"3",reps:"Phase-based",note:"POTENTIATION LIFT — VERTICAL FORCE. REST 4 FULL MINUTES before depth drops.",restSecs:240,hasWeight:true},
        {name:"Depth Drop → Max Vertical Jump",sets:"4",reps:"3",note:"POTENTIATED. Step off 18–24\" box. Absorb fast. Explode max height.",restSecs:90},
      ]},
      {title:"PAP COMPLEX B — CLEAN → APPROACH JUMP",color:"#f97316",items:[
        {name:"Power Clean / Hang Clean",sets:"4",reps:"3",note:"POTENTIATION LIFT. Triple extension. REST 4 FULL MINUTES after final set.",restSecs:240,hasWeight:true},
        {name:"Max Approach Jump / Lowered Rim Dunk",sets:"5",reps:"3",note:"W1-4: 1-step. W5+: 2-3 step approach. W7+: lower the rim — practice full dunk.",restSecs:90},
      ]},
      {title:"STRENGTH BLOCK",color:"#ca8a04",items:[
        {name:"Split Stance Trap Bar Extension",sets:"4",reps:"Phase-based",note:"Primary quad + posterior chain. Right leg first every set.",restSecs:180,hasWeight:true},
        {name:"Barbell RDL",sets:"3",reps:"Phase-based",note:"Hip hinge. Hamstring eccentric. Phase-specific tempo.",restSecs:150,hasWeight:true},
        {name:"Nordic Curl Negative",sets:"3",reps:"5",note:"Lower only. 4s down. Use hands to return.",restSecs:120},
      ]},
      {title:"FINISHER",color:"#71717a",items:[
        {name:"Single Leg Calf Raise",sets:"3",reps:"12/side",note:"Off a step. Slow eccentric. Right leg priority.",restSecs:45},
        {name:"Isometric Wall Sit",sets:"2",reps:"45s",note:"Provocative angle. Quad tendon pain inhibition. Every lower day.",restSecs:45},
      ]},
    ]
  },
  "Upper A":{
    color:"#0ea5e9",icon:"💪",est:"35 min",
    sections:[
      {title:"WARM UP",color:"#71717a",items:[
        {name:"Band Pull-Aparts",sets:"3",reps:"20",note:"Shoulder health. Every upper session.",restSecs:20},
        {name:"Thoracic Rotations",sets:"2",reps:"8/side",note:"",restSecs:20},
        {name:"Cat-Cow",sets:"2",reps:"10",note:"Lumbar prep.",restSecs:20},
      ]},
      {title:"PRIMARY STRENGTH",color:"#0ea5e9",items:[
        {name:"Pendlay Row",sets:"5",reps:"Phase-based",note:"Every upper session. Forever. Opens back and pelvis.",restSecs:180,hasWeight:true},
        {name:"Weighted Pull-Up",sets:"4",reps:"Phase-based",note:"Add weight when all reps clean.",restSecs:150,hasWeight:true},
        {name:"Incline Dumbbell Press",sets:"4",reps:"Phase-based",note:"Shoulder-friendly. Primary chest builder.",restSecs:120,hasWeight:true},
        {name:"Overhead Press",sets:"4",reps:"Phase-based",note:"Strict. No leg drive.",restSecs:120,hasWeight:true},
      ]},
      {title:"CORE + ACCESSORIES",color:"#0ea5e9",items:[
        {name:"Pallof Press",sets:"3",reps:"10/side",note:"Anti-rotation core. Carryover to back pain and cutting.",restSecs:45},
        {name:"Face Pulls",sets:"3",reps:"15",note:"Rotator cuff. Every upper session.",restSecs:45},
        {name:"Curl + Pushdown superset",sets:"3",reps:"12 each",note:"One superset. In and out.",restSecs:45},
      ]},
    ]
  },
  "Lower B":{
    color:"#f97316",icon:"🚀",est:"40 min",
    sections:[
      {title:"ACTIVATION + NEURAL PRIMING",color:"#71717a",items:[
        {name:"World's Greatest Stretch",sets:"2",reps:"5/side",note:"Full lower body prime.",restSecs:30},
        {name:"Isometric Squat Hold — Max Push",sets:"3",reps:"5s hold",note:"Motor unit priming. Every lower session.",restSecs:30},
        {name:"Ankle Pogos",sets:"2",reps:"20s",note:"Every lower session.",restSecs:20},
        {name:"Banded Ankle Pogos",sets:"2",reps:"20s",note:"Band behind hips. CNS recruitment above free pogos.",restSecs:20},
      ]},
      {title:"SPRINT BLOCK",color:"#dc2626",items:[
        {name:"Sled Sprint 15m (W3+ only)",sets:"4",reps:"15m",note:"W1-2: acceleration starts. W3+: 10-15% bodyweight. 60m sled volume.",restSecs:90},
        {name:"Free Acceleration Starts 20m",sets:"3",reps:"20m",note:"After sled. Overspeed effect. 60m free volume. Total ~120m.",restSecs:90},
      ]},
      {title:"PAP COMPLEX — ALTERNATING WEEKS",color:"#f97316",items:[
        {name:"Trap Bar DL (odd) / Hip Thrust (even)",sets:"3",reps:"Phase-based",note:"Odd weeks: Trap Bar. Even weeks: Hip Thrust. Both horizontal force. REST 4 MIN after final set.",restSecs:240,hasWeight:true},
        {name:"Box Jump — Max Height",sets:"4",reps:"3",note:"POTENTIATED. Track max height every week.",restSecs:90},
        {name:"Broad Jump — Max Distance",sets:"4",reps:"3",note:"POTENTIATED. Measure and record distance every week.",restSecs:90},
      ]},
      {title:"STRENGTH BLOCK",color:"#f97316",items:[
        {name:"Bulgarian Split Squat",sets:"3",reps:"Phase-based",note:"Right leg first. Add load when form locked.",restSecs:150,hasWeight:true},
        {name:"Back Extension",sets:"3",reps:"12",note:"Every lower day. Opens your back and pelvis.",restSecs:90,hasWeight:true},
        {name:"Single Leg Calf Raise",sets:"3",reps:"12/side",note:"Off a step. Right leg priority.",restSecs:45},
      ]},
      {title:"FINISHER",color:"#71717a",items:[
        {name:"Isometric Wall Sit",sets:"2",reps:"45s",note:"Every lower day. Quad tendon inhibition.",restSecs:45},
        {name:"90/90 Hip IR PNF",sets:"2",reps:"each side",note:"30s hold → 10s push → 30s deeper.",restSecs:30},
      ]},
    ]
  },
  "Upper B":{
    color:"#16a34a",icon:"🏀",est:"35 min",
    sections:[
      {title:"WARM UP",color:"#71717a",items:[
        {name:"Band Dislocates",sets:"2",reps:"10",note:"Shoulder mobility.",restSecs:20},
        {name:"Scapular Push-Ups",sets:"2",reps:"10",note:"",restSecs:20},
      ]},
      {title:"PRIMARY STRENGTH",color:"#16a34a",items:[
        {name:"Pendlay Row",sets:"5",reps:"Phase-based",note:"Every upper session. Every week.",restSecs:180,hasWeight:true},
        {name:"Weighted Chin-Up",sets:"4",reps:"Phase-based",note:"Chin-up grip today.",restSecs:150,hasWeight:true},
        {name:"Bench Press",sets:"4",reps:"Phase-based",note:"Progressive overload every session.",restSecs:150,hasWeight:true},
        {name:"Single Arm Dumbbell Row",sets:"3",reps:"10/side",note:"Heavy. Full ROM.",restSecs:90,hasWeight:true},
      ]},
      {title:"ATHLETIC UPPER + CORE",color:"#16a34a",items:[
        {name:"Med Ball Slam",sets:"4",reps:"5",note:"Full body explosive. Rate of force development. Max effort.",restSecs:60},
        {name:"Face Pulls",sets:"3",reps:"15",note:"Rotator cuff. Every upper session.",restSecs:45},
        {name:"Suitcase Carry",sets:"3",reps:"20m/side",note:"Heavy. Lateral core + pelvis stability.",restSecs:45,hasWeight:true},
        {name:"Hammer Curl + Tricep superset",sets:"3",reps:"12 each",note:"One superset. Done.",restSecs:45},
      ]},
    ]
  },
};

// ─── PROGRAM TAB ─────────────────────────────────────────────────────────────
function ProgramTab({schedule,onScheduleChange,workouts,bbLog,checkIns}){
  const [view,setView]=useState("schedule"); // schedule | workout | intensity | advice
  const [selectedDate,setSelectedDate]=useState(today());
  const [calendarMonth,setCalendarMonth]=useState(new Date());
  const [activeWorkoutDay,setActiveWorkoutDay]=useState(null);
  const [openSections,setOpenSections]=useState({});
  const [weights,setWeights]=useState(()=>{try{return JSON.parse(localStorage.getItem("apex_prog_weights")||"{}");}catch{return{};}});
  const [advice,setAdvice]=useState("");
  const [adviceLoading,setAdviceLoading]=useState(false);
  const [programWeek,setProgramWeek]=useState(1);

  const todayStr=today();
  const weekRow=INTENSITY_TABLE[programWeek-1]||INTENSITY_TABLE[0];

  const saveWeight=(key,val)=>{
    const updated={...weights,[key]:val};
    setWeights(updated);
    try{localStorage.setItem("apex_prog_weights",JSON.stringify(updated));}catch{}
  };

  const toggleSection=(key)=>setOpenSections(p=>({...p,[key]:!p[key]}));
  const isSectionOpen=(key)=>openSections[key]!==false;

  // Build calendar days for current month view
  const buildCalendarDays=()=>{
    const year=calendarMonth.getFullYear();
    const month=calendarMonth.getMonth();
    const firstDay=new Date(year,month,1).getDay();
    const daysInMonth=new Date(year,month+1,0).getDate();
    const days=[];
    for(let i=0;i<firstDay;i++)days.push(null);
    for(let i=1;i<=daysInMonth;i++){
      const d=new Date(year,month,i);
      days.push(d.toISOString().split("T")[0]);
    }
    return days;
  };

  // Check scheduling conflicts
  const getConflicts=(sched)=>{
    const warnings=[];
    const dates=Object.keys(sched).sort();
    dates.forEach(d=>{
      const session=sched[d];
      const nextDay=new Date(d);nextDay.setDate(nextDay.getDate()+1);
      const nextStr=nextDay.toISOString().split("T")[0];
      const nextSession=sched[nextStr];
      if((session==="Pickup"||session==="Lower A"||session==="Lower B")&&(nextSession==="Lower A"||nextSession==="Lower B")){
        warnings.push({date:d,msg:`${session} on ${fmtDate(d)} before ${nextSession} on ${fmtDate(nextStr)} — legs won't recover in time.`});
      }
      if(session==="Pickup"&&nextSession==="Lower A"){
        warnings.push({date:d,msg:`Pickup on ${fmtDate(d)} directly before Lower A on ${fmtDate(nextStr)} — CNS won't be fresh for jumps.`});
      }
    });
    // Check 3+ consecutive training days
    dates.forEach((d,i)=>{
      if(i<2)return;
      const d1=dates[i-2],d2=dates[i-1],d3=d;
      const gap1=new Date(d2)-new Date(d1),gap2=new Date(d3)-new Date(d2);
      if(gap1===86400000&&gap2===86400000){
        const s1=sched[d1],s2=sched[d2],s3=sched[d3];
        if(s1!=="Rest"&&s2!=="Rest"&&s3!=="Rest"){
          warnings.push({date:d,msg:`3 consecutive training days (${fmtDate(d1)}–${fmtDate(d3)}) — consider adding a rest day.`});
        }
      }
    });
    return warnings;
  };

  const conflicts=getConflicts(schedule);

  // Get AI scheduling advice
  const getAIAdvice=async()=>{
    setAdviceLoading(true);
    setAdvice("");
    const recentWorkouts=workouts.slice(-5).map(w=>w.name||"Workout").join(", ")||"none";
    const recentBall=bbLog.filter(b=>b.date>=daysAgo(7)).length;
    const lastCheckIn=checkIns.sort((a,b)=>b.date.localeCompare(a.date))[0];
    const schedEntries=Object.entries(schedule).filter(([d])=>d>=todayStr).slice(0,7);
    const schedSummary=schedEntries.map(([d,s])=>`${fmtDate(d)}: ${s}`).join(", ")||"No sessions scheduled yet";
    const conflictSummary=conflicts.length?conflicts.map(c=>c.msg).join(". "):"No conflicts detected";
    const text=await callCoach(
      `You are an elite athletic performance coach for Khayre Farah, a 29-year-old basketball player. He has post-ACL reconstruction (right knee), mild-moderate bilateral OA, and is following a 12-week triphasic program targeting a 40-inch vertical and dunking. He trains 4 days/week: Lower A (squat PAP + vertical), Upper A, Lower B (hip/pull PAP + horizontal), Upper B. He also plays pickup basketball 2-3x/week. Key rules: never schedule pickup or Lower directly before another Lower day. Max 3 consecutive training days. Monitor knee effusion. Be direct, specific, and concise — max 150 words.`,
      [{role:"user",content:`Schedule this week: ${schedSummary}. Conflicts: ${conflictSummary}. Recent workouts: ${recentWorkouts}. Ball sessions this week: ${recentBall}. Last check-in — sleep: ${lastCheckIn?.sleep||"?"}h, energy: ${lastCheckIn?.energy||"?"}/5. Program week: ${programWeek} (${weekRow.phase} phase, ${weekRow.pct} 1RM). Give me specific scheduling advice and one training cue for today.`}],
      250
    );
    setAdvice(text);
    setAdviceLoading(false);
  };

  const calDays=buildCalendarDays();
  const monthName=calendarMonth.toLocaleDateString("en-US",{month:"long",year:"numeric"});

  // This week's schedule
  const now=new Date();
  const dow=now.getDay();
  const weekDays=[];
  for(let i=0;i<7;i++){
    const d=new Date(now);d.setDate(now.getDate()-dow+i);
    weekDays.push(d.toISOString().split("T")[0]);
  }

  return(
    <div>
      <STitle sub="12-Week Triphasic · PAP Potentiation">PROGRAM</STitle>

      {/* Program week selector */}
      <div style={{...S.card,padding:"12px 16px",marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <span style={{...S.label,marginBottom:0}}>Program Week</span>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <button onClick={()=>setProgramWeek(w=>Math.max(1,w-1))} style={{...S.btn("#f4f4f5","#18181b"),padding:"4px 12px",fontSize:16,borderRadius:6,border:"1px solid #e4e4e7"}}>‹</button>
            <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:weekRow.color,minWidth:28,textAlign:"center"}}>{programWeek}</span>
            <button onClick={()=>setProgramWeek(w=>Math.min(12,w+1))} style={{...S.btn("#f4f4f5","#18181b"),padding:"4px 12px",fontSize:16,borderRadius:6,border:"1px solid #e4e4e7"}}>›</button>
          </div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          <span style={{fontSize:12,fontWeight:700,color:weekRow.color,fontFamily:"'Barlow',sans-serif"}}>{weekRow.phase.toUpperCase()}</span>
          <span style={{fontSize:12,color:"#71717a",fontFamily:"'Barlow',sans-serif"}}>{weekRow.pct} 1RM · {weekRow.reps} · Plyo: {weekRow.plyoPct}</span>
        </div>
        <div style={{fontSize:11,color:"#71717a",fontFamily:"'Barlow',sans-serif",marginTop:4}}>{weekRow.tempo}</div>
      </div>

      {/* View tabs */}
      <div style={{display:"flex",gap:4,marginBottom:16,overflowX:"auto",paddingBottom:2}}>
        {[["schedule","📅 Schedule"],["workout","💪 Workout"],["intensity","📊 Intensity"],["advice","🧠 AI Advice"]].map(([k,l])=>(
          <button key={k} onClick={()=>setView(k)} style={{...S.btn(view===k?"#18181b":"#ffffff",view===k?"#ca8a04":"#71717a"),padding:"7px 14px",fontSize:12,borderRadius:8,border:`1px solid ${view===k?"#18181b":"#e4e4e7"}`,whiteSpace:"nowrap",fontFamily:"'Barlow',sans-serif",fontWeight:700,letterSpacing:.5}}>{l}</button>
        ))}
      </div>

      {/* ── SCHEDULE VIEW ── */}
      {view==="schedule"&&(
        <div>
          {/* Conflicts */}
          {conflicts.length>0&&(
            <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,padding:"10px 14px",marginBottom:12}}>
              <div style={{fontSize:12,fontWeight:700,color:"#dc2626",fontFamily:"'Barlow',sans-serif",marginBottom:6}}>⚠️ Scheduling Conflicts</div>
              {conflicts.map((c,i)=>(
                <div key={i} style={{fontSize:12,color:"#991b1b",fontFamily:"'Barlow',sans-serif",marginBottom:2}}>→ {c.msg}</div>
              ))}
            </div>
          )}

          {/* This Week Strip */}
          <div style={{...S.card,padding:"14px 12px",marginBottom:12}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,letterSpacing:1,marginBottom:10}}>THIS WEEK</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
              {weekDays.map((d,i)=>{
                const session=schedule[d];
                const meta=session?SESSION_TYPES[session]:null;
                const isToday=d===todayStr;
                const isPast=d<todayStr;
                const workoutLogged=workouts.some(w=>w.date===d)||bbLog.some(b=>b.date===d);
                return(
                  <div key={d} onClick={()=>{setSelectedDate(d);}}
                    style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,cursor:"pointer"}}>
                    <div style={{fontSize:9,fontFamily:"'Barlow',sans-serif",fontWeight:700,color:isToday?"#ca8a04":"#3f3f46",textTransform:"uppercase"}}>
                      {["S","M","T","W","T","F","S"][i]}
                    </div>
                    <div style={{fontSize:9,fontFamily:"'Barlow',sans-serif",color:isToday?"#ca8a04":"#52525b"}}>
                      {new Date(d+"T12:00:00").getDate()}
                    </div>
                    <div style={{width:"100%",minHeight:42,background:meta?meta.color+"15":isToday?"#ca8a0408":"#f9f9f9",border:`1px solid ${isToday?"#ca8a0433":meta?meta.color+"44":"#e4e4e7"}`,borderRadius:8,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1,padding:"3px 1px",position:"relative"}}>
                      {meta&&<span style={{fontSize:13}}>{meta.icon}</span>}
                      {meta&&<span style={{fontSize:7,fontFamily:"'Barlow',sans-serif",fontWeight:700,color:meta.color,textAlign:"center",lineHeight:1.2,padding:"0 2px"}}>{session.split(" ")[0]}{session.split(" ")[1]?" "+session.split(" ")[1]:""}</span>}
                      {!meta&&<div style={{width:4,height:4,borderRadius:"50%",background:"#e4e4e7"}}/>}
                      {workoutLogged&&<div style={{position:"absolute",top:2,right:2,width:5,height:5,borderRadius:"50%",background:"#16a34a"}}/>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Month Calendar */}
          <div style={{...S.card,padding:"14px 12px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <button onClick={()=>setCalendarMonth(m=>{const n=new Date(m);n.setMonth(n.getMonth()-1);return n;})} style={{...S.btn("#f4f4f5","#18181b"),padding:"4px 12px",fontSize:16,borderRadius:6,border:"1px solid #e4e4e7"}}>‹</button>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:1}}>{monthName}</div>
              <button onClick={()=>setCalendarMonth(m=>{const n=new Date(m);n.setMonth(n.getMonth()+1);return n;})} style={{...S.btn("#f4f4f5","#18181b"),padding:"4px 12px",fontSize:16,borderRadius:6,border:"1px solid #e4e4e7"}}>›</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:6}}>
              {["S","M","T","W","T","F","S"].map((d,i)=>(
                <div key={i} style={{textAlign:"center",fontSize:9,fontFamily:"'Barlow',sans-serif",fontWeight:700,color:"#71717a",paddingBottom:4}}>{d}</div>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
              {calDays.map((d,i)=>{
                if(!d)return <div key={i}/>;
                const session=schedule[d];
                const meta=session?SESSION_TYPES[session]:null;
                const isToday=d===todayStr;
                const isSelected=d===selectedDate;
                const workoutLogged=workouts.some(w=>w.date===d)||bbLog.some(b=>b.date===d);
                const hasConflict=conflicts.some(c=>c.date===d);
                return(
                  <div key={d} onClick={()=>setSelectedDate(d)}
                    style={{aspectRatio:"1",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",borderRadius:8,cursor:"pointer",background:isSelected?"#18181b":meta?meta.color+"12":isToday?"#ca8a0410":"transparent",border:`1px solid ${isSelected?"#18181b":hasConflict?"#fca5a5":meta?meta.color+"33":isToday?"#ca8a0444":"transparent"}`,position:"relative",padding:2}}>
                    <span style={{fontSize:10,fontFamily:"'Barlow',sans-serif",fontWeight:700,color:isSelected?"#ca8a04":isToday?"#ca8a04":"#52525b",lineHeight:1}}>{new Date(d+"T12:00:00").getDate()}</span>
                    {meta&&<span style={{fontSize:9,lineHeight:1}}>{meta.icon}</span>}
                    {workoutLogged&&<div style={{position:"absolute",top:2,right:2,width:4,height:4,borderRadius:"50%",background:"#16a34a"}}/>}
                    {hasConflict&&<div style={{position:"absolute",bottom:2,left:"50%",transform:"translateX(-50%)",width:4,height:4,borderRadius:"50%",background:"#dc2626"}}/>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Date Session Picker */}
          {selectedDate&&(
            <div style={{...S.card,marginTop:12}}>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,letterSpacing:1,marginBottom:10}}>
                {fmtDate(selectedDate)} {selectedDate===todayStr?"— Today":""}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {Object.entries(SESSION_TYPES).map(([k,v])=>{
                  const isActive=schedule[selectedDate]===k;
                  return(
                    <button key={k} onClick={()=>{const updated={...schedule,[selectedDate]:isActive?undefined:k};if(isActive)delete updated[selectedDate];onScheduleChange(updated);}}
                      style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:isActive?v.color+"15":"#f9f9f9",border:`1px solid ${isActive?v.color:"#e4e4e7"}`,borderRadius:10,cursor:"pointer",textAlign:"left"}}>
                      <span style={{fontSize:18}}>{v.icon}</span>
                      <div>
                        <div style={{fontSize:13,fontWeight:700,fontFamily:"'Barlow',sans-serif",color:isActive?v.color:"#18181b"}}>{k}</div>
                        <div style={{fontSize:9,color:"#71717a",fontFamily:"'Barlow',sans-serif"}}>{v.tag}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {schedule[selectedDate]&&["Lower A","Upper A","Lower B","Upper B"].includes(schedule[selectedDate])&&(
                <button onClick={()=>{setActiveWorkoutDay(schedule[selectedDate]);setView("workout");}}
                  style={{...S.btn("#18181b","#ca8a04"),width:"100%",marginTop:10,borderRadius:10,fontSize:15}}>
                  VIEW {schedule[selectedDate].toUpperCase()} WORKOUT →
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── WORKOUT VIEW ── */}
      {view==="workout"&&(
        <div>
          {/* Day selector */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:16}}>
            {Object.keys(PROGRAM_DAYS).map(k=>{
              const meta=PROGRAM_DAYS[k];
              const isActive=activeWorkoutDay===k;
              return(
                <button key={k} onClick={()=>setActiveWorkoutDay(k)} style={{padding:"10px 4px",textAlign:"center",background:isActive?meta.color:"#ffffff",color:isActive?"#ffffff":"#71717a",border:`1px solid ${isActive?meta.color:"#e4e4e7"}`,borderRadius:8,cursor:"pointer",transition:"all .1s"}}>
                  <div style={{fontSize:16}}>{meta.icon}</div>
                  <div style={{fontSize:11,fontWeight:700,fontFamily:"'Barlow',sans-serif"}}>{k}</div>
                  <div style={{fontSize:9,color:isActive?"rgba(255,255,255,.7)":"#a1a1aa",fontFamily:"'Barlow',sans-serif"}}>{meta.est}</div>
                </button>
              );
            })}
          </div>

          {activeWorkoutDay&&(()=>{
            const dayData=PROGRAM_DAYS[activeWorkoutDay];
            return(
              <div>
                {/* Week info bar */}
                <div style={{background:weekRow.color+"15",border:`1px solid ${weekRow.color}33`,borderRadius:10,padding:"10px 14px",marginBottom:12,display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:9,color:weekRow.color,fontFamily:"'Barlow',sans-serif",fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Week {programWeek} · {weekRow.phase}</div>
                    <div style={{fontSize:13,fontWeight:700,fontFamily:"'Barlow',sans-serif"}}>{weekRow.pct} 1RM · {weekRow.reps}</div>
                  </div>
                  <div style={{borderLeft:"1px solid #e4e4e7",paddingLeft:12}}>
                    <div style={{fontSize:9,color:"#71717a",fontFamily:"'Barlow',sans-serif",textTransform:"uppercase",letterSpacing:1}}>Tempo</div>
                    <div style={{fontSize:11,color:"#52525b",fontFamily:"'Barlow',sans-serif"}}>{weekRow.tempo}</div>
                  </div>
                  <div style={{borderLeft:"1px solid #e4e4e7",paddingLeft:12}}>
                    <div style={{fontSize:9,color:"#71717a",fontFamily:"'Barlow',sans-serif",textTransform:"uppercase",letterSpacing:1}}>Plyo</div>
                    <div style={{fontSize:11,fontWeight:700,color:"#16a34a",fontFamily:"'Barlow',sans-serif"}}>{weekRow.plyoPct}</div>
                  </div>
                </div>

                {dayData.sections.map((section,si)=>{
                  const key=`${activeWorkoutDay}-${si}`;
                  const open=isSectionOpen(key);
                  return(
                    <div key={si} style={{...S.card,padding:0,overflow:"hidden",marginBottom:8}}>
                      <button onClick={()=>toggleSection(key)} style={{width:"100%",padding:"12px 16px",background:"transparent",border:"none",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",textAlign:"left"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{width:8,height:8,borderRadius:"50%",background:section.color,flexShrink:0}}/>
                          <span style={{fontSize:11,fontWeight:700,fontFamily:"'Barlow',sans-serif",letterSpacing:1,color:"#18181b",textTransform:"uppercase"}}>{section.title}</span>
                          <span style={{fontSize:10,color:section.color,background:section.color+"15",padding:"2px 8px",borderRadius:4,fontFamily:"'Barlow',sans-serif",fontWeight:700}}>{section.items.length} exercises</span>
                        </div>
                        <span style={{color:"#a1a1aa",fontSize:14,transform:open?"rotate(180deg)":"none",display:"inline-block",transition:"transform .15s"}}>▾</span>
                      </button>

                      {open&&(
                        <div style={{borderTop:"1px solid #f4f4f5"}}>
                          {section.items.map((item,ii)=>{
                            const wKey=`${activeWorkoutDay}-w${programWeek}-${ii}-${si}`;
                            const prevWKey=`${activeWorkoutDay}-w${programWeek-1}-${ii}-${si}`;
                            const prevWeight=weights[prevWKey]||"";
                            const currWeight=weights[wKey]||"";
                            const suggested=prevWeight?(parseFloat(prevWeight)*1.025).toFixed(1):"";
                            return(
                              <div key={ii} style={{padding:"12px 16px",borderBottom:ii<section.items.length-1?"1px solid #f4f4f5":"none"}}>
                                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:4}}>
                                  <div style={{display:"flex",gap:8,alignItems:"flex-start",flex:1}}>
                                    <div style={{minWidth:22,height:22,background:section.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900,color:"#fff",borderRadius:4,flexShrink:0,marginTop:1,fontFamily:"'Barlow',sans-serif"}}>{ii+1}</div>
                                    <div style={{flex:1}}>
                                      <div style={{fontSize:14,fontWeight:700,fontFamily:"'Barlow',sans-serif",color:"#18181b",lineHeight:1.3}}>{item.name}</div>
                                      {item.note&&<div style={{fontSize:11,color:"#71717a",fontFamily:"'Barlow',sans-serif",marginTop:3,lineHeight:1.5}}>{item.note}</div>}
                                    </div>
                                  </div>
                                  <div style={{background:"#f4f4f5",border:`1px solid ${section.color}44`,borderRadius:6,padding:"4px 10px",textAlign:"center",flexShrink:0}}>
                                    <div style={{fontSize:11,fontWeight:700,fontFamily:"'Barlow',sans-serif",color:section.color,whiteSpace:"nowrap"}}>{item.sets}×{item.reps}</div>
                                    {item.restSecs>=60&&<div style={{fontSize:9,color:"#71717a",fontFamily:"'Barlow',sans-serif"}}>{Math.floor(item.restSecs/60)}min rest</div>}
                                  </div>
                                </div>
                                {item.hasWeight&&(
                                  <div style={{display:"flex",gap:8,alignItems:"center",marginTop:8,padding:"8px 10px",background:"#f9f9f9",borderRadius:8}}>
                                    <span style={{fontSize:10,color:"#71717a",fontFamily:"'Barlow',sans-serif",fontWeight:700,whiteSpace:"nowrap"}}>W{programWeek} WEIGHT:</span>
                                    <input type="number" placeholder="kg" value={currWeight} onChange={e=>saveWeight(wKey,e.target.value)}
                                      style={{...S.input,width:70,padding:"4px 8px",fontSize:13,borderRadius:6}}/>
                                    {prevWeight&&<span style={{fontSize:10,color:"#71717a",fontFamily:"'Barlow',sans-serif",whiteSpace:"nowrap"}}>Last: <b>{prevWeight}kg</b>{suggested&&<span style={{color:"#16a34a"}}> → try {suggested}kg</span>}</span>}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
          {!activeWorkoutDay&&(
            <div style={{textAlign:"center",padding:40,color:"#71717a",fontFamily:"'Barlow',sans-serif"}}>Select a workout day above</div>
          )}
        </div>
      )}

      {/* ── INTENSITY TABLE VIEW ── */}
      {view==="intensity"&&(
        <div>
          <div style={{...S.card,padding:"12px 16px",marginBottom:12,background:"#fffbeb",border:"1px solid #fef08a"}}>
            <div style={{fontSize:12,fontWeight:700,color:"#ca8a04",fontFamily:"'Barlow',sans-serif",marginBottom:4}}>HOW TO USE</div>
            <div style={{fontSize:12,color:"#78716c",fontFamily:"'Barlow',sans-serif",lineHeight:1.6}}>Find your 1RM for each lift, multiply by the % shown for your current week. Don't know your 1RM? Use a 5-rep max × 1.15 as an estimate. PAP lifts always use 85–95% regardless of phase.</div>
          </div>
          <div style={{...S.card,padding:0,overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"36px 90px 54px 72px 1fr 52px",background:"#f4f4f5",padding:"8px 12px",gap:6}}>
              {["WK","PHASE","%1RM","SETS","TEMPO","PLYO"].map(h=>(
                <div key={h} style={{fontSize:9,fontWeight:700,color:"#71717a",fontFamily:"'Barlow',sans-serif",letterSpacing:1,textTransform:"uppercase"}}>{h}</div>
              ))}
            </div>
            {INTENSITY_TABLE.map((row,i)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"36px 90px 54px 72px 1fr 52px",padding:"10px 12px",gap:6,borderTop:"1px solid #f4f4f5",background:row.week===programWeek?"#fffbeb":i%2===0?"#ffffff":"#fafafa",alignItems:"center"}}>
                <div style={{fontSize:14,fontWeight:900,color:row.color,fontFamily:"'Bebas Neue',sans-serif"}}>{row.week}</div>
                <div style={{fontSize:10,fontWeight:700,color:row.color,fontFamily:"'Barlow',sans-serif"}}>{row.phase}</div>
                <div style={{fontSize:14,fontWeight:900,color:"#18181b",fontFamily:"'Barlow',sans-serif"}}>{row.pct}</div>
                <div style={{fontSize:10,color:"#52525b",fontFamily:"'Barlow',sans-serif"}}>{row.reps}</div>
                <div style={{fontSize:9,color:"#71717a",fontFamily:"'Barlow',sans-serif",lineHeight:1.4}}>{row.tempo}</div>
                <div style={{fontSize:10,fontWeight:700,color:row.phase==="Deload"?"#7c3aed":"#16a34a",fontFamily:"'Barlow',sans-serif"}}>{row.plyoPct}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── AI ADVICE VIEW ── */}
      {view==="advice"&&(
        <div>
          <div style={{...S.card,marginBottom:12}}>
            <div style={{fontSize:13,color:"#52525b",fontFamily:"'Barlow',sans-serif",lineHeight:1.7,marginBottom:12}}>
              AI advisor analyzes your schedule, recent sessions, check-ins, and program week to give you specific advice on what to do today and flag any recovery issues.
            </div>
            <button onClick={getAIAdvice} style={{...S.btn("#18181b","#ca8a04"),width:"100%",borderRadius:10,fontSize:15}} disabled={adviceLoading}>
              {adviceLoading?"ANALYZING...":"GET SCHEDULING ADVICE →"}
            </button>
          </div>
          {advice&&(
            <div style={{...S.card,background:"#fffbeb",border:"1px solid #fef08a"}}>
              <div style={{fontSize:12,fontWeight:700,color:"#ca8a04",fontFamily:"'Barlow',sans-serif",marginBottom:8}}>🧠 AI COACH</div>
              <div style={{fontSize:13,color:"#18181b",fontFamily:"'Barlow',sans-serif",lineHeight:1.8,whiteSpace:"pre-wrap"}}>{advice}</div>
            </div>
          )}
          {/* Upcoming week preview */}
          <div style={{...S.card,marginTop:12}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,letterSpacing:1,marginBottom:10}}>NEXT 7 DAYS</div>
            {weekDays.map(d=>{
              const session=schedule[d];
              const meta=session?SESSION_TYPES[session]:null;
              const isToday=d===todayStr;
              const workoutLogged=workouts.some(w=>w.date===d)||bbLog.some(b=>b.date===d);
              const hasConflict=conflicts.some(c=>c.date===d);
              return(
                <div key={d} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #f4f4f5"}}>
                  <div style={{minWidth:48,fontSize:11,fontFamily:"'Barlow',sans-serif",fontWeight:700,color:isToday?"#ca8a04":"#71717a"}}>{isToday?"TODAY":new Date(d+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"numeric",day:"numeric"})}</div>
                  {meta?(
                    <div style={{flex:1,display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:14}}>{meta.icon}</span>
                      <div>
                        <div style={{fontSize:12,fontWeight:700,fontFamily:"'Barlow',sans-serif",color:meta.color}}>{session}</div>
                        <div style={{fontSize:9,color:"#71717a",fontFamily:"'Barlow',sans-serif"}}>{meta.tag}</div>
                      </div>
                    </div>
                  ):(
                    <div style={{flex:1,fontSize:12,color:"#a1a1aa",fontFamily:"'Barlow',sans-serif",fontStyle:"italic"}}>Not scheduled — tap Schedule to add</div>
                  )}
                  <div style={{display:"flex",gap:4,alignItems:"center"}}>
                    {workoutLogged&&<span style={{fontSize:10,color:"#16a34a",fontFamily:"'Barlow',sans-serif",fontWeight:700}}>✓</span>}
                    {hasConflict&&<span style={{fontSize:10,color:"#dc2626"}}>⚠</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function BottomNav({tab,setTab}){
  const [open,setOpen]=useState(false);
  const PRIMARY=[{id:"DASHBOARD",icon:"⚡",label:"HOME"},{id:"PROGRAM",icon:"📅",label:"PROGRAM"},{id:"COACH",icon:"🧠",label:"COACH"},{id:"LOG",icon:"✏️",label:"LOG"},{id:"BALL",icon:"🏀",label:"BALL"}];
  const MENU_SECTIONS=[
    {title:"Track",items:[{id:"CHECKIN",icon:"🌅",label:"Check-in"},{id:"BODY",icon:"⚖️",label:"Body"},{id:"PRS",icon:"🏆",label:"PRs"}]},
    {title:"Logs",items:[{id:"MONTHLY",icon:"📅",label:"Monthly"},{id:"GOALS",icon:"🎯",label:"Goals"},{id:"INJURY",icon:"🩹",label:"Health"}]},
    {title:"Tools",items:[{id:"MORE",icon:"⚙️",label:"More"}]},
  ];
  return(<>
    {open&&(
      <div style={{position:"fixed",inset:0,background:"#080808ee",zIndex:98,backdropFilter:"blur(4px)"}} onClick={()=>setOpen(false)}>
        <div style={{position:"absolute",bottom:64,left:0,right:0,padding:"20px 16px"}} onClick={e=>e.stopPropagation()}>
          {MENU_SECTIONS.map(sec=>(
            <div key={sec.title} style={{marginBottom:20}}>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:13,color:"#3f3f46",letterSpacing:2,marginBottom:8}}>{sec.title}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                {sec.items.map(t=>(
                  <button key={t.id} onClick={()=>{setTab(t.id);setOpen(false);}}
                    style={{background:tab===t.id?"#ca8a0422":"#fff",color:tab===t.id?"#ca8a04":"#6b7280",border:`1px solid ${tab===t.id?"#ca8a0444":"#e4e4e7"}`,borderRadius:12,padding:"14px 10px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                    <span style={{fontSize:20}}>{t.icon}</span>
                    <span style={{fontFamily:"'Barlow',sans-serif",fontWeight:700,fontSize:11}}>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
    <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#ffffff",borderTop:"1px solid #e4e4e7",boxShadow:"0 -1px 3px rgba(0,0,0,0.06)",zIndex:100}}>
      <div style={{maxWidth:600,margin:"0 auto",display:"flex"}}>
        {PRIMARY.map(t=>{const active=tab===t.id;return(
          <button key={t.id} onClick={()=>{setTab(t.id);setOpen(false);}}
            style={{flex:1,padding:"8px 2px 10px",border:"none",background:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,borderTop:active?"2px solid #18181b":"2px solid transparent"}}>
            <span style={{fontSize:16}}>{t.icon}</span>
            <span style={{fontSize:7,fontFamily:"'Barlow',sans-serif",fontWeight:700,color:active?"#ca8a04":"#d4d4d8"}}>{t.label}</span>
          </button>
        );})}
        <button onClick={()=>setOpen(o=>!o)}
          style={{flex:1,padding:"8px 2px 10px",border:"none",background:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,borderTop:open?"2px solid #18181b":"2px solid transparent"}}>
          <span style={{fontSize:16}}>{open?"✕":"☰"}</span>
          <span style={{fontSize:7,fontFamily:"'Barlow',sans-serif",fontWeight:700,color:open?"#ca8a04":"#d4d4d8"}}>MENU</span>
        </button>
      </div>
    </div>
  </>);
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App(){
  const [tab,setTab]=useState("DASHBOARD");
  const [workouts,setWorkouts]=useState([]);
  const [goals,setGoals]=useState(DEFAULT_GOALS);
  const [cardioLog,setCardioLog]=useState([]);
  const [bbLog,setBbLog]=useState([]);
  const [checkIns,setCheckIns]=useState([]);
  const [bodyLog,setBodyLog]=useState([]);
  const [prs,setPrs]=useState([]);
  const [injuries,setInjuries]=useState([]);
  const [programs,setPrograms]=useState([]);
  const [schedule,setSchedule]=useState(()=>{try{return JSON.parse(localStorage.getItem("apex_schedule")||"{}");}catch{return{};}});
  const [loaded,setLoaded]=useState(false);
  const [sync,setSync]=useState("loading");

  // ── Lifted state: persists across tab switches ──
  const [activeWorkout,setActiveWorkout]=useState({name:"",rows:[{exercise:"",sets:"3",note:"",category:"",trackingType:"reps",classifying:false,block:"",supersetWith:null,supersetLabel:"",setData:[],restSecs:90}],sessionStart:null,sessionActive:false});
  const [coachState,setCoachState]=useState({chat:[],advice:null,time:"45",suggestions:[],sugLoaded:false,chatInput:"",customQ:""});

  useEffect(()=>{(async()=>{
    const keys=["workouts","goals","cardio","bball","checkins","body_log","prs","injuries","programs"];
    const data=await Promise.all(keys.map(t=>loadCollection(t)));
    if(data[0]?.length)setWorkouts(data[0]);if(data[1]?.length)setGoals(data[1]);if(data[2]?.length)setCardioLog(data[2]);
    if(data[3]?.length)setBbLog(data[3]);if(data[4]?.length)setCheckIns(data[4]);if(data[5]?.length)setBodyLog(data[5]);
    if(data[6]?.length)setPrs(data[6]);if(data[7]?.length)setInjuries(data[7]);if(data[8]?.length)setPrograms(data[8]);
    // Load persisted coach chat history
    try{const saved=localStorage.getItem("apex_coach_chat");if(saved){const parsed=JSON.parse(saved);setCoachState(s=>({...s,chat:parsed}));}}catch{}
    const s=await checkSupabaseStatus();
    setSync(s.connected?"synced":s.reason==="not_configured"?"local":"offline");
    setLoaded(true);
  })();},[]);

  // Save coach chat to localStorage for all-time persistence
  useEffect(()=>{
    if(!loaded)return;
    try{localStorage.setItem("apex_coach_chat",JSON.stringify(coachState.chat.slice(-100)));}catch{}
  },[coachState.chat,loaded]);

  // Persist schedule
  useEffect(()=>{
    try{localStorage.setItem("apex_schedule",JSON.stringify(schedule));}catch{}
  },[schedule]);

  useEffect(()=>{
    if(!loaded)return;
    setSync("syncing");
    const t=setTimeout(async()=>{
      await Promise.all([saveCollection("workouts",workouts),saveCollection("goals",goals),saveCollection("cardio",cardioLog),saveCollection("bball",bbLog),saveCollection("checkins",checkIns),saveCollection("body_log",bodyLog),saveCollection("prs",prs),saveCollection("injuries",injuries),saveCollection("programs",programs)]);
      const s=await checkSupabaseStatus();
      setSync(s.connected?"synced":s.reason==="not_configured"?"local":"offline");
    },800);
    return()=>clearTimeout(t);
  },[workouts,goals,cardioLog,bbLog,checkIns,bodyLog,prs,injuries,programs,loaded]);

  const sd={synced:{c:"#16a34a",l:"☁️"},syncing:{c:"#ca8a04",l:"↑"},offline:{c:"#f97316",l:"📴"},local:{c:"#71717a",l:"💾"},loading:{c:"#71717a",l:"..."}}[sync]||{c:"#71717a",l:""};

  function renderTab(){
    switch(tab){
      case "MONTHLY": return <MonthlyLog workouts={workouts} bbLog={bbLog} cardioLog={cardioLog} checkIns={checkIns}/>;
      case "DASHBOARD": return <Dashboard workouts={workouts} goals={goals} cardioLog={cardioLog} bbLog={bbLog} checkIns={checkIns} bodyLog={bodyLog} prs={prs} setTab={setTab}/>;
      case "PROGRAM": return <ProgramTab schedule={schedule} onScheduleChange={setSchedule} workouts={workouts} bbLog={bbLog} checkIns={checkIns}/>;
      case "COACH": return <CoachTab workouts={workouts} cardioLog={cardioLog} bbLog={bbLog} goals={goals} checkIns={checkIns} injuries={injuries} prs={prs} coachState={coachState} setCoachState={setCoachState} setActiveWorkout={setActiveWorkout} setTab={setTab}/>;
      case "LOG": return <LogTab workouts={workouts} onSave={w=>setWorkouts(p=>[...p,w])} onDelete={id=>setWorkouts(p=>p.filter(w=>w.id!==id))} goals={goals} checkIns={checkIns} activeWorkout={activeWorkout} setActiveWorkout={setActiveWorkout} setTab={setTab}/>;
      case "CHECKIN": return <CheckInTab checkIns={checkIns} onSave={ci=>setCheckIns(p=>[...p.filter(c=>c.date!==ci.date),ci])}/>;
      case "BODY": return <BodyTab bodyLog={bodyLog} onSave={e=>setBodyLog(p=>[...p,e])} goals={goals} onUpdateGoal={(id,val)=>setGoals(p=>p.map(g=>g.id===id?{...g,current:val}:g))}/>;
      case "PRS": return <PRTab prs={prs} onSave={pr=>setPrs(p=>[...p,pr])} onDelete={id=>setPrs(p=>p.filter(pr=>pr.id!==id))}/>;
      case "BALL": return <BallTab bbLog={bbLog} onSave={e=>setBbLog(p=>[...p,e])}/>;
      case "GOALS": return <GoalsTab goals={goals} onUpdate={(id,val)=>setGoals(p=>p.map(g=>g.id===id?{...g,current:val}:g))} onAdd={g=>setGoals(p=>[...p,g])} onDelete={id=>setGoals(p=>p.filter(g=>g.id!==id))}/>;
      case "INJURY": return <InjuryTab injuries={injuries} onSave={i=>setInjuries(p=>[...p,i])} onDelete={id=>setInjuries(p=>p.filter(i=>i.id!==id))}/>;
      case "MORE": return <MoreTab workouts={workouts} cardioLog={cardioLog} bbLog={bbLog} prs={prs} bodyLog={bodyLog} checkIns={checkIns} injuries={injuries} setTab={setTab}/>;
      default: return null;
    }
  }

  if(!loaded)return(
    <div style={{minHeight:"100vh",background:"#f4f4f5",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:32,letterSpacing:3}}><span style={{color:"#ca8a04"}}>APEX</span><span style={{color:"#18181b"}}>TRACK</span></div>
      <div style={{display:"flex",gap:6}}>{[0,1,2].map(i=><div key={i} style={{width:8,height:8,borderRadius:"50%",background:"#ca8a04",opacity:.3,animation:`pulse 1.2s ${i*.4}s infinite`}}/>)}</div>
      <style>{`@keyframes pulse{0%,100%{opacity:.2}50%{opacity:1}}`}</style>
    </div>
  );

  return(
    <div style={{minHeight:"100vh",background:"#f4f4f5",color:"#18181b"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@300;400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
        ::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-thumb{background:#E8FF00;}
        input,select,textarea{color-scheme:dark;font-size:16px!important;-webkit-appearance:none;}
        input:focus,select:focus{border-color:#E8FF00!important;outline:none;}
        button{transition:opacity .15s;touch-action:manipulation;-webkit-tap-highlight-color:transparent;}button:hover{opacity:.85;}
        html,body{overscroll-behavior:none;}
        @keyframes pulse{0%,100%{opacity:.2}50%{opacity:1}}
        @keyframes spin{from{transform:translateY(-50%) rotate(0deg)}to{transform:translateY(-50%) rotate(360deg)}}
      `}</style>
      {/* Header */}
      <div style={{background:"#ffffff",borderBottom:"1px solid #e4e4e7",boxShadow:"0 1px 3px rgba(0,0,0,0.06)",padding:"0 16px",position:"sticky",top:0,zIndex:99}}>
        <div style={{maxWidth:600,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:46}}>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:21,letterSpacing:2}}><span style={{color:"#ca8a04"}}>APEX</span><span style={{color:"#18181b"}}>TRACK</span><span style={{fontSize:10,color:"#3f3f46",marginLeft:6,fontFamily:"'Barlow',sans-serif",fontWeight:700}}>v7</span></div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {activeWorkout.sessionActive&&<WorkoutTimer startTime={activeWorkout.sessionStart}/>}
            <span style={{fontSize:13,color:sd.c}}>{sd.l}</span>
          </div>
        </div>
      </div>
      <div style={{maxWidth:600,margin:"0 auto",padding:"14px 14px 96px"}}>{renderTab()}</div>
      <BottomNav tab={tab} setTab={setTab}/>
    </div>
  );
}
