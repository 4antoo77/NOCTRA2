/* ANTOO PELIS: fullscreen for Movi Player on phones/tablets.
 * Uses ONLY Movi's existing fullscreen and back controls.
 * Rotation alone can fill the page viewport; true OS fullscreen/rotation
 * depends on the browser. No extra video controls are added.
 */
(()=>{
 'use strict';
 const dialog=document.getElementById('player');
 const frame=document.getElementById('frame-container');
 if(!dialog||!frame)return;

 const mobile=()=>/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||
   (/Macintosh/i.test(navigator.userAgent)&&navigator.maxTouchPoints>1)||
   (matchMedia('(pointer: coarse)').matches&&Math.min(innerWidth,innerHeight)<1000);
 const landscape=()=>matchMedia('(orientation: landscape)').matches;
 const actualFullscreen=()=>document.fullscreenElement||document.webkitFullscreenElement||null;
 const ourFullscreen=()=>{const el=actualFullscreen();return !!el&&(el===frame||el===playing||frame.contains(el));};

 let playing=null;
 let mode='none'; // none, auto (turned phone), manual (Movi fullscreen button)
 let native=false, nativePending=false, pendingId=0, lockId=0, locked=false;
 let suppressAuto=false;
 let returnToInfo=null, backAfterClose=null;

 function setReturnInfo(callback){returnToInfo=typeof callback==='function'?callback:null;}
 function unlock(){
   ++lockId;
   if(locked){locked=false;try{screen.orientation?.unlock?.();}catch{}}
 }
 function refreshOrientation(){
   const portrait=!landscape();
   // If orientation locking isn't allowed, rotating the fallback player
   // presents landscape video and its ORIGINAL controls, not an extra button.
   dialog.classList.toggle('noctra-fullscreen-rotated',
     mode==='manual'&&!native&&mobile()&&portrait);
   frame.classList.toggle('noctra-native-rotated',
     mode==='manual'&&native&&mobile()&&portrait&&!locked);
 }
 function lockLandscape(){
   if(!mobile()||!ourFullscreen())return;
   const gen=++lockId;
   if(typeof screen?.orientation?.lock!=='function'){
     refreshOrientation();
     return;
   }
   try{
     Promise.resolve(screen.orientation.lock('landscape')).then(()=>{
       if(gen!==lockId)return;
       locked=true;refreshOrientation();
     }).catch(()=>{if(gen===lockId){locked=false;refreshOrientation();}});
   }catch{if(gen===lockId){locked=false;refreshOrientation();}}
 }
 function showHost(nextMode){
   if(!playing||!dialog.open)return;
   mode=nextMode;native=false;nativePending=false;
   dialog.classList.add('noctra-fullscreen-host');
   document.documentElement.classList.add('noctra-fullscreen-lock');
   refreshOrientation();
   try{playing.setHostFullscreen?.(true);}catch{}
 }
 function restore({exitNative=false}={}){
   const current=playing, wasNative=native;
   ++pendingId;nativePending=false;native=false;mode='none';
   dialog.classList.remove('noctra-fullscreen-host','noctra-fullscreen-rotated');
   frame.classList.remove('noctra-fullscreen-native','noctra-native-rotated');
   document.documentElement.classList.remove('noctra-fullscreen-lock');
   unlock();
   try{current?.setHostFullscreen?.(false);}catch{}
   if(exitNative&&wasNative&&ourFullscreen()){
     try{Promise.resolve(document.exitFullscreen?.()).catch(()=>{});}catch{}
   }
 }
 function enterManual(){
   if(!playing||!dialog.open)return;
   suppressAuto=false;
   mode='manual';
   const id=++pendingId;
   const request=frame.requestFullscreen||frame.webkitRequestFullscreen;
   if(!request){showHost('manual');return;}
   nativePending=true;
   let promise;
   // Keep this call synchronous with Movi's original fullscreen-button click.
   try{promise=request.call(frame,{navigationUI:'hide'});}
   catch{nativePending=false;showHost('manual');return;}
   Promise.resolve(promise).then(()=>{
     if(id!==pendingId)return;
     nativePending=false;
     if(!playing||!dialog.open){
       if(ourFullscreen())Promise.resolve(document.exitFullscreen?.()).catch(()=>{});
       return;
     }
     if(ourFullscreen()){
       native=true;mode='manual';
       frame.classList.add('noctra-fullscreen-native');
       try{playing.setHostFullscreen?.(true);}catch{}
       lockLandscape();refreshOrientation();
     }else showHost('manual');
   }).catch(()=>{if(id===pendingId){nativePending=false;showHost('manual');}});
 }
 function syncRotation(){
   if(!playing||!dialog.open||!mobile())return;
   if(!landscape()){
     suppressAuto=false;
     if(mode==='auto'&&!native&&!nativePending)restore();
   }else if(mode==='none'&&!ourFullscreen()&&!suppressAuto){
     // Physical rotation does not carry user activation, so a native
     // requestFullscreen() would fail. Fill the dialog viewport instead.
     showHost('auto');
   }
   if(mode!=='none')refreshOrientation();
 }
 function back(event,element){
   if(element!==playing)return;
   event?.preventDefault?.();
   backAfterClose=returnToInfo;
   try{element.exitFullscreen?.();}catch{}
   if(dialog.open)dialog.close();
 }
 function attach(element){
   if(!element||element.tagName!=='MOVI-PLAYER')return;
   restore();
   playing=element;
   suppressAuto=false;
   element.setAttribute('showtitle','');
   element.setAttribute('titlemode','both back');
   element.addEventListener('back',event=>back(event,element));
   element.addEventListener('movi-fullscreen-request',event=>{
     if(playing!==element||!mobile()||!event.cancelable)return;
     event.preventDefault();
     enterManual();
   });
   element.addEventListener('fullscreenchange',event=>{
     if(playing!==element)return;
     if(event.detail?.fullscreen===false&&mode!=='none'&&!nativePending){
       suppressAuto=landscape();
       restore({exitNative:true});
     }else if(event.detail?.fullscreen===true&&ourFullscreen()){
       native=true;lockLandscape();refreshOrientation();
     }
   });
   syncRotation();
 }
 function onFullscreenChange(){
   if(!playing)return;
   if(ourFullscreen()){
     native=true;
     frame.classList.add('noctra-fullscreen-native');
     lockLandscape();refreshOrientation();
   }else if(native&&!nativePending){
     // The user exited the native browser fullscreen; keep the film open.
     suppressAuto=landscape();
     restore();
   }
 }
 document.addEventListener('fullscreenchange',onFullscreenChange);
 document.addEventListener('webkitfullscreenchange',onFullscreenChange);
 window.addEventListener('orientationchange',syncRotation);
 window.addEventListener('resize',syncRotation);
 window.visualViewport?.addEventListener('resize',syncRotation);
 dialog.addEventListener('close',()=>{
   const go=backAfterClose||returnToInfo;
   restore({exitNative:true});
   playing=null;backAfterClose=null;returnToInfo=null;
   if(go)setTimeout(()=>{try{go();}catch(e){console.warn('ANTOO PELIS back:',e);}},190);
 });
 dialog.addEventListener('cancel',event=>{
   if(!playing)return;
   event.preventDefault();back(event,playing);
 });
 document.addEventListener('keydown',event=>{
   if(!dialog.open||!playing||!['Backspace','BrowserBack','Escape'].includes(event.key))return;
   if(event.target?.matches?.('input,textarea,[contenteditable="true"]'))return;
   // Escape while fullscreen should exit fullscreen first, not leave the film.
   if(event.key==='Escape'&&(mode!=='none'||ourFullscreen())){
     event.preventDefault();event.stopPropagation();
     suppressAuto=landscape();restore({exitNative:true});return;
   }
   event.preventDefault();event.stopPropagation();back(event,playing);
 },true);
 window.noctraPlayerFullscreen={attach,setReturnInfo};
})();
