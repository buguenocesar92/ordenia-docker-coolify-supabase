import {createLimiter,readLimitEnv} from './rate-limit';
// Límites en memoria por proceso (ver lib/rate-limit.ts). Ajustables por entorno:
//  RATE_LIMIT_INGEST_MAX / _WINDOW_SECONDS  (por IP, default 120 / 60 s)
//  RATE_LIMIT_CLASSIFY_MAX / _WINDOW_SECONDS (por usuario, default 20 / 60 s)
//  RATE_LIMIT_LOGIN_MAX / _WINDOW_SECONDS    (por IP y por correo, default 10 / 900 s)
const g=globalThis as unknown as {__ordeniaLimiters?:Record<string,ReturnType<typeof createLimiter>>};
function limiter(name:string,defMax:number,defWindow:number){
 g.__ordeniaLimiters??={};
 return g.__ordeniaLimiters[name]??=createLimiter(readLimitEnv(process.env,'RATE_LIMIT_'+name.toUpperCase(),defMax,defWindow));
}
export const ingestLimiter=()=>limiter('ingest',120,60);
export const classifyLimiter=()=>limiter('classify',20,60);
export const loginLimiter=()=>limiter('login',10,900);
