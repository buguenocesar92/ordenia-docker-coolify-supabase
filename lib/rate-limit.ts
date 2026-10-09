// Límite de tasa en MEMORIA POR PROCESO (ventana fija). No se comparte entre réplicas ni sobrevive
// a reinicios: con N réplicas el límite efectivo es N veces mayor. Si se escala a varias réplicas,
// moverlo a Redis o a la base. Sin imports para poder probarlo con node:test.
export type LimitConfig={max:number;windowMs:number};
export function createLimiter(o:{max:number;windowMs:number;now?:()=>number;maxKeys?:number}){
 const now=o.now||Date.now,maxKeys=o.maxKeys||10000;const hits=new Map<string,{count:number;reset:number}>();
 function purge(t:number){for(const [k,v] of hits)if(v.reset<=t)hits.delete(k);}
 return {
  check(key:string):{ok:boolean;retryAfter:number}{
   const t=now();let e=hits.get(key);
   if(!e||e.reset<=t){if(hits.size>=maxKeys)purge(t);if(hits.size>=maxKeys)hits.delete(hits.keys().next().value as string);e={count:0,reset:t+o.windowMs};hits.set(key,e);}
   e.count++;
   return e.count>o.max?{ok:false,retryAfter:Math.max(1,Math.ceil((e.reset-t)/1000))}:{ok:true,retryAfter:0};
  },
  size:()=>hits.size,
 };
}
// Detrás del proxy de Coolify/Traefik, la ÚLTIMA entrada de X-Forwarded-For es la que añadió el proxy;
// las anteriores las puede falsear el cliente.
export function clientIp(h:Headers){const xff=(h.get('x-forwarded-for')||'').split(',').map(s=>s.trim()).filter(Boolean);return xff[xff.length-1]||'desconocida';}
export function tooManyRequests(retryAfter:number){return Response.json({error:'Demasiadas solicitudes. Intenta de nuevo más tarde.'},{status:429,headers:{'Retry-After':String(retryAfter)}});}
export function readLimitEnv(env:Record<string,string|undefined>,prefix:string,defMax:number,defWindowSeconds:number):LimitConfig{
 const n=(v:string|undefined,d:number)=>{const x=Number(v);return v&&Number.isFinite(x)&&x>0?Math.floor(x):d;};
 return {max:n(env[prefix+'_MAX'],defMax),windowMs:n(env[prefix+'_WINDOW_SECONDS'],defWindowSeconds)*1000};
}
