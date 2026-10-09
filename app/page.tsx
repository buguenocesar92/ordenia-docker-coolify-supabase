import Dashboard from './dashboard';
import { requireUser } from './auth';
import {signout} from './login/actions';
export const dynamic='force-dynamic';
export default async function Page(){const user=await requireUser('/');return <><form action={signout} style={{position:'fixed',right:16,bottom:16,zIndex:10}}><button className='secondary'>Cerrar sesión</button></form><Dashboard name={user.fullName?.split(' ')[0]||user.email.split('@')[0]}/></>}
