export type PixelCell={x:number;y:number;width:number;height:number;delay:number};
export function pixelGrid(width:number,height:number,origin:{x:number;y:number},mobile:boolean):PixelCell[]{
 let size=mobile?32:48;
 while(Math.ceil(width/size)*Math.ceil(height/size)>768)size*=1.05;
 const maxDistance=Math.max(...[{x:0,y:0},{x:width,y:0},{x:0,y:height},{x:width,y:height}].map(p=>Math.hypot(p.x-origin.x,p.y-origin.y)),1);
 const cells:PixelCell[]=[];
 for(let row=0;row<Math.ceil(height/size);row++)for(let col=0;col<Math.ceil(width/size);col++){
  const x=col*size,y=row*size,w=Math.min(size,width-x),h=Math.min(size,height-y);
  const seed=((col*73856093)^(row*19349663))>>>0;
  cells.push({x,y,width:w,height:h,delay:.06+.42*Math.hypot(x+w/2-origin.x,y+h/2-origin.y)/maxDistance+.055*(seed%1000)/1000});
 }
 return cells;
}
export function pixelRect(cell:PixelCell,progress:number){
 const p=Math.min(1,Math.max(0,(progress-cell.delay)/.4));
 const remaining=1-p*p*(3-2*p);
 const width=(cell.width+1)*remaining,height=(cell.height+1)*remaining;
 return {x:cell.x+(cell.width-width)/2,y:cell.y+(cell.height-height)/2,width,height,opacity:remaining};
}
