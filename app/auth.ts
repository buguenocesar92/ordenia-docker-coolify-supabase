import {supabase} from '../lib/supabase/server';
import {redirect} from 'next/navigation';
export async function getUser(){const client=await supabase();const {data:{user},error}=await client.auth.getUser();if(error||!user||!user.email)return null;return {userId:user.id,email:user.email,fullName:typeof user.user_metadata?.full_name==='string'?user.user_metadata.full_name:null};}
export async function requireUser(_returnTo:string){const u=await getUser();if(!u)redirect('/login');return u;}
