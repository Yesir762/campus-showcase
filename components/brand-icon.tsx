import Image from 'next/image';

export function BrandIcon({className}:{className?:string}) {
 return <Image src="/brand/yunman-cloud-sail-192.png" alt="" aria-hidden="true" width={64} height={64} unoptimized className={className}/>;
}
