import {getUser} from '../../auth';
import {getDb} from '../../../db';
import {rules} from '../../../db/schema';
import {and,eq} from 'drizzle-orm';
export async function GET(){const u=await getUser();if(!u)return Response.json({error:'Inicia sesión'},{status:401});return Response.json(await getDb().select().from(rules).where(eq(rules.userId,u.userId)))}
export async function DELETE(req:Request){const u=await getUser();if(!u)return Response.json({error:'Inicia sesión'},{status:401});const id=new URL(req.url).searchParams.get('id');if(!id)return Response.json({error:'Falta id'},{status:400});await getDb().delete(rules).where(and(eq(rules.userId,u.userId),eq(rules.id,id)));return Response.json({ok:true})}
