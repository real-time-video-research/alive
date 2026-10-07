'use strict';
const D=window.ALIVE_DATA,$=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const caseById=id=>D.cases.find(c=>c.id===id),ours=c=>c.methods.find(m=>m.id==='vlmp4');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;const players=new Set();
function videoHTML(url,poster='',extra=''){return `<video muted playsinline preload="none" ${poster?`poster="${esc(poster)}"`:''} data-src="${esc(url)}" ${extra}></video>`;}
function tile(label,url,poster='',image=false,guide='',isOurs=false){return `<article class="media-tile ${isOurs?'ours':''} ${image?'input':''}"><div class="media-label">${esc(label)}<small>${esc(guide)}</small></div><div class="media-box">${image?`<img src="${esc(url)}" alt="Edited first frame: input defining the added object" loading="lazy">`:videoHTML(url,poster,`aria-label="${esc(label)}"`)}</div></article>`;}
function controlHTML(){return `<div class="controls"><button type="button" class="play" aria-label="Play synchronized videos">▶ Play</button><input class="progress" type="range" min="0" max="1000" value="0" aria-label="Video progress"><output>0%</output><select class="speed" aria-label="Playback speed"><option value="0.5">0.5×</option><option value="1" selected>1×</option></select></div><div class="video-status" role="status"></div>`;}
function loadVideo(v){if(!v.getAttribute('src')){v.src=v.dataset.src;v.preload='auto';v.load();}}
class Player{
 constructor(root,autoplay=false,threshold=.15){this.root=root;this.videos=[...root.querySelectorAll('video')];this.active=false;this.p=0;this.raf=0;this.loaded=false;this.button=root.querySelector('.play');this.range=root.querySelector('.progress');this.output=root.querySelector('output');this.speed=root.querySelector('.speed');this.status=root.querySelector('.video-status');this.button.onclick=()=>{this.userPaused=this.active;this.active?this.pause():this.play();};this.range.oninput=()=>{this.load();this.seek(Number(this.range.value)/1000);};this.speed.onchange=()=>this.rates();for(const v of this.videos){v.addEventListener('loadedmetadata',()=>{this.rates();if(this.p)v.currentTime=this.p*v.duration;});v.addEventListener('error',()=>{this.status.textContent='A video could not load. Reload the page to retry.';});}players.add(this);this.observer=new IntersectionObserver(es=>{for(const e of es){if(e.isIntersecting){this.load();if(autoplay&&!reduced&&!this.userPaused)this.play();}else this.pause();}},{threshold});this.observer.observe(root);}
 load(){if(this.loaded)return;this.loaded=true;this.videos.forEach(loadVideo);}
 duration(){return Math.max(1,...this.videos.map(v=>Number.isFinite(v.duration)?v.duration:0));}
 rates(){const dur=this.duration(),speed=Number(this.speed.value);this.videos.forEach(v=>{if(Number.isFinite(v.duration))v.playbackRate=Math.max(.0625,Math.min(16,v.duration/dur*speed));});}
 seek(p){this.p=Math.max(0,Math.min(.999,p));for(const v of this.videos)if(Number.isFinite(v.duration))v.currentTime=Math.min(this.p*v.duration,v.duration-.02);this.draw();}
 draw(){this.range.value=Math.round(this.p*1000);this.output.textContent=Math.round(this.p*100)+'%';if(this.onProgress)this.onProgress(this.p);}
 play(){this.load();this.active=true;this.button.textContent='Ⅱ Pause';this.button.setAttribute('aria-label','Pause synchronized videos');this.rates();this.last=performance.now();this.videos.forEach(v=>v.play().catch(()=>{}));cancelAnimationFrame(this.raf);this.raf=requestAnimationFrame(t=>this.tick(t));}
 tick(t){if(!this.active)return;const dt=Math.min(.08,(t-this.last)/1000);this.last=t;const good=this.videos.filter(v=>!v.error);if(good.length&&good.every(v=>v.readyState>=3)){this.p+=dt/this.duration()*Number(this.speed.value);if(this.p>=.995)this.seek(0);for(const v of good){const target=this.p*v.duration;if(Math.abs(v.currentTime-target)>.16)v.currentTime=target;if(v.paused)v.play().catch(()=>{});}}else this.videos.forEach(v=>v.pause());this.draw();this.raf=requestAnimationFrame(x=>this.tick(x));}
 pause(){this.active=false;cancelAnimationFrame(this.raf);this.videos.forEach(v=>v.pause());this.button.textContent='▶ Play';this.button.setAttribute('aria-label','Play synchronized videos');}
 destroy(){this.pause();this.observer.disconnect();this.videos.forEach(v=>{v.removeAttribute('src');v.load();});players.delete(this);}
}
// Composited cards already contain synchronized source/result frames.
// Let the media element own its playback clock; never seek it from an animation clock.
class StackedPlayer {
 constructor(root) {
  this.root=root;this.video=root.querySelector('video');this.videos=[this.video];
  this.hovered=false;this.manualPlay=false;this.rowRunning=false;
  this.active=false;this.userPaused=false;this.visible=false;this.loaded=false;this.p=0;this.raf=0;this.attempt=0;
  this.button=root.querySelector('.play');this.range=root.querySelector('.progress');
  this.output=root.querySelector('output');this.speed=root.querySelector('.speed');this.status=root.querySelector('.video-status');
  const v=this.video;v.muted=true;v.defaultMuted=true;v.playsInline=true;v.loop=true;
  this.button.onclick=()=>{
   if(this.active){this.userPaused=true;this.manualPlay=false;this.pause();}
   else this.startManually();
  };
  this.overlay=root.querySelector('.edit-overlay');
  this.still=root.querySelector('.edit-still');this.highlight=root.querySelector('.edit-highlight');
  root.addEventListener('pointerenter',e=>{
   if(reduced||e.pointerType==='touch'||!matchMedia('(any-hover: hover)').matches)return;
   this.hovered=true;
   this.userPaused=false;
   this.load();this.seek(0);
   this.resume();
  });
  root.addEventListener('pointerleave',()=>{
   this.hovered=false;
   if(!this.manualPlay&&!this.rowRunning){this.pause();this.seek(0);}
  });
  this.range.oninput=()=>{this.load();this.seek(Number(this.range.value)/1000);this.overlay.hidden=true;};
  this.speed.onchange=()=>this.rates();
  v.addEventListener('loadedmetadata',()=>{this.rates();if(this.pendingSeek!==undefined){this.seek(this.pendingSeek);delete this.pendingSeek;}});
  v.addEventListener('timeupdate',()=>this.draw());
  v.addEventListener('seeking',()=>{if(this.active)this.status.textContent='Loading video…';});
  v.addEventListener('waiting',()=>{if(this.active)this.status.textContent='Loading video…';});
  v.addEventListener('playing',()=>{this.status.textContent='';this.draw();});
  v.addEventListener('canplay',()=>{if(this.active)this.status.textContent='';});
  v.addEventListener('error',()=>{this.pause();this.status.textContent='Video could not load. Press Play to retry, or use Download.';});
  players.add(this);
  this.observer=new IntersectionObserver(es=>{
   for(const e of es){
    this.visible=e.isIntersecting&&e.intersectionRatio>=.1;
    if(this.visible){this.load();this.resume();}else this.pause();
   }
  },{threshold:[0,.1]});
  this.observer.observe(root);
 }
 load(){
  if(this.loaded)return;this.loaded=true;
  if(this.video.dataset.poster)this.video.poster=this.video.dataset.poster;
  for(const img of [this.still,this.highlight])if(!img.getAttribute('src'))img.src=img.dataset.src;
  loadVideo(this.video);
 }
 rates(){this.video.playbackRate=Number(this.speed.value);}
 seek(p){
  this.p=Math.max(0,Math.min(.999,p));
  if(Number.isFinite(this.video.duration))this.video.currentTime=this.p*this.video.duration;
  else this.pendingSeek=this.p;
  this.range.value=Math.round(this.p*1000);this.output.textContent=Math.round(this.p*100)+'%';
 }
 draw(){
  if(Number.isFinite(this.video.duration)&&!this.video.seeking){
   this.p=this.video.currentTime/this.video.duration;
   this.range.value=Math.round(this.p*1000);this.output.textContent=Math.round(this.p*100)+'%';
  }
 }
 tick(){if(!this.active)return;this.draw();this.raf=requestAnimationFrame(()=>this.tick());}
 play(){
  if(this.active)return;
  this.load();if(this.video.error)this.video.load();this.rates();this.active=true;this.overlay.hidden=true;
  this.button.textContent='Ⅱ Pause';this.button.setAttribute('aria-label','Pause video');
  this.status.textContent=this.video.readyState<3?'Loading video…':'';
  const attempt=++this.attempt;
  this.video.play().catch(error=>{
   if(attempt!==this.attempt)return;
   this.pause();
   this.status.textContent=error.name==='NotAllowedError'?'Press Play to start the video.':'Playback interrupted. Press Play to retry.';
  });
  cancelAnimationFrame(this.raf);this.tick();
 }
 pause(){
  this.active=false;this.overlay.hidden=false;++this.attempt;cancelAnimationFrame(this.raf);this.video.pause();
  this.button.textContent='▶ Play';this.button.setAttribute('aria-label','Play video');this.status.textContent='';
 }
 startManually(restart=false){
  if(restart){this.load();this.seek(0);}
  this.manualPlay=true;this.userPaused=false;this.play();
 }
 setRowPlaying(running,restart=false){
  if(restart)this.seek(0);
  this.rowRunning=running;this.manualPlay=false;this.userPaused=!running;
  if(running)this.resume();
  else{this.hovered=false;this.pause();}
 }
 resume(){
  const intended=this.manualPlay||this.rowRunning||(this.hovered&&!reduced);
  if(this.visible&&!document.hidden&&!this.userPaused&&intended)this.play();
 }
 destroy(){this.pause();this.observer.disconnect();this.video.removeAttribute('src');this.video.load();players.delete(this);}
}
function taskDemo(root,c,example,autoplay=false){
 const baseline=c.methods.find(m=>m.id==='senorita');
 const verdict=success=>`<svg class="task-verdict ${success?'success':'failure'}" viewBox="0 0 28 28" role="img" aria-label="${success?'Successful interaction':'Failed interaction'}"><circle cx="14" cy="14" r="12"/><path d="${success?'M8 14.5l4 4L20 10':'M10 10l8 8m0-8l-8 8'}"/></svg>`;
 root.innerHTML=`<div class="task-question" role="group" aria-label="Given source video and edited first frame. Will the ${esc(example.actor)} ${esc(example.action)} the ${esc(example.object)}?">
  <div class="task-inputs">
   <figure class="task-input task-source"><div class="task-input-media">${videoHTML(c.source,c.sourcePoster,'aria-label="Source video"')}</div><figcaption><span>Given</span> source video</figcaption></figure>
   <figure class="task-input task-edited"><div class="task-input-media"><img src="${esc(c.e0)}" alt="Edited first frame with the ${esc(example.object)} added" fetchpriority="high"><img class="task-object-mask" src="task-assets/${esc(c.id)}--object-mask.svg" alt="" aria-hidden="true"></div><figcaption><span>and</span> edited first frame <small>(w/ inserted object)</small></figcaption></figure>
  </div>
  <p class="task-ask" id="${root.id}-question">Will the ${esc(example.actor)} <strong>${esc(example.action)}</strong> the ${esc(example.object)}?</p>
 </div>
 <div class="task-answers">
  <figure class="task-answer baseline"><figcaption>${verdict(false)}<strong>Señorita</strong></figcaption><div class="task-answer-media">${videoHTML(baseline.url,`task-assets/${c.id}--senorita.jpg`,`aria-label="Señorita result: ${esc(example.failure)}"`)}</div></figure>
  <figure class="task-answer alive"><figcaption>${verdict(true)}<strong>ALIVE</strong></figcaption><div class="task-answer-media">${videoHTML(ours(c).url,c.resultPoster,`aria-label="ALIVE result: ${esc(example.success)}"`)}</div></figure>
 </div>${controlHTML()}`;
 return new Player(root,autoplay);
}
const taskExamples=[
 {id:'mug',caseId:'ioved2k__iovb_001',actor:'hand',action:'pick up',object:'mug',failure:'the mug remains on the table',success:'the hand picks up the mug'},
 {id:'laptop',caseId:'ioved2k__iovb_143',actor:'hand',action:'open',object:'laptop',failure:'the laptop remains closed',success:'the hand opens the laptop'},
 {id:'bread',caseId:'hoigen__h1m_0099549_cb53dbc189',actor:'knife',action:'cut',object:'bread',failure:'the bread deforms during cutting',success:'the knife cuts the bread'},
 {id:'headphones',caseId:'hoigen__h1m_0929827_2c5a4d32bb',actor:'hands',action:'put on',object:'headphones',failure:'the wearing interaction is not completed coherently',success:'the hands put on the headphones'}
];
const taskCaseById=id=>caseById(id)||(D.taskCases||[]).find(c=>c.id===id);
$('#hero-demo').innerHTML='<article id="task-active" class="task-case" aria-labelledby="task-active-question"></article><div id="task-prompts" class="task-prompts" role="group" aria-label="Choose an example by its insertion prompt"></div>';
let taskPlayer=null,selectedTask=null;
function selectTaskExample(example,userInitiated=false){
 if(selectedTask===example.id)return;
 if(taskPlayer)taskPlayer.destroy();
 const c=taskCaseById(example.caseId),panel=$('#task-active');selectedTask=example.id;panel.dataset.case=c.id;
 taskPlayer=taskDemo(panel,c,example,true);
 $('#task-prompts').querySelectorAll('button').forEach(b=>{const active=b.dataset.example===example.id;b.setAttribute('aria-pressed',String(active));b.classList.toggle('active',active);});
 if(userInitiated)taskPlayer.play();
}
for(const example of taskExamples){
 const c=taskCaseById(example.caseId),button=document.createElement('button');button.type='button';button.className='task-prompt';button.dataset.example=example.id;button.textContent=c.prompt;button.setAttribute('aria-controls','task-active');button.setAttribute('aria-pressed','false');button.onclick=()=>selectTaskExample(example,true);$('#task-prompts').append(button);
}
selectTaskExample(taskExamples[0]);

const groups=['RealShot','HOIGen-1M','Model-generated','Real-world','General insertion'];
const galleryPlayers=new Map();
for(const [i,g] of groups.entries()){
 const id='source-'+g.toLowerCase().replace(/[^a-z0-9]+/g,'-'),cases=D.gallery.filter(c=>c.group===g);
 const link=document.createElement('a');link.href='#'+id;link.textContent=g;$('#source-links').append(link);
 const row=document.createElement('section');row.className='source-row';row.id=id;
 row.innerHTML=`<header class="source-row-head"><div class="source-row-title"><h3><span class="row-number">0${i+1}</span>${esc(g)} <small>${cases.length} examples</small></h3><p class="source-description">${esc(D.sourceDescriptions[g])}</p></div><div class="row-controls"><button class="row-start row-play" type="button" aria-label="Start all ${esc(g)} videos from the beginning">▶ Start all this row</button><button class="row-pause row-play" type="button" aria-label="Pause ${esc(g)} row">Pause row</button><button class="row-prev" type="button" aria-label="Previous ${esc(g)} examples">←</button><button class="row-next" type="button" aria-label="More ${esc(g)} examples">→</button></div></header><div class="source-track" tabindex="0" role="region" aria-label="${esc(g)} video examples"></div>`;
 const track=row.querySelector('.source-track');
 for(const c of cases){
  const card=document.createElement('article');card.className='wipe-card stacked-card';card.id='sample-'+c.id;card.dataset.case=c.id;
  card.innerHTML=`<div class="stacked-media" style="aspect-ratio:${c.stacked.width}/${c.stacked.height}">${videoHTML(c.stacked.preview||c.stacked.url,'',`data-poster="${esc(c.stacked.previewPoster||c.stacked.poster)}" `+`aria-label="${esc(c.prompt)} Source above, ALIVE result below, with direct synchronized playback"`)}<div class="edit-overlay" aria-hidden="true"><img class="edit-still" data-src="${esc(c.stacked.previewPoster||c.stacked.poster)}" alt=""><img class="edit-highlight" data-src="${esc(c.objectHighlight)}" alt=""><svg class="idle-frame-label" viewBox="0 0 768 1024" aria-hidden="true"><rect x="15" y="527" width="275" height="42" rx="7" fill="#856a38"/><text x="28" y="556" fill="#ffffff" font-family="DejaVu Sans, Arial, sans-serif" font-size="24" font-weight="700">Edited first frame</text></svg><span class="edit-prompt">${esc(c.prompt)}</span></div></div>${controlHTML()}<div class="stacked-actions"><button type="button" class="start-edit" aria-label="Start edit from the beginning">▶ Start edit</button><a href="${esc(c.stacked.url)}" download aria-label="Download this source and ALIVE comparison">Download ↗</a></div>`;
  track.append(card);const player=new StackedPlayer(card);galleryPlayers.set(c.id,player);
  card.querySelector('.start-edit').onclick=()=>player.startManually(true);
 }
 $('#source-rows').append(row);
 const prev=row.querySelector('.row-prev'),next=row.querySelector('.row-next');
 const update=()=>{prev.disabled=track.scrollLeft<2;next.disabled=track.scrollLeft+track.clientWidth>=track.scrollWidth-3;};
 prev.onclick=()=>track.scrollBy({left:-track.clientWidth,behavior:reduced?'instant':'smooth'});next.onclick=()=>track.scrollBy({left:track.clientWidth,behavior:reduced?'instant':'smooth'});track.addEventListener('scroll',update,{passive:true});new ResizeObserver(update).observe(track);update();
 row.querySelector('.row-start').onclick=()=>cases.forEach(c=>galleryPlayers.get(c.id).setRowPlaying(true,true));
 row.querySelector('.row-pause').onclick=()=>cases.forEach(c=>galleryPlayers.get(c.id).setRowPlaying(false));
}
function fromHash(){if(location.hash.startsWith('#case=')){const id=decodeURIComponent(location.hash.slice(6)),p=galleryPlayers.get(id);if(p)p.root.scrollIntoView({block:'center',inline:'center',behavior:'instant'});}}
window.addEventListener('hashchange',fromHash);fromHash();
let trainingSource=D.training.find(t=>t.key==='real'),training,promptLevel='p4',trainPlayer;
const trainingIndices=new Map(D.training.map(t=>[t.key,0]));
$('#training-tabs').querySelectorAll('.source-card').forEach(b=>{b.onclick=()=>{trainingSource=D.training.find(t=>t.key===b.dataset.key);renderTraining();};});
function selectTrainingExample(index){
 const n=trainingSource.examples.length;
 trainingIndices.set(trainingSource.key,(index+n)%n);renderTraining();
}
$('#training-prev').onclick=()=>selectTrainingExample(trainingIndices.get(trainingSource.key)-1);
$('#training-next').onclick=()=>selectTrainingExample(trainingIndices.get(trainingSource.key)+1);
$('#training-select').onchange=e=>selectTrainingExample(Number(e.target.value));
const levels=[['p0','P0 · No text'],['p1','P1 · Identity'],['p2','P2 · Interaction'],['p3','P3 · Sequence'],['p4','P4 · Chunks']];
for(const [key,label]of levels){const b=document.createElement('button');b.innerHTML=`<span>${key.toUpperCase()}</span><span class="prompt-level-detail"> ${esc(label.split(' · ')[1])}</span>`;b.title=label;b.setAttribute('aria-label',label);b.dataset.key=key;b.onclick=()=>{promptLevel=key;renderPrompt();};$('#prompt-tabs').append(b);}
function renderTraining(){
 if(trainPlayer)trainPlayer.destroy();
 const index=trainingIndices.get(trainingSource.key),examples=trainingSource.examples;
 training={...trainingSource,...examples[index]};const t=training,v=t.video;
 $('#training-select').innerHTML=examples.map((e,i)=>`<option value="${i}" ${i===index?'selected':''}>${String(i+1).padStart(2,'0')} · ${esc(e.p1)}</option>`).join('');
 $('#training-count').textContent=`${index+1} / ${examples.length}`;
 $('#training-select').disabled=examples.length<2;
 $('#training-prev').disabled=examples.length<2;
 $('#training-next').disabled=examples.length<2;
 $('#training-tabs').querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b.dataset.key===t.key);b.setAttribute('aria-pressed',String(b.dataset.key===t.key));});
 const shape=t.display_shape||[768,432],ratio=Math.max(1.25,shape[0]/shape[1]);
 $('#train-example').innerHTML=`<div class="training-video-pair">${[['Source','Object absent',v.source,v.sourcePoster],['Target','Object present',v.target,v.targetPoster]].map(([label,note,url,poster])=>`<figure class="training-video"><figcaption><b>${label}</b><span>${note}</span></figcaption><div style="aspect-ratio:${ratio}">${videoHTML(url,poster,`aria-label="${esc(t.name)} training ${label.toLowerCase()} video"`)}</div></figure>`).join('')}</div>${controlHTML()}`;
 trainPlayer=new Player($('#train-example'),true);trainPlayer.onProgress=highlightChunk;renderPrompt();
}
function highlightChunk(p){
 if(promptLevel!=='p4')return;const n=training.p4.frame_count,frame=Math.min(n-1,Math.floor(p*n));
 $('#prompt-text').querySelectorAll('.chunk').forEach((e,i)=>{const s=training.p4.segments[i];e.classList.toggle('current',frame>=s.start_frame&&frame<s.end_frame_exclusive);});
 const marker=$('#prompt-text .timeline-marker');if(marker)marker.style.left=(p*100)+'%';
}
function renderPrompt(){
 const t=training;$('#prompt-tabs').querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b.dataset.key===promptLevel);b.setAttribute('aria-pressed',String(b.dataset.key===promptLevel));});
 $('#prompt-text').innerHTML=promptLevel==='p0'?'<p class="prompt-note">No text.</p>':promptLevel==='p4'?`<p class="prompt-prefix">${esc(t.p1)}</p><div class="prompt-timeline" aria-label="P4 chunk intervals">${t.p4.segments.map((s,i)=>`<span style="flex:${s.end_frame_exclusive-s.start_frame};--chunk-index:${i}"></span>`).join('')}<i class="timeline-marker"></i></div>${t.p4.segments.map((s,i)=>`<button type="button" class="chunk" data-chunk="${i}" title="Play this interval"><time>${s.start_frame}–${s.end_frame_exclusive-1}<small>frames</small></time><span>${esc(s.prompt)}</span></button>`).join('')}<p class="prompt-note">Click a chunk to play its interval.${t.p4.segments.length===1?' One interval covers the full clip.':' The active chunk follows the video.'}</p>`:`<p>${esc(t[promptLevel])}</p>`;
 $('#prompt-text').querySelectorAll('[data-chunk]').forEach(b=>b.onclick=()=>{trainPlayer.load();trainPlayer.seek(t.p4.segments[+b.dataset.chunk].start_frame/t.p4.frame_count);trainPlayer.userPaused=false;trainPlayer.play();});highlightChunk(trainPlayer?.p||0);
}
renderTraining();
// Diagram-aligned illustrative stages; tooltips retain actual P4 prompts and intervals.
const methodInfo=D.methodDemo,methodCase=D.gallery.find(c=>c.id===methodInfo.caseId),methodRoot=$('#method-demo');
methodRoot.innerHTML=`<div class="method-demo-grid">
 <div class="method-demo-inputs"><figure class="method-demo-video"><figcaption>Source video</figcaption>${videoHTML(methodCase.source,methodCase.sourcePoster,'aria-label="Mug example source video"')}</figure><div class="method-demo-first"><img src="${esc(methodCase.e0)}" alt="Edited first frame with the mug"><div><span>Edited first frame</span><p>P1 level prompt: ${esc(methodCase.prompt)}</p></div></div></div>
 <div class="method-demo-guidance"><h3>P4 interaction guidance</h3><div class="method-demo-chunks">${methodInfo.segments.map((s,i)=>`<button type="button" data-phase="${i}" style="--phase-bg:${['#e4eff5','#eee7f4','#f7ecd9'][i]};--phase-ink:${['#427791','#795890','#9b763c'][i]}" title="Predicted P4 · Frames ${s.start}–${s.end-1}: ${esc(s.fullText)}"><span class="method-phase-number">${i+1}</span><span>${esc(s.text)}</span><i class="method-phase-fill" aria-hidden="true"></i></button>`).join('')}</div><p class="method-demo-note">Illustrative stages. Hover for predicted prompts; click to play.</p></div>
 <figure class="method-demo-video method-demo-output"><figcaption>ALIVE</figcaption>${videoHTML(methodCase.result,methodCase.resultPoster,'aria-label="Mug edited video guided by predicted P4"')}</figure>
 </div>${controlHTML()}`;
const methodPlayer=new Player(methodRoot,true,.3);
methodPlayer.speed.value='0.5';
methodPlayer.onProgress=p=>{
 const frame=Math.min(methodInfo.frames-1,p*methodInfo.frames);
 methodRoot.querySelectorAll('[data-phase]').forEach((b,i)=>{
  const s=methodInfo.segments[i],active=frame>=s.start&&frame<s.end;
  b.classList.toggle('current',active);b.setAttribute('aria-pressed',String(active));
  b.style.setProperty('--phase-progress',`${Math.max(0,Math.min(1,(frame-s.start)/(s.end-s.start)))*100}%`);
 });
};
methodRoot.querySelectorAll('[data-phase]').forEach((b,i)=>{b.onclick=()=>{methodPlayer.load();methodPlayer.seek(methodInfo.segments[i].start/methodInfo.frames);methodPlayer.userPaused=false;methodPlayer.play();};});
methodPlayer.onProgress(0);
const baselineChoices=[['senorita','Señorita'],['novaedit','NovaEdit'],['i2vedit','I2VEdit'],['anyv2v','AnyV2V'],['propfly','PropFly']];
$('#comparison-links').innerHTML=baselineChoices.map(([id,name])=>`<a class="comparison-link" href="comparison.html?rev=github-pages-20261006#method=${id}"><span>ALIVE vs.</span><strong>${name}</strong><small>View comparisons <b aria-hidden="true">↗</b></small></a>`).join('')+`<a class="comparison-link all" href="comparison.html?rev=github-pages-20261006#method=all"><span>Source + five baselines + ALIVE</span><strong>All methods</strong><small>View together <b aria-hidden="true">↗</b></small></a>`;
let benchmark=0;
D.tables.forEach((t,i)=>{const b=document.createElement('button');b.textContent=(i===0?'ALIVE-interaction':'General insertion')+' · '+t.n;b.onclick=()=>{benchmark=i;renderTable();};b.dataset.index=i;$('#benchmark-tabs').append(b);});
function renderTable(){const t=D.tables[benchmark],rank=D.metrics.map((_,i)=>[...new Set(t.rows.map(r=>Number(r.values[i])))].sort((a,b)=>b-a));$('#benchmark-tabs').querySelectorAll('button').forEach(b=>{b.classList.toggle('active',+b.dataset.index===benchmark);b.setAttribute('aria-pressed',String(+b.dataset.index===benchmark));});$('#results-table').innerHTML=`<div class="table-scroll ${$('#automatic-metrics').checked?'show-auto':''}" tabindex="0" role="region" aria-label="${esc(t.name)} results"><table><thead><tr><th scope="col">Method</th><th scope="col">Guidance</th>${D.metrics.map((m,i)=>`<th scope="col" class="${i>2?'automatic':''}">${esc(m)} ↑</th>`).join('')}</tr></thead><tbody>${t.rows.map(r=>`<tr class="${r.method.startsWith('ALIVE')?'ours':''}"><td>${esc(r.method)}</td><td>${esc(r.guidance)}</td>${r.values.map((v,i)=>`<td class="${i>2?'automatic ':''}${+v===rank[i][0]?'best':+v===rank[i][1]?'second':''}">${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
$('#automatic-metrics').onchange=renderTable;renderTable();
document.addEventListener('visibilitychange',()=>{players.forEach(p=>{if(document.hidden)p.pause();else if(p instanceof StackedPlayer)p.resume();});});

// Highlight the section actually being read, including ordinary scrolling.
const sectionLinks=[...document.querySelectorAll('.topbar a[href^="#"], .hero-section-links a[href^="#"]')].filter(a=>a.hash.length>1&&document.querySelector(a.hash));
const sectionTargets=[...new Set(sectionLinks.map(a=>document.querySelector(a.hash)))];
const topbar=document.querySelector('.topbar');
let sectionFrame=0;
function updateCurrentSection(){
 sectionFrame=0;
 const threshold=topbar.getBoundingClientRect().bottom+80;
 let current='';
 for(const section of sectionTargets){if(section.getBoundingClientRect().top<=threshold)current='#'+section.id;}
 for(const a of sectionLinks){
  const active=a.hash===current;a.classList.toggle('is-current',active);
  if(active)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');
 }
}
function scheduleSectionUpdate(){if(!sectionFrame)sectionFrame=requestAnimationFrame(updateCurrentSection);}
window.addEventListener('scroll',scheduleSectionUpdate,{passive:true});
window.addEventListener('hashchange',scheduleSectionUpdate);
window.addEventListener('load',scheduleSectionUpdate);
window.addEventListener('resize',scheduleSectionUpdate,{passive:true});
new ResizeObserver(()=>{document.documentElement.style.setProperty('--nav-offset',`${topbar.getBoundingClientRect().height+20}px`);scheduleSectionUpdate();}).observe(topbar);
new ResizeObserver(scheduleSectionUpdate).observe(document.querySelector('main'));
updateCurrentSection();
