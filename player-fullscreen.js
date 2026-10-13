/* ANTOO PELIS | Movi Player fullscreen (no extra player buttons).
   Genuine OS fullscreen on capable browsers, native iPhone video when available;
   viewport-only fallback for iPhone canvas/MKV where WebKit blocks fullscreen. */
(()=>{
 'use strict';
 const dlg=document.getElementById('player'), frame=document.getElementById('frame-container');
 if(!dlg||!frame)return;
 const ua=navigator.userAgent||'';
 const ios=/iPad|iPhone|iPod/i.test(ua)||(/Macintosh/i.test(ua)&&navigator.maxTouchPoints>1);
 const mobile=ios||/Android/i.test(ua)||matchMedia('(pointer: coarse)').matches;
 const landscape=()=>matchMedia('(orientation:landscape)').matches;
 const fullscreenNode=()=>document.fullscreenElement||document.webkitFullscreenElement||null;
 const ourFullscreen=()=>{const el=fullscreenNode();return !!el&&(el===frame||el===player||frame.contains(el));};
 let player=null,mode='none',requestId=0,rotationId=0,locked=false;
 let suppressAuto=false,returnToInfo=null,returnAfterClose=null;
 function setReturnInfo(fn){returnToInfo=typeof fn==='function'?fn:null;}
 function backToInfo(){
   returnAfterClose=returnToInfo;
   try{player?.exitFullscreen?.();}catch{}
   try{Promise.resolve(document.exitFullscreen?.()||document.webkitExitFullscreen?.()).catch(()=>{});}catch{}
   if(dlg.open)dlg.close();
 }
 let backHideTimer=0;
 function fullscreenActive(){
   return mode!=='none'||ourFullscreen()||dlg.classList.contains('noctra-fullscreen-host')
     ||dlg.classList.contains('antoo-avplayer-immersive');
 }
 function wakeBackButton(){
   const button=frame.querySelector(':scope > .antoo-player-back');
   if(!button)return;
   clearTimeout(backHideTimer);
   button.classList.remove('antoo-player-back-hidden');
   if(!dlg.open||!fullscreenActive())return;
   backHideTimer=setTimeout(()=>{
     if(button.isConnected&&fullscreenActive())button.classList.add('antoo-player-back-hidden');
   },2600);
 }
 function mountBackButton(){
   let button=frame.querySelector(':scope > .antoo-player-back');
   if(!button){
     button=document.createElement('button');
     button.type='button';button.className='antoo-player-back';
     button.setAttribute('aria-label','Regresar a la información');
     button.innerHTML='<span aria-hidden="true">‹</span><span>Regresar</span>';
     button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();backToInfo();});
     frame.append(button);
   }
   wakeBackButton();
   return button;
 }
 frame.addEventListener('pointerdown',wakeBackButton,true);
 frame.addEventListener('touchstart',wakeBackButton,{capture:true,passive:true});
 frame.addEventListener('pointermove',e=>{if(e.pointerType==='mouse')wakeBackButton();},{passive:true});
 document.addEventListener('fullscreenchange',wakeBackButton);
 document.addEventListener('webkitfullscreenchange',wakeBackButton);
 new MutationObserver(wakeBackButton).observe(dlg,{attributes:true,attributeFilter:['class']});
 const onFullscreen=()=>mode!=='none';
 function unlock(){
   ++rotationId;
   if(locked){locked=false;try{screen.orientation?.unlock?.();}catch{}}
 }
 function rotateFallback(){
   const portrait=!landscape();
   dlg.classList.toggle('antoo-fs-rotated',mode==='manual'&&portrait&&mobile);
   frame.classList.toggle('antoo-fs-native-rotated',mode==='native'&&portrait&&mobile&&!locked);
 }
 function lockOrientation(){
   if(!ourFullscreen()||!mobile)return;
   const id=++rotationId;
   if(typeof screen.orientation?.lock!=='function'){rotateFallback();return;}
   try{
     Promise.resolve(screen.orientation.lock('landscape')).then(()=>{
       if(id!==rotationId)return;
       locked=true;rotateFallback();
     },()=>{if(id===rotationId){locked=false;rotateFallback();}});
   }catch{if(id===rotationId){locked=false;rotateFallback();}}
 }
 function reset(opts={}){
   const previous=mode;
   ++requestId;mode='none';
   dlg.classList.remove('noctra-fullscreen-host','antoo-fs-rotated');
   frame.classList.remove('noctra-fullscreen-native','antoo-fs-native-rotated');
   document.documentElement.classList.remove('noctra-fullscreen-lock');
   unlock();
   if(opts.exitNative&&previous==='native'&&ourFullscreen()){
     try{Promise.resolve(document.exitFullscreen?.()||document.webkitExitFullscreen?.()).catch(()=>{});}catch{}
   }
   if(opts.exitNative&&previous==='video'){
     try{activeNativeVideo()?.webkitExitFullscreen?.();}catch{}
   }
   if(previous!=='none')try{player?.setHostFullscreen?.(false);}catch{}
 }
 function activeNativeVideo(){
   // Only a real, decoded HTML video should go through Apple's native UI.
   // MKV/canvas playback must keep using Movi's original controls.
   try{
     const videos=[...player?.shadowRoot?.querySelectorAll('video')||[]];
     return videos.find(v=>v.readyState>=2&&v.videoWidth>0&&
       typeof v.webkitEnterFullscreen==='function'&&v.webkitSupportsFullscreen!==false&&
       getComputedStyle(v).display!=='none');
   }catch{return null;}
 }
 function hostFullscreen(kind){
   if(!player||!dlg.open)return;
   mode=kind;dlg.classList.add('noctra-fullscreen-host');
   document.documentElement.classList.add('noctra-fullscreen-lock');
   rotateFallback();
   try{player.setHostFullscreen?.(true);}catch{}
 }
 function manualFullscreen(){
   if(!player||!dlg.open)return;
   suppressAuto=false;
   const id=++requestId;
   // iPhone's only genuinely native fullscreen target is an HTMLVideoElement.
   // Movi sometimes uses it for MP4; MKV/WebCodecs often renders to canvas.
   if(ios){
     const video=activeNativeVideo();
     if(video){
       try{
         video.webkitEnterFullscreen();
         mode='video';
         try{player.setHostFullscreen?.(true);}catch{}
         return;
       }catch{}
     }
   }
   const request=frame.requestFullscreen||frame.webkitRequestFullscreen;
   if(!request){hostFullscreen('manual');return;}
   let result;
   try{result=request.call(frame,{navigationUI:'hide'});}
   catch{hostFullscreen('manual');return;}
   // No await before requestFullscreen: it must run in the player's click gesture.
   Promise.resolve(result).then(()=>{
     if(id!==requestId)return;
     if(!player||!dlg.open){
       if(ourFullscreen())try{document.exitFullscreen?.();}catch{}
       return;
     }
     if(ourFullscreen()){
       mode='native';frame.classList.add('noctra-fullscreen-native');
       try{player.setHostFullscreen?.(true);}catch{}
       lockOrientation();rotateFallback();
     }else hostFullscreen('manual');
   },()=>{if(id===requestId)hostFullscreen('manual');});
 }
 function syncRotation(){
   if(!mobile||!dlg.open||!player)return;
   if(landscape()){
     if(mode==='none'&&!ourFullscreen()&&!suppressAuto)hostFullscreen('auto');
   }else{
     suppressAuto=false;
     if(mode==='auto')reset();
   }
   if(onFullscreen())rotateFallback();
 }
 function goBack(e,instance){
   if(instance!==player)return;
   e?.preventDefault?.();
   returnAfterClose=returnToInfo;
   // Return to the movie/episode sheet, never accidentally exit to the catalog.
   try{player.exitFullscreen?.();}catch{}
   if(dlg.open)dlg.close();
 }
 function attach(instance){
   if(!instance||instance.tagName!=='MOVI-PLAYER')return;
   reset({exitNative:true});
   player=instance;suppressAuto=false;mountBackButton();
   instance.setAttribute('showtitle','');
   instance.setAttribute('titlemode','both back');
   instance.addEventListener('back',e=>goBack(e,instance));
   instance.addEventListener('movi-fullscreen-request',e=>{
     if(instance!==player||!mobile||!e.cancelable)return;
     e.preventDefault();
     manualFullscreen();
   });
   instance.addEventListener('fullscreenchange',e=>{
     if(instance!==player)return;
     if(e.detail?.fullscreen===false&&mode!=='none'){
       if(mode==='video'){reset();return;}
       suppressAuto=landscape();reset({exitNative:true});
     }else if(e.detail?.fullscreen===true&&ourFullscreen()){
       mode='native';lockOrientation();rotateFallback();
     }
   });
   try{
     instance.shadowRoot?.querySelectorAll('video').forEach(video=>{
       video.addEventListener('webkitendfullscreen',()=>{if(mode==='video')reset();});
     });
   }catch{}
   syncRotation();
 }
 function onNativeChange(){
   if(ourFullscreen()){
     if(mode!=='native')mode='native';
     frame.classList.add('noctra-fullscreen-native');
     lockOrientation();rotateFallback();
   }else if(mode==='native'){
     suppressAuto=landscape();reset();
   }
 }
 document.addEventListener('fullscreenchange',onNativeChange);
 document.addEventListener('webkitfullscreenchange',onNativeChange);
 window.addEventListener('orientationchange',syncRotation);
 window.addEventListener('resize',syncRotation);
 window.visualViewport?.addEventListener('resize',syncRotation);
 dlg.addEventListener('close',()=>{
   const back=returnAfterClose||returnToInfo;
   reset({exitNative:true});player=null;returnAfterClose=null;returnToInfo=null;
   if(back)setTimeout(()=>{try{back();}catch(e){console.warn('ANTOO PELIS back:',e);}},170);
 });
 dlg.addEventListener('cancel',e=>{if(!player)return;e.preventDefault();goBack(e,player);});
 document.addEventListener('keydown',e=>{
   if(!dlg.open||!player||!['Escape','BrowserBack','Backspace'].includes(e.key))return;
   if(e.target?.matches?.('input,textarea,[contenteditable="true"]'))return;
   e.preventDefault();e.stopPropagation();
   if(e.key==='Escape'&&(mode!=='none'||ourFullscreen())){
     suppressAuto=landscape();reset({exitNative:true});
   }else goBack(e,player);
 },true);
 window.noctraPlayerFullscreen={attach,setReturnInfo,mountBackButton,backToInfo};
})();
