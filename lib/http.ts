// Lee el cuerpo JSON sin lanzar: devuelve undefined si está vacío, es inválido o es null/no-objeto.
export async function readJson(req:Request):Promise<any|undefined>{
 try{const b=await req.json();return b&&typeof b==='object'?b:undefined}catch{return undefined}
}
export const badJson=()=>Response.json({error:'Cuerpo JSON inválido'},{status:400});
