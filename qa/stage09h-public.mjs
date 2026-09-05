/**
 * Stage 09H public verification.
 *
 * Runs against the DEPLOYED site, not loopback. A build that is correct on
 * 127.0.0.1 and wrong in production is the only kind of wrong that reaches
 * anybody, and the Work section in particular depends on twenty-two image
 * assets that a release could ship without.
 *
 * It re-asserts, over HTTPS, the things this stage claimed:
 *
 *   the screens are the real Operations captures, and every one of them loads
 *   the transition is a reveal, so no frame is ever half painted
 *   all eleven module labels are actually reached
 *   the pointer field moves with the pointer
 *   both spectral edges are animating
 *   nothing overflows horizontally at any scroll position
 *   no certification renders, and the bands under the frame stay removed
 *   the action still points at /demos/operations
 *   390px and reduced motion behave
 *
 *   QA_BASE=https://intelligent-systems-lab.duckdns.org node qa/stage09h-public.mjs
 */

import { chromium } from "playwright";

const B = process.env.QA_BASE ?? "https://intelligent-systems-lab.duckdns.org";
const b = await chromium.launch();
const settle = async (p,n=8)=>{for(let i=0;i<n;i++){await p.waitForTimeout(90);await p.screenshot();}};
let fails = 0;
const ck = (l, ok, d="") => { if(!ok) fails++; console.log(`  ${ok?"PASS":"FAIL"}  ${l.padEnd(52)}${d}`); };

const c = await b.newContext({viewport:{width:1440,height:900}});
const p = await c.newPage();
await p.goto(B+"/", {waitUntil:"load"});
await settle(p);

const s = await p.evaluate(() => ({
  shots: [...document.querySelectorAll(".screens__shot")].map(i=>i.currentSrc||i.src).filter(Boolean),
  broken: [...document.querySelectorAll(".screens__shot")].filter(i=>i.complete&&i.naturalWidth===0).length,
  items: document.querySelectorAll(".screens__item").length,
  cta: (()=>{const a=document.querySelector(".featured__cta");return a?{href:a.getAttribute("href"),label:a.textContent.trim()}:null;})(),
  certs: document.querySelectorAll(".certifications, .cert-card, [class*='cert']").length,
  bands: document.querySelectorAll(".featured__fact, .featured__module, .featured__note, .featured__breadth").length,
  spectral: [...document.querySelectorAll(".spectral")].map(e=>({
    anim:getComputedStyle(e).animationName, dur:getComputedStyle(e).animationDuration, pad:getComputedStyle(e).padding })),
  fields: document.querySelectorAll(".scene__field").length,
  scenes: [...document.querySelectorAll("[data-scene]")].map(e=>e.dataset.scene),
}));
ck("work renders real Operations captures", s.shots.length>0 && s.shots.every(u=>/\/operations\/(desktop|mobile)\//.test(u) || /_next\/image/.test(u)), s.shots[0]?.slice(-70));
ck("no screenshot failed to load", s.broken===0, String(s.broken));
ck("eleven screens in the DOM", s.items===11, String(s.items));
ck("CTA href is /demos/operations", s.cta?.href==="/demos/operations", String(s.cta?.href));
console.log(`         CTA label: "${s.cta?.label}"`);
ck("no certification renders", s.certs===0, String(s.certs));
ck("bands beneath the screen stay removed", s.bands===0, String(s.bands));
ck("two spectral edges, animating", s.spectral.length===2 && s.spectral.every(x=>x.anim!=="none"), JSON.stringify(s.spectral.map(x=>x.anim+" "+x.dur+" "+x.pad)));
ck("six scenes", s.scenes.length===6, s.scenes.join(","));

// horizontal overflow across the whole document
const h = await p.evaluate(()=>document.documentElement.scrollHeight);
let worst=-1e9;
for(let i=0;i<=24;i++){ await p.evaluate(y=>scrollTo(0,y), Math.round(h*i/24)); await settle(p,2);
  worst=Math.max(worst, await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)); }
ck("no horizontal overflow anywhere", worst<=0, `${worst}px`);

// pointer field responds
await p.evaluate(()=>scrollTo(0,0)); await settle(p);
await p.mouse.move(120,700); await settle(p,14);
const left = await p.evaluate(()=>document.querySelector("[data-scene='hero']").style.getPropertyValue("--pointer-x"));
await p.mouse.move(1330,180); await settle(p,14);
const right = await p.evaluate(()=>document.querySelector("[data-scene='hero']").style.getPropertyValue("--pointer-x"));
ck("pointer field moves with the pointer", Math.abs(Number(right)-Number(left))>0.5, `${left} -> ${right}`);

// no half painted screens anywhere in the sequence
const g = await p.evaluate(()=>{const r=document.querySelector(".screens"),st=document.querySelector(".screens__stage");
  return {top:Math.round(r.getBoundingClientRect().top+scrollY),h:r.offsetHeight,s:st.offsetHeight};});
/*
  The walk starts BEFORE the range, not at its top edge.

  Starting at `g.top` looks right and misses Overview every time: the stage does
  not begin pinning until the range top reaches the sticky offset, so by the
  time the page is scrolled to `g.top` the sequence is already a few per cent in
  and has begun advancing to Leads. The first screen was reported missing on a
  sequence that renders it correctly.

  Two hundred pixels earlier puts the first sample at a genuine progress of
  zero, which is what "the sequence reaches all eleven" is supposed to test.
*/
const START = g.top - 200;
const SPAN = (g.h - g.s) + 400;
let half=0, labels=new Set();
for(let i=0;i<=60;i++){ await p.evaluate(y=>scrollTo(0,y), Math.max(0, Math.round(START+SPAN*i/60))); await settle(p,4);
  const r = await p.evaluate(()=>({
    half:[...document.querySelectorAll(".screens__item")].filter(e=>{const o=Number(getComputedStyle(e).opacity);return o>0.01&&o<0.99;}).length,
    label:document.querySelector(".screens__module")?.textContent}));
  half+=r.half; if(r.label) labels.add(r.label); }
ck("no half-painted crossfade state exists", half===0, String(half));
ck("all eleven labels seen on production", labels.size===11,
  `${labels.size}/11 seen: ${[...labels].join(",")}`);
await c.close();

// mobile 390
const mc = await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
const mp = await mc.newPage(); await mp.goto(B+"/",{waitUntil:"load"}); await settle(mp);
const m = await mp.evaluate(()=>({
  over:document.documentElement.scrollWidth-document.documentElement.clientWidth,
  enhanced:document.querySelectorAll(".screens--enhanced").length,
  mob:getComputedStyle(document.querySelector(".screens__shot--mobile")).display,
  desk:getComputedStyle(document.querySelector(".screens__shot--desktop")).display}));
ck("390px: no horizontal overflow", m.over<=0, `${m.over}px`);
ck("390px: sticky sequence stands down", m.enhanced===0, String(m.enhanced));
ck("390px: real mobile capture shown", m.mob==="block"&&m.desk==="none", `${m.mob}/${m.desk}`);
await mc.close();

// reduced motion
const rc = await b.newContext({viewport:{width:1440,height:900},reducedMotion:"reduce"});
const rp = await rc.newPage(); await rp.goto(B+"/",{waitUntil:"load"}); await settle(rp);
const r = await rp.evaluate(()=>({
  live:document.querySelectorAll(".scene--live").length,
  enh:document.querySelectorAll(".screens--enhanced").length,
  moved:[...document.querySelectorAll(".scene__content")].filter(e=>getComputedStyle(e).transform!=="none").length,
  spect:[...document.querySelectorAll(".spectral")].filter(e=>getComputedStyle(e).animationName!=="none").length,
  h1:document.querySelector("h1").textContent.trim(),
  firstShot:getComputedStyle(document.querySelector(".screens__item")).visibility}));
ck("reduced motion: nothing enhanced", r.live===0&&r.enh===0, `${r.live}/${r.enh}`);
ck("reduced motion: nothing left transformed", r.moved===0, String(r.moved));
ck("reduced motion: spectral edges stop", r.spect===0, String(r.spect));
ck("reduced motion: H1 exact", r.h1==="Engineering intelligent systems.", r.h1);
ck("reduced motion: first real screen visible", r.firstShot==="visible", r.firstShot);
await rc.close();
await b.close();
console.log(fails? `\n=== ${fails} FAILURE(S) ===` : "\n=== PRODUCTION VISUAL VERIFY: ALL PASS ===");
process.exit(fails?1:0);
