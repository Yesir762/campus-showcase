export type Point2 = [number, number];
export type Navigation = {
  calibrated: boolean; floorY: number; eyeHeight: number; radius: number; speed: number;
  walkable: Point2[][]; obstacles: Point2[][];
};
export function insidePolygon(p: Point2, polygon: Point2[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
export function edgeDistance(p: Point2, a: Point2, b: Point2): number {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
}
function distanceToBoundary(p: Point2, polygon: Point2[]): number {
  return Math.min(...polygon.map((a, i) => edgeDistance(p, a, polygon[(i + 1) % polygon.length])));
}
export function isWalkable(p: Point2, nav: Navigation): boolean {
  return nav.calibrated && nav.walkable.some(poly => insidePolygon(p, poly) && distanceToBoundary(p, poly) >= nav.radius - 1e-7)
    && !nav.obstacles.some(poly => insidePolygon(p, poly) || distanceToBoundary(p, poly) < nav.radius - 1e-7);
}
// Sampling is bounded by the character radius, preventing a slow frame from crossing a thin wall.
export function moveWithinBounds(start: Point2, delta: Point2, nav: Navigation): Point2 {
  if (!isWalkable(start, nav)) return [...start];
  const steps = Math.max(1, Math.ceil(Math.hypot(...delta) / Math.min(0.05, nav.radius / 4)));
  let position: Point2 = [...start];
  for (let i = 0; i < steps; i++) {
    const next: Point2 = [position[0] + delta[0] / steps, position[1] + delta[1] / steps];
    if (!isWalkable(next, nav)) break;
    position = next;
  }
  return position;
}
export function movementDelta(input: Point2, yaw: number, speed: number, dt: number): Point2 {
  const magnitude = Math.max(1, Math.hypot(...input));
  const x = input[0] / magnitude, z = input[1] / magnitude;
  const distance = speed * Math.min(Math.max(dt, 0), 0.1);
  return [(x * Math.cos(yaw) + z * Math.sin(yaw)) * distance, (z * Math.cos(yaw) - x * Math.sin(yaw)) * distance];
}

export function isSimplePolygon(points:Point2[]):boolean {
 if(points.length<3||new Set(points.map(p=>p.join(','))).size!==points.length)return false;
 const cross=(a:Point2,b:Point2,c:Point2)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const area=points.reduce((n,a,i)=>{const b=points[(i+1)%points.length];return n+a[0]*b[1]-b[0]*a[1];},0);
 if(Math.abs(area)<1e-8)return false;
 const intersects=(a:Point2,b:Point2,c:Point2,d:Point2)=>{
  const ab1=cross(a,b,c),ab2=cross(a,b,d),cd1=cross(c,d,a),cd2=cross(c,d,b);
  if(ab1*ab2<0&&cd1*cd2<0)return true;
  return [[c,a,b,ab1],[d,a,b,ab2],[a,c,d,cd1],[b,c,d,cd2]].some(([p,x,y,v])=>Math.abs(v as number)<1e-9&&edgeDistance(p as Point2,x as Point2,y as Point2)<1e-9);
 };
 for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
  if(j===i+1||(i===0&&j===points.length-1))continue;
  if(intersects(points[i],points[(i+1)%points.length],points[j],points[(j+1)%points.length]))return false;
 }
 return true;
}
