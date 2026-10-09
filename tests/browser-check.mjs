import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { Game, narrative } from '../src/game.ts'
import { t } from '../src/i18n.ts'
import { nextAction } from './routes.ts'
const artifacts=process.env.EXIT_SEQUENCE_ARTIFACTS??'/tmp/exit-sequence-browser'
await mkdir(artifacts,{recursive:true})
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',headless:true,args:['--no-sandbox']})
const report=[]
try {
 for(const language of ['ja','en']) {
 const context=await browser.newContext({viewport:{width:320,height:640},locale:language,reducedMotion:'reduce',isMobile:true,hasTouch:true})
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.addInitScript(lang=>localStorage.setItem('exit-sequence-language',lang),language)
 await page.route(/\/src\/main\.ts(?:\?.*)?$/,async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+'\nglobalThis.__exitTest = () => structuredClone({state:game.state,history,started,itemMenu:game.itemMenu});'})})
 await page.goto(process.env.EXIT_SEQUENCE_URL??'http://127.0.0.1:5173/exit-sequence/');await page.waitForFunction(()=>!!globalThis.__exitTest)
 const snapshot=()=>page.evaluate(()=>globalThis.__exitTest())
 async function layout(){const bounds=await page.evaluate(()=>({width:document.documentElement.scrollWidth,buttons:[...document.querySelectorAll('button')].filter(b=>b.getClientRects().length).map(b=>{const r=b.getBoundingClientRect();return {x:r.x,right:r.right,bottom:r.bottom,height:r.height,overflow:b.scrollWidth>b.clientWidth}}),log:document.querySelector('.terminal-log').getBoundingClientRect().height,cols:getComputedStyle(document.querySelector('.terminal-actions')).gridTemplateColumns,title:document.querySelector('h1').getBoundingClientRect().right,toggle:document.querySelector('.menu-toggle').getBoundingClientRect().x}));assert.equal(bounds.width,320);assert.ok(bounds.buttons.every(b=>b.height>=44&&b.x>=0&&b.right<=320&&b.bottom<=640&&!b.overflow));assert.ok(bounds.log>=100);assert.ok(bounds.title<=bounds.toggle);assert.equal(bounds.cols.split(' ').length,1);assert.equal(await page.locator('nav').count(),0)}
 async function menu(){const before=await snapshot();const geometry=()=>page.locator('.terminal-actions').boundingBox();const box=await geometry();await page.locator('.menu-toggle').tap();assert.deepEqual(await page.locator('.language-menu button').allTextContents(),[t('language',language)+' >']);await layout();assert.deepEqual(await geometry(),box);await page.locator('.language-menu button').tap();assert.deepEqual(await page.locator('.language-menu button').allTextContents(),['日本語','English']);await page.getByRole('button',{name:language==='ja'?'English':'日本語',exact:true}).tap();assert.deepEqual(await snapshot(),before);assert.equal(await page.locator('html').getAttribute('lang'),language==='ja'?'en':'ja');await page.locator('.menu-toggle').tap();await page.locator('.language-menu button').tap();await page.getByRole('button',{name:language==='ja'?'日本語':'English',exact:true}).tap();assert.deepEqual(await snapshot(),before);await layout()}
 await menu()
 for(const name of ['BODY','TECH','SENSE']){
 const reference=new Game();await page.getByRole('button',{name:t(name==='BODY'?'start':'restart',language),exact:true}).tap();await layout();await menu()
 async function storyCheckpoint(){
   const lines=narrative(reference.state,language)
   const visible=await page.locator('.terminal-log p').allTextContents()
   assert.deepEqual(visible.slice(-lines.length),lines)
   if(['explore','combat','levelup','warehouse','clear'].includes(reference.state.scene)){
     const paragraphs=page.locator('.terminal-log p'),first=paragraphs.nth(visible.length-lines.length)
     await first.evaluate(el=>{const log=el.closest('.terminal-log');log.scrollTop=el.offsetTop-log.offsetTop})
     await page.screenshot({path:`${artifacts}/${language}-${reference.state.scene}-start.png`})
     await page.locator('.terminal-log').evaluate(el=>el.scrollTop=el.scrollHeight)
     await page.screenshot({path:`${artifacts}/${language}-${reference.state.scene}-end.png`})
   }
 }
 await storyCheckpoint()
 for(let n=0;reference.state.status==='playing'&&n<150;n++){const id=nextAction(reference,name);const transition=reference.choose(id);assert.ok(transition);await page.locator(`[data-choice="${id}"]`).tap();assert.deepEqual((await snapshot()).state,reference.state);assert.equal(await page.locator('.enemy-panel').isVisible(),!!reference.state.enemy);if(reference.state.enemy){assert.ok((await page.locator('.enemy-panel').innerText()).includes('NEXT:'));assert.ok((await page.locator('.enemy-panel').innerText()).includes(String(reference.state.enemy.hp)))}assert.ok((await page.locator('.status').innerText()).includes(`HP ${reference.state.hp}/${reference.state.maxHp}`));const prose=await page.locator('.terminal-log').innerText();assert.ok(prose.includes(transition.result[language]));assert.equal(await page.locator('.terminal-log').getAttribute('aria-busy'),'false');await layout();await storyCheckpoint()}
 assert.equal(reference.state.status,'clear');await menu();await page.screenshot({path:`${artifacts}/${language}-${name}.png`});report.push({language,width:320,route:name,result:'CLEAR',state:reference.state})
 }
 const itemReference=new Game();await page.getByRole('button',{name:t('restart',language),exact:true}).tap();
 for(const id of ['begin','TECH','SENSE','forward','items','back','items','kit','items','battery']){assert.ok(itemReference.choose(id));await page.locator(`[data-choice="${id}"]`).tap();assert.deepEqual((await snapshot()).state,itemReference.state);await layout();await menu()}
 for(let n=0;(await snapshot()).state.status==='playing'&&n<30;n++) await page.locator('[data-choice="observe"]').tap();
 assert.equal((await snapshot()).state.status,'over');
 report.push({language,check:'touch item menu/back/heal/stun',result:'PASS'});
 await page.getByRole('button',{name:t('restart',language),exact:true}).tap();
 for(const id of ['begin','BODY','BODY','forward','attack','attack']) await page.locator(`[data-choice="${id}"]`).tap();
 for(let n=0;n<20&&(await snapshot()).state.status==='playing';n++) {const current=(await snapshot()).state;const id=current.scene==='combat'?'observe':current.scene==='victory'?'continue':current.scene==='event'?'SENSE':current.scene==='levelup'?'BODY':'forward';await page.locator(`[data-choice="${id}"]`).tap()}
 assert.equal((await snapshot()).state.status,'over');assert.ok((await page.locator('.terminal-log').innerText()).includes('GAME OVER'));await menu();report.push({language,check:'GAME OVER/restart',result:'PASS'});
 // Typewriter disables controls, tap skips without advancing, live reduced motion completes.
 await page.emulateMedia({reducedMotion:'no-preference'});await page.getByRole('button',{name:t('restart',language),exact:true}).tap();assert.equal(await page.locator('.terminal-log').getAttribute('aria-busy'),'true');assert.equal(await page.locator('[data-choice="begin"]').isDisabled(),true)
 const before=await snapshot();await page.locator('.terminal-log').tap();assert.equal(await page.locator('.terminal-log').getAttribute('aria-busy'),'false');assert.deepEqual(await snapshot(),before)
 await page.locator('[data-choice="begin"]').tap();await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('.terminal-log').getAttribute('aria-busy')==='false');await layout();assert.deepEqual(errors,[])
 await page.route(/\/src\/style\.css(?:\?.*)?$/, async route => { const response = await route.fetch(); let body = await response.text(); for (const [side, size] of Object.entries({top:24,right:16,bottom:20,left:16})) body = body.replaceAll(`env(safe-area-inset-${side})`, `${size}px`); await route.fulfill({response,body}) });
 await page.reload(); await page.waitForFunction(()=>!!globalThis.__exitTest); await layout(); assert.deepEqual(await page.locator('.terminal').evaluate(el=>{const css=getComputedStyle(el);return ['Top','Right','Bottom','Left'].map(side=>parseFloat(css[`padding${side}`]))}),[24,16,20,16]);
 report.push({language,check:'safe-area/typewriter/tap-skip/reduced-motion/language-nonprogress/44px/320px',result:'PASS'});await context.close()
 }
 await writeFile(`${artifacts}/report.json`,JSON.stringify(report,null,2)+'\n');console.log(`PASS: ja/en BODY/TECH/SENSE CLEAR and UI checks. ${artifacts}`)
}finally{await browser.close()}
