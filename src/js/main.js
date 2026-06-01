import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

console.log('GSAP loaded:', gsap.version);
console.log('ScrollTrigger loaded:', ScrollTrigger.version);
