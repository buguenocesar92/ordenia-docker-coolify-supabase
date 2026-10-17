import {drizzle} from 'drizzle-orm/node-postgres';
import {Pool} from 'pg';
import * as schema from './schema';
const globalDb=globalThis as unknown as {ordeniaPool?:Pool};
export function getPool(){if(!process.env.DATABASE_URL)throw Error('DATABASE_URL required');return globalDb.ordeniaPool??=new Pool({connectionString:process.env.DATABASE_URL,max:10,ssl:process.env.DATABASE_SSL==='true'?{rejectUnauthorized:true}:undefined});}
export function getDb(){return drizzle(getPool(),{schema});}
