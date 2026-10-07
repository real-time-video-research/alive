'use strict';
const DATA=window.ALIVE_DATA;
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const METHODS=[['senorita','Señorita'],['novaedit','NovaEdit'],['i2vedit','I2VEdit'],['anyv2v','AnyV2V'],['propfly','PropFly'],['all','All methods']];
const SOURCES=['RealShot','HOIGen-1M','Model-generated','Real-world','General insertion'];
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const players=new Set();
function videoTile(label,url,poster,guide,ours=false){return `<article class="media-tile ${ours?'ours':''}"><div class="media-label"><span>${esc(label)}</span><small>${esc(guide)}</small><a class="open-video" href="${esc(url)}" target="_blank" rel="noopener" aria-label="Open ${esc(label)} video">↗</a></div><div class="media-box"><video muted playsinline loop preload="none" data-src="${esc(url)}" ${poster?`data-poster="${esc(poster)}"`:''} ${ours?'data-master="true"':''} aria-label="${esc(label)}"></video></div></article>`;}
function controls(){return '<div class="controls"><button type="button" class="play" aria-label="Play comparison">▶ Play</button><button type="button" class="replay" aria-label="Replay comparison">↺</button><input type="range" class="progress" min="0" max="1000" value="0" aria-label="Comparison progress"><output>0%</output><select class="speed" aria-label="Playback speed"><option value="0.5">0.5×</option><option value="1" selected>1×</option></select></div><p class="video-status" role="status"></p>';}
function ready(video,signal){
 return new Promise((resolve,reject)=>{
  let timer;
  const clean=()=>{clearTimeout(timer);for(const name of ['canplay','seeked','error'])video.removeEventListener(name,check);signal.removeEventListener('abort',abort);};
  const abort=()=>{clean();reject(new DOMException('Cancelled','AbortError'));};
  const check=()=>{if(video.error){clean();reject(new Error('A video could not load.'));}else if(video.readyState>=3&&!video.seeking){clean();resolve();}};
  if(signal.aborted){abort();return;}
  for(const name of ['canplay','seeked','error'])video.addEventListener(name,check);signal.addEventListener('abort',abort,{once:true});
  timer=setTimeout(()=>{clean();reject(new Error('Loading is taking longer than expected.'));},30000);check();
 });
}
// The ALIVE clip supplies the clock; never drive its currentTime from wall time.
class ComparisonPlayer{
 constructor(root){
  this.root=root;this.videos=[...root.querySelectorAll('video')];this.master=root.querySelector('[data-master]');
  this.button=root.querySelector('.play');this.range=root.querySelector('.progress');this.output=root.querySelector('output');this.speed=root.querySelector('.speed');this.status=root.querySelector('.video-status');
  this.active=false;this.pending=false;this.userPaused=false;this.visible=false;this.p=0;this.raf=0;this.lastCorrection=0;
  this.button.onclick=()=>{this.userPaused=this.active;this.active?this.pause():this.play();};
  root.querySelector('.replay').onclick=()=>{this.userPaused=false;this.seek(0);this.play();};
  this.range.oninput=()=>this.seek(Number(this.range.value)/1000);this.speed.onchange=()=>this.rates();
  for(const v of this.videos){v.muted=true;v.defaultMuted=true;v.playsInline=true;v.loop=true;v.addEventListener('loadedmetadata',()=>{this.rates();if(this.seekTarget!==undefined&&Number.isFinite(v.duration))v.currentTime=this.seekTarget*v.duration;});}
  this.observer=new IntersectionObserver(entries=>{for(const e of entries){this.visible=e.isIntersecting&&e.intersectionRatio>=.2;if(this.visible){this.load();this.resumeIfVisible();}else this.pause();}},{threshold:[0,.2]});
  this.observer.observe(root);players.add(this);
 }
 load(){for(const v of this.videos)if(!v.getAttribute('src')){if(v.dataset.poster)v.poster=v.dataset.poster;v.src=v.dataset.src;v.preload='auto';v.load();}}
 rates(){if(!Number.isFinite(this.master.duration))return;const speed=Number(this.speed.value);for(const v of this.videos)if(Number.isFinite(v.duration))v.playbackRate=Math.min(16,Math.max(.0625,v.duration/this.master.duration*speed));}
 draw(){if(Number.isFinite(this.master.duration)&&!this.master.seeking&&this.seekTarget===undefined)this.p=this.master.currentTime/this.master.duration;this.range.value=Math.round(this.p*1000);this.output.textContent=Math.round(this.p*100)+'%';}
 seek(p){this.load();this.p=Math.max(0,Math.min(.999,p));this.seekTarget=this.p;for(const v of this.videos)if(Number.isFinite(v.duration))v.currentTime=this.p*v.duration;this.draw();if(this.active)this.resume();}
 play(){this.load();if(this.active)return;for(const v of this.videos)if(v.error)v.load();this.active=true;this.resume();}
 async resume(){
  if(this.pending||!this.active)return;this.pending=true;cancelAnimationFrame(this.raf);this.videos.forEach(v=>v.pause());
  this.abort?.abort();const controller=new AbortController();this.abort=controller;const signal=controller.signal;
  this.button.textContent='Ⅱ Pause';this.button.setAttribute('aria-label','Pause comparison');this.status.textContent='Loading synchronized videos…';
  try{
   await Promise.all(this.videos.map(v=>ready(v,signal)));if(signal.aborted||!this.active)return;
   this.rates();const p=this.seekTarget??(this.master.currentTime/this.master.duration);
   for(const v of this.videos){const target=p*v.duration;if(Math.abs(v.currentTime-target)>.06)v.currentTime=target;}
   this.seekTarget=undefined;
   await Promise.all(this.videos.map(v=>ready(v,signal)));if(signal.aborted||!this.active)return;
   await Promise.all(this.videos.map(v=>v.play()));if(signal.aborted||!this.active)return;
   this.pending=false;this.status.textContent='';this.tick(performance.now());
  }catch(error){if(signal.aborted)return;this.pause();this.status.textContent=error.name==='NotAllowedError'?'Press Play to start this comparison.':error.message+' Press Play to retry.';}
 }
 tick(t){
  if(!this.active||this.pending)return;
  this.draw();
  if(this.videos.some(v=>v.readyState<3||v.seeking)){this.resume();return;}
  // Occasional correction of followers, including after the master's native loop.
  if(t-this.lastCorrection>350){this.lastCorrection=t;for(const v of this.videos){if(v===this.master)continue;const target=this.p*v.duration;if(Math.abs(v.currentTime-target)>.22)v.currentTime=target;}}
  this.raf=requestAnimationFrame(x=>this.tick(x));
 }
 pause(){this.active=false;this.pending=false;this.abort?.abort();cancelAnimationFrame(this.raf);this.videos.forEach(v=>v.pause());this.button.textContent='▶ Play';this.button.setAttribute('aria-label','Play comparison');this.status.textContent='';}
 resumeIfVisible(){if(this.visible&&!document.hidden&&!reduced&&!this.userPaused)this.play();}
 destroy(){this.pause();this.observer.disconnect();for(const v of this.videos){v.removeAttribute('src');v.load();}players.delete(this);}
}
function state(){const p=new URLSearchParams(location.hash.slice(1));const method=METHODS.some(([id])=>id===p.get('method'))?p.get('method'):'senorita';return {method,source:SOURCES.includes(p.get('source'))?p.get('source'):'all',case:p.get('case')};}
function href(method,source){const p=new URLSearchParams({method});if(source!=='all')p.set('source',source);return '#'+p.toString();}
function render(){
 const st=state();for(const player of [...players])player.destroy();
 const methodName=METHODS.find(([id])=>id===st.method)[1];$('#comparison-title').textContent=st.method==='all'?'All methods':`ALIVE vs. ${methodName}`;document.title=$('#comparison-title').textContent+' · ALIVE';
 $('#method-tabs').innerHTML=METHODS.map(([id,label])=>`<a href="${href(id,st.source)}" class="${id===st.method?'active':''}" ${id===st.method?'aria-current="true"':''}>${esc(label)}</a>`).join('');
 $('#source-tabs').innerHTML=['all',...SOURCES].map(g=>{const n=g==='all'?DATA.cases.length:DATA.cases.filter(c=>c.group===g).length;return `<a href="${href(st.method,g)}" class="${st.source===g?'active':''}" ${st.source===g?'aria-current="true"':''}>${g==='all'?'All sources':esc(g)} · ${n}</a>`;}).join('');
 const container=$('#comparison-cases');container.replaceChildren();
 for(const group of SOURCES){
  if(st.source!=='all'&&st.source!==group)continue;const cases=DATA.cases.filter(c=>c.group===group);if(!cases.length)continue;
  const section=document.createElement('section');section.className='comparison-group';section.innerHTML=`<div class="comparison-source-heading"><h2>${esc(group)} <small>${cases.length} examples</small></h2><p class="comparison-source-description">${esc(DATA.sourceDescriptions[group])}</p></div>`;
  for(const c of cases){
   const selected=st.method==='all'?METHODS.filter(([id])=>id!=='all').map(([id])=>c.methods.find(m=>m.id===id)):[c.methods.find(m=>m.id===st.method)];
   selected.push(c.methods.find(m=>m.id==='vlmp4'));
   const row=document.createElement('article');row.className='comparison-case';row.id='comparison-'+c.id;row.dataset.case=c.id;
   row.innerHTML=`<header class="comparison-case-head"><figure><img src="${esc(c.e0)}" loading="lazy" alt="Shared edited first-frame input"><figcaption>Edited first frame</figcaption></figure><div><h3>${esc(c.prompt)}</h3><span class="case-id">${esc(c.id)}</span></div></header><div class="comparison-grid ${st.method==='all'?'all-methods':''}">${videoTile('Source',c.source,c.sourcePoster,'Input')}${selected.map(m=>videoTile(m.label,m.url,m.id==='vlmp4'?c.resultPoster:'',m.guidance,m.id==='vlmp4')).join('')}</div>${controls()}`;
   section.append(row);new ComparisonPlayer(row);
  }
  container.append(section);
 }
 if(st.case)document.getElementById('comparison-'+st.case)?.scrollIntoView({block:'start'});
}
window.addEventListener('hashchange',render);
document.addEventListener('visibilitychange',()=>players.forEach(p=>document.hidden?p.pause():p.resumeIfVisible()));
render();
