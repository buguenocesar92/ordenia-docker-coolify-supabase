import {NextResponse,type NextRequest} from 'next/server';
import {createServerClient} from '@supabase/ssr';
import {buildCsp,isHttps,securityHeaders} from './lib/security-headers';
import {log} from './lib/log';
const SESSION_PATHS=/^\/($|login$|reset-password$|auth(\/|$)|api\/(entries|classify|rules|connections|vault)$)/;
export async function proxy(request:NextRequest){
 // Identidad de la peticion: viaja en x-request-id para poder correlacionar el log con la respuesta.
 // El valor lo elige el cliente, asi que se acota a un formato simple y corto: si no lo cumple,
 // se genera uno propio. Devolverlo sin validar dejaria al cliente escribir en los logs.
 const recibido=request.headers.get('x-request-id')||'';
 const requestId=/^[A-Za-z0-9_-]{1,64}$/.test(recibido)?recibido:crypto.randomUUID();
 const inicio=Date.now();
 const nonce=btoa(crypto.randomUUID());
 const csp=buildCsp(nonce,{isDev:process.env.NODE_ENV==='development',https:isHttps(process.env.APP_URL)});
 const hardening=securityHeaders(process.env.APP_URL);
 const finish=(r:NextResponse)=>{r.headers.set('Content-Security-Policy',csp);r.headers.set('x-request-id',requestId);for(const [k,v] of Object.entries(hardening))r.headers.set(k,v);return r;};
 // Next lee el nonce de la CSP de la petición para ponérselo a sus scripts.
 const next=()=>{const h=new Headers(request.headers);h.set('x-nonce',nonce);h.set('Content-Security-Policy',csp);h.set('x-request-id',requestId);return NextResponse.next({request:{headers:h}});};
 const path=request.nextUrl.pathname;
 if(['POST','PATCH','DELETE','PUT'].includes(request.method)&&path!=='/api/ingest'){
  const origin=request.headers.get('origin');const allowed=new URL(process.env.APP_URL||request.url).origin;
  if(!origin||origin!==allowed){log.warn('origen no autorizado',{requestId,method:request.method,path,status:403});return finish(NextResponse.json({error:'Origen no autorizado'},{status:403}));}
 }
 let response=next();
 if(SESSION_PATHS.test(path)){
  const client=createServerClient(process.env.SUPABASE_URL!,process.env.SUPABASE_PUBLISHABLE_KEY!,{cookies:{getAll:()=>request.cookies.getAll(),setAll(values){values.forEach(({name,value})=>request.cookies.set(name,value));response=next();values.forEach(({name,value,options})=>response.cookies.set(name,value,options));}}});
  await client.auth.getUser();response.headers.set('Cache-Control','private, no-store');
 }
 log.info('request',{requestId,method:request.method,path,status:response.status,ms:Date.now()-inicio});
 return finish(response);
}
export const config={matcher:[{source:'/((?!_next/static|_next/image|favicon.ico).*)',missing:[{type:'header',key:'next-router-prefetch'},{type:'header',key:'purpose',value:'prefetch'}]}]};
