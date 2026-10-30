// Logs estructurados: una linea JSON por evento, para que Uptime Kuma, Dozzle o un
// agregador puedan leerlos sin parsear texto libre. Nunca se registran valores de secretos:
// solo nombres, rutas, codigos y hashes. Sin imports para poder probarla con node:test.
export type LogLevel='info'|'warn'|'error';
export type LogFields={requestId?:string;method?:string;path?:string;status?:number;ms?:number;[k:string]:unknown};
export function newRequestId():string{return crypto.randomUUID();}
export function logLine(level:LogLevel,msg:string,fields:LogFields={}):string{
 return JSON.stringify({ts:new Date().toISOString(),level,msg,...fields});
}
export const log={
 info:(msg:string,fields?:LogFields)=>console.log(logLine('info',msg,fields)),
 warn:(msg:string,fields?:LogFields)=>console.warn(logLine('warn',msg,fields)),
 error:(msg:string,fields?:LogFields)=>console.error(logLine('error',msg,fields)),
};
