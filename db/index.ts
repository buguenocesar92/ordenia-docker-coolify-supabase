import {drizzle} from 'drizzle-orm/node-postgres';
import {Pool} from 'pg';
import {sql} from 'drizzle-orm';
import * as schema from './schema';
const globalDb=globalThis as unknown as {ordeniaPool?:Pool};
export function getPool(){if(!process.env.DATABASE_URL)throw Error('DATABASE_URL required');return globalDb.ordeniaPool??=new Pool({connectionString:process.env.DATABASE_URL,max:10,ssl:process.env.DATABASE_SSL==='true'?{rejectUnauthorized:true}:undefined});}
export function getDb(){return drizzle(getPool(),{schema});}
export type Db=ReturnType<typeof getDb>;
// El aislamiento entre usuarios baja a la base de datos: dentro de la transaccion se fija
// app.user_id y las politicas de 002_ordenia_rls.sql filtran por el. Sin app.user_id,
// current_setting devuelve NULL, la comparacion no es cierta y las politicas NIEGAN (fallan cerrado).
// No anidar withUser: cada llamada abre su transaccion y toma su propio cliente del pool.
export async function withUser<T>(userId:string,fn:(db:Db)=>Promise<T>):Promise<T>{
 return getDb().transaction(async tx=>{
  await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
  return fn(tx as unknown as Db);
 });
}
