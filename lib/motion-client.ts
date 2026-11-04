// GSAP starts a ticker at module evaluation. Cloudflare prohibits global timers,
// so load it only from mounted browser effects, never during server rendering.
type MotionRuntime={gsap:typeof import('gsap').default;ScrollTrigger:typeof import('gsap/ScrollTrigger').ScrollTrigger};
let runtime:Promise<MotionRuntime>|undefined;
export function loadMotion():Promise<MotionRuntime>{
 if(typeof window==='undefined')return Promise.reject(new Error('Motion is available only in the browser'));
 return runtime??=Promise.all([import('gsap'),import('gsap/ScrollTrigger')]).then(([core,scroll])=>{core.default.registerPlugin(scroll.ScrollTrigger);return {gsap:core.default,ScrollTrigger:scroll.ScrollTrigger};});
}
