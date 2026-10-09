import type { Metadata } from 'next';
import {headers} from 'next/headers';
import './globals.css';
export const metadata:Metadata={title:'Ordenia · Un mensaje, todo en orden',description:'Tu espacio para capturar ideas, organizar tareas y liberar tu mente.'};
// Render dinámico: el nonce de la CSP es distinto en cada petición y Next debe inyectarlo en sus scripts.
export default async function Layout({children}:{children:React.ReactNode}){await headers();return <html lang="es"><body>{children}</body></html>}
