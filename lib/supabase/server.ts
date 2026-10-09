import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
export async function supabase(){
 const store=await cookies();
 return createServerClient(process.env.SUPABASE_URL!,process.env.SUPABASE_PUBLISHABLE_KEY!,{
  cookies:{
   getAll:()=>store.getAll(),
   setAll(values){try{values.forEach(({name,value,options})=>store.set(name,value,options));}catch{/* Proxy handles refresh for Server Components. */}}
  }
 });
}
