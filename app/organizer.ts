const env=process.env;
import {folderResolver} from './folders';
import {withUser} from '../db';
import {rules} from '../db/schema';
import {eq} from 'drizzle-orm';
import {classify,sensitive,folder,type Rule,type Draft} from './classify';
export async function organize(userId:string,text:string){
 if(sensitive(text))return {sensitive:true,engine:'secure',drafts:[] as Draft[]};
 const rs=await withUser(userId,async db=>await db.select().from(rules).where(eq(rules.userId,userId)));
 const resolveFolder=await folderResolver(userId);const fallback=classify(text,new Date(),rs as Rule[]).map(x=>({...x,category:resolveFolder(x.category||'')}));
 if(!env.N8N_CLASSIFY_URL||!env.N8N_CLASSIFY_TOKEN)return {sensitive:false,engine:'rules',drafts:fallback};
 try{const r=await fetch(env.N8N_CLASSIFY_URL,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.N8N_CLASSIFY_TOKEN},body:JSON.stringify({text,now:new Date().toISOString(),timezone:'America/Santiago',rules:rs.map(({keyword,category,kind})=>({keyword,category,kind})),schema:{items:[{kind:'event|task|shop|note',title:'string',category:'Tema / Subtema',date:'YYYY-MM-DD o vacío',time:'HH:mm o vacío',recurrence:'string o vacío'}]}}),signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error();const b:any=await r.json();if(!Array.isArray(b.items)||!b.items.length||b.items.length>30)throw Error();const drafts:Draft[]=b.items.map((x:any)=>{if(!['event','task','shop','note'].includes(x.kind)||typeof x.title!=='string'||!x.title.trim()||sensitive(x.title))throw Error();return {kind:x.kind,title:x.title.slice(0,1000),original:text,category:resolveFolder(String(x.category||'')),date:/^\d{4}-\d{2}-\d{2}$/.test(x.date||'')?x.date:'',time:/^\d{2}:\d{2}$/.test(x.time||'')?x.time:'',recurrence:String(x.recurrence||'').slice(0,60)}});return {sensitive:false,engine:'n8n-ai',drafts};}catch{return {sensitive:false,engine:'rules-fallback',drafts:fallback}}
}
