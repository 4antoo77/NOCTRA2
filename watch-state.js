/* ANTOO PELIS · progreso sincronizado, actividad y episodios. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 let queue=null,active=null,timer=0,overlay=null,lastSaved=0,lastSync=0,syncing=null;
 const account=()=>String(window.noctraCloud?.user?.id||'anonymous');
 const storageKey=()=>`noctra2.watch-progress.${account()}`;
 const read=()=>{try{const v=JSON.parse(localStorage.getItem(storageKey())||'[]');return Array.isArray(v)?v.filter(x=>x&&x.fileId&&Number(x.position)>0):[];}catch{return [];}};
 function write(items){try{localStorage.setItem(storageKey(),JSON.stringify(items.slice(0,100)));}catch(e){console.warn('ANTOO PELIS: no se pudo guardar el progreso.',e);}}
 const mediaId=m=>'gdrive-'+String(m?.fileId||'');
 function api(){return window.noctraCloud?.request;}
 async function syncFromServer(){
   if(!window.noctraCloud?.user||!api())return;
   if(syncing)return syncing;
   syncing=(async()=>{
     try{
       const data=await api()('/api/watch/progress');
       const remote=Array.isArray(data.progress)?data.progress:[],local=read(),byId=new Map(remote.map(x=>[String(x.fileId),x]));
       for(const item of local){const id=String(item.fileId),server=byId.get(id);if(!server||Number(item.updated||0)>Number(server.updated||0)){
         await api()('/api/watch/progress',{method:'POST',body:{mediaId:'gdrive-'+id,position:Number(item.position)||0,duration:Number(item.duration)||0}});
         byId.set(id,item);
       }}
       const merged=[...byId.entries()].map(([fileId,x])=>({fileId,position:Number(x.position)||0,duration:Number(x.duration)||0,updated:Number(x.updated)||Date.now()})).filter(x=>x.position>0&&!(x.duration>0&&x.position/x.duration>=.96)).sort((a,b)=>b.updated-a.updated).slice(0,100);
       write(merged);lastSync=Date.now();render();
     }catch(e){console.warn('ANTOO PELIS: no se pudo sincronizar el progreso.',e);}
     finally{syncing=null;}
   })();return syncing;
 }
 function sendEvent(type,media,errorCode=''){
   const send=api();if(!send||!media?.fileId)return;
   void send('/api/watch/event',{method:'POST',body:{type,mediaId:mediaId(media),...(type==='error'?{errorCode}:{})}}).catch(e=>console.warn('ANTOO PELIS: no se pudo registrar la actividad.',e));
 }
 const escapeHTML=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function render(){
   const section=$('noctra-continue'),grid=$('noctra-continue-grid');
   if(!section||!grid)return;
   const catalog=window.noctraCloud?.movies||[];
   const byId=new Map(catalog.map(m=>[String(m.fileId),m]));
   const entries=read().filter(x=>byId.has(String(x.fileId)))
     .sort((a,b)=>Number(b.updated||0)-Number(a.updated||0)).slice(0,8);
   grid.replaceChildren();section.hidden=!entries.length||!document.body.classList.contains('antoo-home-page');
   for(const entry of entries){
     const m=byId.get(String(entry.fileId));
     const card=document.createElement('article');card.className='noctra-continue-card';
     const button=document.createElement('button');button.type='button';button.className='noctra-continue-play';
     button.setAttribute('aria-label','Continuar '+(m.episodeTitle||m.title));
     if(m.poster){const img=document.createElement('img');img.src=typeof posterURL==='function'?posterURL(m.poster):m.poster;img.alt='';img.loading='lazy';button.append(img);}
     const body=document.createElement('span');body.className='noctra-continue-info';
     const heading=document.createElement('strong');heading.textContent=m.seriesName?(m.seriesTitle||m.seriesName):m.title;
     const sub=document.createElement('span');sub.textContent=m.seriesName?(m.episodeTitle||m.title):'Película';
     const progress=document.createElement('span');progress.className='noctra-continue-track';
     const fill=document.createElement('span');fill.style.width=Math.max(2,Math.min(99,Number(entry.duration)>0?Number(entry.position)/Number(entry.duration)*100:2))+'%';progress.append(fill);
     const resume=document.createElement('span');resume.className='noctra-continue-resume';resume.textContent='▶ Continuar';
     body.append(heading,sub,progress,resume);button.append(body);
     button.onclick=()=>window.noctraCloud?.play(m,{resumeAt:Math.max(0,Number(entry.position)||0)});
     card.append(button);grid.append(card);
   }
 }
 function setQueue(items,current,name,season){
   const index=items.findIndex(m=>String(m.fileId)===String(current?.fileId));
   queue=index<0?null:{items,index,name,season};
 }
 function clearOverlay(){overlay?.remove();overlay=null;}
 function next(){
   if(!queue||queue.index+1>=queue.items.length)return;
   const m=queue.items[queue.index+1];queue.index++;
   window.antooRoutes?.episode?.(m,queue.name,queue.items,String(queue.season));
   window.noctraCloud?.play(m);
 }
 function save(force=false){
   if(!active)return;
   const now=Date.now();if(!force&&now-lastSaved<9000)return;
   let position=0,duration=0;
   try{position=Number(active.player.currentTime)/active.timeScale;duration=Number(active.player.getDuration?.())/active.timeScale;}catch{}
   if(!Number.isFinite(position)||position<1)return;
   lastSaved=now;
   const list=read().filter(x=>String(x.fileId)!==String(active.media.fileId));
   if(duration>0&&position/duration>=.96){write(list);render();if(!active.completed){active.completed=true;sendEvent('complete',active.media);void api()?.('/api/watch/progress',{method:'POST',body:{mediaId:mediaId(active.media),position,duration,completed:true}}).catch(()=>{});}return;}
   list.unshift({fileId:String(active.media.fileId),position:Math.round(position),duration:Math.round(duration),updated:now});
   write(list);render();
   if(force||now-lastSync>15000){lastSync=now;void api()?.('/api/watch/progress',{method:'POST',body:{mediaId:mediaId(active.media),position,duration}}).catch(e=>console.warn('ANTOO PELIS: no se pudo guardar el progreso en el servidor.',e));}
 }
 function update(){
   if(!active)return;
   save();
   const p=active.player;let position=0,duration=0,status=0;
   try{position=Number(p.currentTime)/1000;duration=Number(p.getDuration?.())/1000;status=Number(p.getStatus?.());}catch{}
   const hasNext=!!queue&&String(queue.items[queue.index]?.fileId)===String(active.media.fileId)&&queue.index+1<queue.items.length;
   if(!hasNext||!overlay)return;
   const remaining=duration-position;
   const shouldShow=status===7||(Number.isFinite(remaining)&&remaining>0&&remaining<=90);
   overlay.hidden=!shouldShow;
   if(shouldShow){
     const nextItem=queue.items[queue.index+1];
     overlay.querySelector('strong').textContent='Siguiente episodio · '+(nextItem.episodeTitle||nextItem.title);
   }
 }
 function attach(player,{media,resumeAt=0,timeScale=1000}={}){
   detach();if(!player||!media?.fileId)return;
   const saved=read().find(x=>String(x.fileId)===String(media.fileId));
   active={player,media,timeScale:Number(timeScale)||1000,completed:false};lastSaved=0;
   sendEvent('play',media);
   if(!queue||String(queue.items[queue.index]?.fileId)!==String(media.fileId))queue=null;
   overlay=document.createElement('button');overlay.type='button';overlay.className='noctra-next-episode';overlay.hidden=true;
   overlay.innerHTML='<span></span><strong>Siguiente episodio</strong><span aria-hidden="true">▶</span>';
   overlay.onclick=next;
   $('frame-container')?.append(overlay);
   if(Number(resumeAt)>0&&saved){write(read().filter(x=>String(x.fileId)!==String(media.fileId)));render();}
   timer=setInterval(update,1000);
 }
 function detach(player){
   if(player&&active?.player!==player)return;
   if(active){save(true);clearInterval(timer);timer=0;active=null;}
   clearOverlay();
 }
 window.addEventListener('pagehide',()=>save(true));
 window.noctraWatchState={render,setQueue,attach,detach,syncFromServer,reportError(media,code='PLAYER_ERROR'){sendEvent('error',media,code);},resume(media){
   const item=read().find(x=>String(x.fileId)===String(media?.fileId));
   if(media)window.noctraCloud?.play(media,{resumeAt:Number(item?.position)||0});
 }};
})();
