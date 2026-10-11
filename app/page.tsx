import {CampusHome} from '@/components/campus-home';
import {sceneCatalog,siteConfig} from '@/lib/campus-config';
export default function Home(){return <CampusHome site={siteConfig} scenes={sceneCatalog}/>;}
