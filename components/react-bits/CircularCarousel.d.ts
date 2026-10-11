import type {CSSProperties} from 'react';
export type CarouselItem = {src:string;alt?:string;title?:string;subtitle?:string};
type CircularCarouselProps = {
 items?:CarouselItem[];
 preset?:'cylinder'|'orbit'|'wheel'|'panorama';
 intro?:'assemble'|'rise'|'spin'|'none';
 cardWidth?:number;aspectRatio?:number;gap?:number;curve?:number;tilt?:number;perspective?:number;
 autoplay?:'drift'|'step'|'off';speed?:number;interval?:number;direction?:'left'|'right';
 draggable?:boolean;momentum?:number;snap?:boolean;pauseOnHover?:boolean;focusOnClick?:boolean;
 parallax?:number;stretch?:number;depthFade?:number;fadeColor?:string;innerShade?:number;cornerRadius?:number;captions?:boolean;
 onChange?:(index:number)=>void;onItemClick?:(item:CarouselItem,index:number)=>void;
 selection?:{index:number;nonce:number};ariaLabel?:string;className?:string;style?:CSSProperties;
};
export default function CircularCarousel(props:CircularCarouselProps): import('react').ReactElement;
