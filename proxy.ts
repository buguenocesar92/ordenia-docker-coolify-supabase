import {NextResponse,type NextRequest} from 'next/server';
import {createServerClient} from '@supabase/ssr';
export async function proxy(request:NextRequest){
 if(['POST','PATCH','DELETE','PUT'].includes(request.method)&&request.nextUrl.pathname!=='/api/ingest'){
  const origin=request.headers.get('origin');const allowed=new URL(process.env.APP_URL||request.url).origin;
  if(!origin||origin!==allowed)return NextResponse.json({error:'Origen no autorizado'},{status:403});
 }
 let response=NextResponse.next({request});
 const client=createServerClient(process.env.SUPABASE_URL!,process.env.SUPABASE_PUBLISHABLE_KEY!,{cookies:{getAll:()=>request.cookies.getAll(),setAll(values){values.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});values.forEach(({name,value,options})=>response.cookies.set(name,value,options));}}});
 await client.auth.getUser();response.headers.set('Cache-Control','private, no-store');return response;
}
export const config={matcher:['/','/login','/reset-password','/auth/:path*','/api/entries','/api/classify','/api/rules','/api/connections','/api/vault']};
