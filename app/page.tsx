import { CampusHome } from "@/components/campus-home";
import { activeScene, sceneBindings, siteConfig } from "@/lib/campus-config";

export default function Home() {
  return <CampusHome site={siteConfig} scene={activeScene} bindings={sceneBindings} />;
}
