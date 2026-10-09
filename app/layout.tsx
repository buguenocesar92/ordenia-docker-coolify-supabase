import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Ordenia · Un mensaje, todo en orden',description:'Tu espacio para capturar ideas, organizar tareas y liberar tu mente.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="es"><body>{children}</body></html>}
