/* NOCTRA2 | Movi Player: landscape in fullscreen where supported, and back
 * navigation using Movi's OWN title-bar arrow. No extra movie controls.
 * Safari iOS does not generally expose orientation locking; do not rotate
 * the whole player sideways to pretend that the device itself has turned.
 */
(()=>{
 'use strict';
 const dialog=document.getElementById('player');
 const frame=document.getElementById('frame-container');
 if(!dialog||!frame)return;
 const isIOS=()=>{
   const ua=navigator.userAgent||'';
   return /iPad|iPhone|iPod/i.test(ua)||
     (/Macintosh/i.test(ua)&&navigator.maxTouchPoints>1);
 };
 let playing=null,hostMode=false,usingNative=false;
 let fullscreenAttempt=0,autoLandscape=false;
 let returnToInfo=null,returnAfterClose=null;
 // Set by the movie/series selection before playback begins.
 function setReturnInfo(callback){returnToInfo=typeof callback==='function'?callback:null;}
 let orientationState='idle',orientationGeneration=0;
 const nativeElement=()=>document.fullscreenElement||document.webkitFullscreenElement||null;
 const ourNativeFullscreen=()=>{
   const element=nativeElement();
   return !!element&&(element===frame||element===playing||
     (typeof frame.contains==='function'&&frame.contains(element)));
 };
 function unlockLandscape(){
   ++orientationGeneration;
   const wasLocked=orientationState==='locked';
   orientationState='idle';
   if(wasLocked)try{screen.orientation?.unlock?.();}catch{}
 }
 function lockLandscape(){
   // Mobile browsers generally require fullscreen before locking orientation.
   if(orientationState!=='idle'||typeof screen==='undefined'||
      typeof screen.orientation?.lock!=='function')return;
   orientationState='pending';
   const generation=orientationGeneration;
   let result;
   try{result=screen.orientation.lock('landscape');}
   catch{orientationState='idle';return;}
   Promise.resolve(result).then(()=>{
     if(generation!==orientationGeneration){
       // A previous fullscreen has closed. Avoid undoing a newer lock.
       if(!dialog.open&&!nativeElement())try{screen.orientation?.unlock?.();}catch{}
       return;
     }
     orientationState='locked';
   }).catch(()=>{
     if(generation===orientationGeneration)orientationState='idle';
   });
 }
 function clearHost(){
   dialog.classList.remove('noctra-fullscreen-host');
   frame.classList.remove('noctra-fullscreen-native');
   document.documentElement.classList.remove('noctra-fullscreen-lock');
   hostMode=false;usingNative=false;
 }
 function endFullscreen(){
   ++fullscreenAttempt;
   const native=ourNativeFullscreen();
   const current=playing;
   clearHost();unlockLandscape();
   if(native){
     try{Promise.resolve(document.exitFullscreen?.()).catch(()=>{});}catch{}
   }
   try{current?.setHostFullscreen?.(false);}catch{}
 }
 function fallback(){
   if(!playing||!dialog.open)return;
   hostMode=true;usingNative=false;
   dialog.classList.add('noctra-fullscreen-host');
   document.documentElement.classList.add('noctra-fullscreen-lock');
   playing.setHostFullscreen?.(true);
   lockLandscape();
 }
 function requestHostFullscreen(){
   const attempt=++fullscreenAttempt;
   // Native fullscreen + lock where available; true orientation is OS-controlled.
   if(document.fullscreenEnabled&&typeof frame.requestFullscreen==='function'){
     let pending;
     try{pending=frame.requestFullscreen({navigationUI:'hide'});}
     catch{fallback();return;}
     Promise.resolve(pending).then(()=>{
       if(attempt!==fullscreenAttempt)return;
       if(!playing||!dialog.open){
         if(nativeElement()===frame)Promise.resolve(document.exitFullscreen?.()).catch(()=>{});
         return;
       }
       hostMode=true;usingNative=true;
       frame.classList.add('noctra-fullscreen-native');
       playing.setHostFullscreen?.(true);
       lockLandscape();
     }).catch(()=>{if(attempt===fullscreenAttempt)fallback();});
   }else fallback();
 }
 function isLandscape(){return window.matchMedia?.('(orientation: landscape)')?.matches || window.innerWidth>window.innerHeight;}
 function syncRotation(){
   if(!playing||!dialog.open)return;
   if(isLandscape()){
     // Orientation events have no user activation: native requestFullscreen()
     // would be rejected. Use a fullscreen-sized modal player instead.
     if(!hostMode&&!ourNativeFullscreen()){
       autoLandscape=true;
       fallback();
     }
   }else if(autoLandscape){
     autoLandscape=false;
     if(hostMode&&!usingNative){
       clearHost();unlockLandscape();
       try{playing?.setHostFullscreen?.(false);}catch{}
     }
   }
 }
 window.addEventListener('orientationchange',syncRotation);
 window.addEventListener('resize',syncRotation);
 function goBack(event,player){
   if(playing!==player)return;
   event?.preventDefault?.();
   // Built-in Movi back arrow returns to NOCTRA2, not to browser history.
   // Works in host/iOS fullscreen, native fullscreen, and inline playback.
   // Return to the same information page instead of closing into the catalog.
   returnAfterClose=returnToInfo;
   try{player.exitFullscreen?.();}catch{}
   if(dialog.open)dialog.close(); // Other close listeners stop and remove Movi.
   else{const back=returnAfterClose;returnAfterClose=null;returnToInfo=null;
     if(back)setTimeout(()=>{try{back();}catch(e){console.warn('NOCTRA2 back:',e);}},90);}
 }
 function attach(player){
   if(!player||player.tagName!=='MOVI-PLAYER')return;
   playing=player;
   autoLandscape=false;
   clearHost();unlockLandscape();
   syncRotation();
   player.setAttribute('showtitle','');
   player.setAttribute('titlemode','both back');
   player.addEventListener('back',event=>goBack(event,player));
   // On Android/desktop Movi handles fullscreen itself. Orientation lock
   // is attempted AFTER it enters fullscreen so browsers allow the request.
   player.addEventListener('fullscreenchange',event=>{
     if(playing!==player)return;
     if(event.detail?.fullscreen===true){lockLandscape();return;}
     if(event.detail?.fullscreen===false){
       if(hostMode){
         const exit=usingNative&&nativeElement()===frame;
         clearHost();unlockLandscape();
         if(exit)Promise.resolve(document.exitFullscreen?.()).catch(()=>{});
       }else unlockLandscape();
     }
   });
   // On mobile, fullscreen the entire video container and request a real
   // landscape orientation lock during the user-initiated fullscreen action.
   // If the browser refuses, fill the available viewport without rotating UI.
   player.addEventListener('movi-fullscreen-request',event=>{
     if(!isIOS())return;
     if(playing!==player||!event.cancelable)return;
     event.preventDefault();requestHostFullscreen();
   });
 }
 function onNativeChange(){
   if(nativeElement()){if(ourNativeFullscreen())lockLandscape();return;}
   if(usingNative){
     const current=playing;
     clearHost();unlockLandscape();
     current?.setHostFullscreen?.(false);
   }else unlockLandscape();
 }
 document.addEventListener('fullscreenchange',onNativeChange);
 document.addEventListener('webkitfullscreenchange',onNativeChange);
 dialog.addEventListener('close',()=>{
   const current=playing;
   playing=null;
   autoLandscape=false;
   endFullscreen();
   try{current?.setHostFullscreen?.(false);}catch{}
   const back=returnAfterClose||returnToInfo;
   returnAfterClose=null;returnToInfo=null;
   // Wait until the modal and any native fullscreen session have exited.
   // Otherwise Safari may refuse to open the details/episode dialog.
   if(back)setTimeout(()=>{try{back();}catch(e){console.warn('NOCTRA2 back:',e);}},130);
 });
 // Android back key and smart-TV remote back close the video too.
 document.addEventListener('keydown',event=>{
   if(!dialog.open||!playing||!['BrowserBack','Backspace','Escape'].includes(event.key))return;
   if(event.target?.matches?.('input,textarea,[contenteditable="true"]'))return;
   event.preventDefault();event.stopPropagation();goBack(event,playing);
 },true);
 // Closing via Escape, Android's dialog cancellation or the visible X should
 // return to the selected film/season information, not the movie grid.
 dialog.addEventListener('cancel',event=>{
   if(!playing)return;
   event.preventDefault();
   goBack(event,playing);
 });
 window.noctraPlayerFullscreen={attach,setReturnInfo};
})();
