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
 let playing=null,hostMode=false,usingNative=false,orientationLocked=false;
 let orientationGeneration=0;
 const nativeElement=()=>document.fullscreenElement||document.webkitFullscreenElement||null;
 const ourNativeFullscreen=()=>{
   const element=nativeElement();
   return !!element&&(element===frame||element===playing||
     (typeof frame.contains==='function'&&frame.contains(element)));
 };
 function unlockLandscape(){
   ++orientationGeneration;
   if(!orientationLocked)return;
   orientationLocked=false;
   try{screen.orientation?.unlock?.();}catch{}
 }
 function lockLandscape(){
   // Allowed by Android/compatible full-screen browsers. Unsupported on iPhone.
   if(typeof screen==='undefined'||typeof screen.orientation?.lock!=='function')return;
   const generation=++orientationGeneration;
   let result;
   try{result=screen.orientation.lock('landscape');}
   catch{return;}
   Promise.resolve(result).then(()=>{
     if(generation!==orientationGeneration||!dialog.open){
       try{screen.orientation?.unlock?.();}catch{}
       return;
     }
     orientationLocked=true;
   }).catch(()=>{}); // Browser/OS may forbid orientation lock.
 }
 function clearHost(){
   dialog.classList.remove('noctra-fullscreen-host');
   frame.classList.remove('noctra-fullscreen-native');
   document.documentElement.classList.remove('noctra-fullscreen-lock');
   hostMode=false;usingNative=false;
 }
 function endFullscreen(){
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
   // Native fullscreen + lock where available; true orientation is OS-controlled.
   if(document.fullscreenEnabled&&typeof frame.requestFullscreen==='function'){
     let pending;
     try{pending=frame.requestFullscreen({navigationUI:'hide'});}
     catch{fallback();return;}
     Promise.resolve(pending).then(()=>{
       if(!playing||!dialog.open){
         if(nativeElement()===frame)Promise.resolve(document.exitFullscreen?.()).catch(()=>{});
         return;
       }
       hostMode=true;usingNative=true;
       frame.classList.add('noctra-fullscreen-native');
       playing.setHostFullscreen?.(true);
       lockLandscape();
     }).catch(()=>fallback());
   }else fallback();
 }
 function goBack(event,player){
   if(playing!==player)return;
   event?.preventDefault?.();
   // Built-in Movi back arrow returns to NOCTRA2, not to browser history.
   // Works in host/iOS fullscreen, native fullscreen, and inline playback.
   try{player.exitFullscreen?.();}catch{}
   if(dialog.open)dialog.close(); // Player 'close' listeners also stop playback.
 }
 function attach(player){
   if(!player||player.tagName!=='MOVI-PLAYER')return;
   playing=player;
   clearHost();unlockLandscape();
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
   // Only intercept iOS's pseudo-fullscreen, which previously rotated
   // all controls while leaving Safari's address bar on the screen.
   if(isIOS())player.addEventListener('movi-fullscreen-request',event=>{
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
   endFullscreen();
   try{current?.setHostFullscreen?.(false);}catch{}
 });
 // Android back key and smart-TV remote back close the video too.
 document.addEventListener('keydown',event=>{
   if(!dialog.open||!playing||!['BrowserBack','Backspace'].includes(event.key))return;
   if(event.target?.matches?.('input,textarea,[contenteditable="true"]'))return;
   event.preventDefault();event.stopPropagation();goBack(event,playing);
 },true);
 window.noctraPlayerFullscreen={attach};
})();
