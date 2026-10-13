/* NOCTRA2 | Use Movi Player's original fullscreen button on every device.
 * Desktop/Android/TV: Movi's browser-native Fullscreen API is untouched.
 * iOS Safari: take over only where element fullscreen is not available, so
 * we don't rotate Movi's controls or show the rest of the website.
 *
 * Safari browser chrome is OS-controlled and cannot be hidden from a web page.
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
 const nativeElement=()=>document.fullscreenElement||document.webkitFullscreenElement||null;
 function clearHost(){
   dialog.classList.remove('noctra-fullscreen-host');
   frame.classList.remove('noctra-fullscreen-native');
   document.documentElement.classList.remove('noctra-fullscreen-lock');
   hostMode=false;usingNative=false;
 }
 function fallback(){
   if(!playing||!dialog.open)return;
   hostMode=true;usingNative=false;
   dialog.classList.add('noctra-fullscreen-host');
   document.documentElement.classList.add('noctra-fullscreen-lock');
   if(typeof playing.setHostFullscreen==='function')playing.setHostFullscreen(true);
 }
 function requestHostFullscreen(){
   // This function runs synchronously from the player's fullscreen tap.
   // Prefer real browser fullscreen; a fallback is needed on iOS Safari.
   if(document.fullscreenEnabled&&typeof frame.requestFullscreen==='function'){
     let pending;
     try{pending=frame.requestFullscreen({navigationUI:'hide'});}
     catch{fallback();return;}
     Promise.resolve(pending).then(()=>{
       if(!playing||!dialog.open){
         if(nativeElement()===frame)document.exitFullscreen?.().catch?.(()=>{});
         return;
       }
       hostMode=true;usingNative=true;
       frame.classList.add('noctra-fullscreen-native');
       playing.setHostFullscreen?.(true);
     }).catch(()=>fallback());
     return;
   }
   fallback();
 }
 function attach(player){
   if(!player||player.tagName!=='MOVI-PLAYER')return;
   playing=player;
   clearHost();
   // The ordinary native fullscreen control on other platforms already works.
   // Intercept only iOS's pseudo-fullscreen path, which rotated the entire UI
   // while leaving Safari's address bar outside it.
   if(!isIOS())return;
   player.addEventListener('movi-fullscreen-request',event=>{
     if(playing!==player)return;
     if(!event.cancelable)return;
     event.preventDefault();
     requestHostFullscreen();
   });
   player.addEventListener('fullscreenchange',event=>{
     if(playing!==player)return;
     if(event.detail?.fullscreen===false&&hostMode){
       const exit=usingNative&&nativeElement()===frame;
       clearHost();
       if(exit)Promise.resolve(document.exitFullscreen?.()).catch(()=>{});
     }
   });
 }
 function onNativeExit(){
   if(!hostMode||!usingNative||nativeElement()===frame)return;
   const current=playing;
   clearHost();
   current?.setHostFullscreen?.(false);
 }
 document.addEventListener('fullscreenchange',onNativeExit);
 document.addEventListener('webkitfullscreenchange',onNativeExit);
 dialog.addEventListener('close',()=>{
   const exit=usingNative&&nativeElement()===frame;
   const current=playing;
   playing=null;clearHost();
   if(exit)Promise.resolve(document.exitFullscreen?.()).catch(()=>{});
   if(current&&typeof current.setHostFullscreen==='function'){
     try{current.setHostFullscreen(false);}catch{}
   }
 });
 document.addEventListener('keydown',event=>{
   if(!hostMode||event.key!=='Escape'||!dialog.open)return;
   if(!usingNative){
     event.preventDefault();event.stopPropagation();
     const current=playing;clearHost();
     current?.setHostFullscreen?.(false);
   }
 },true);
 window.noctraPlayerFullscreen={attach};
})();
