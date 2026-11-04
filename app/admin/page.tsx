import {AdminApp} from '@/components/admin/admin-app';
import './admin.css';
export const dynamic='force-dynamic';
export const metadata={title:'云漫武理 · 展示管理',robots:{index:false,follow:false}};
export default function AdminPage(){return <AdminApp/>;}
