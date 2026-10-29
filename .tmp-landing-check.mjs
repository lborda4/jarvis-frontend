import { spawn } from 'node:child_process';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const profile = await mkdtemp(join(tmpdir(), 'jarvis-responsive-'));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9235',`--user-data-dir=${profile}`,'about:blank'], {windowsHide:true,stdio:'ignore'});
let ws;
try {
 let targets;
 for(let i=0;i<40;i++){try{targets=await (await fetch('http://127.0.0.1:9235/json')).json();break;}catch{await new Promise(r=>setTimeout(r,250));}}
 ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
 await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 let id=0;const pending=new Map();
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
 const evaluate=async(expression)=>(await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value;
 await send('Page.enable');
 await send('Page.navigate',{url:'http://127.0.0.1:5173/'});
 for(let i=0;i<80;i++){if(await evaluate("!!document.querySelector('.landing-page')"))break;await new Promise(r=>setTimeout(r,250));}
 for(const [width,height] of [[320,740],[390,844],[768,1024],[1024,768],[1440,900]]){
 await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
 await new Promise(r=>setTimeout(r,200));
 const result=await evaluate(`(()=>{const r={width:innerWidth,scrollWidth:document.documentElement.scrollWidth,landing:!!document.querySelector('.landing-page'),solutions:getComputedStyle(document.querySelector('.landing-solutions')).gridTemplateColumns,pricing:getComputedStyle(document.querySelector('.landing-pricing')).gridTemplateColumns};r.overflow=[...document.querySelectorAll('.landing-page *')].filter(e=>{const b=e.getBoundingClientRect();return b.width&& (b.right>innerWidth+1||b.left < -1)}).map(e=>e.className).slice(0,12);return r})()`);
 console.log(JSON.stringify(result));
 if(width===390 || width===768){const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(`.tmp-landing-${width}.png`,Buffer.from(shot.data,'base64'));}
 if(width<1200){
 await evaluate("document.querySelector('.landing-menu-btn').click()");
 console.log('menu',width,await evaluate("getComputedStyle(document.querySelector('.landing-nav')).display==='flex'"));
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
 console.log('escape',width,await evaluate("document.querySelector('.landing-menu-btn').getAttribute('aria-expanded')==='false'"));
 }
 }
 await send('Browser.close');
}finally{ws?.close();chrome.kill();await new Promise(r=>setTimeout(r,500));await rm(profile,{recursive:true,force:true}).catch(()=>{});}
