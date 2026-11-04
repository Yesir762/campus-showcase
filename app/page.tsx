import {CampusHome} from '@/components/campus-home';
import {getPublishedCatalog,getSiteConfig} from '@/lib/published-content';
export const dynamic='force-dynamic';
export default async function Home(){const [sceneCatalog,siteConfig]=await Promise.all([getPublishedCatalog(),getSiteConfig()]);return <CampusHome site={siteConfig} scenes={sceneCatalog}/>;}
