/* NOCTRA2: safe picture orientation and cinema sizing for Movi Player.
 * No native video replacement, no CSS rotation of controls, no Drive changes.
 */
(()=>{
 'use strict';
 const dialog=document.getElementById('player');
 const frame=document.getElementById('frame-container');
 const rotateButton=document.getElementById('noctra-rotate-video');
 const theaterButton=document.getElementById('noctra-theater-video');
 if(!dialog||!frame||!rotateButton||!theaterButton)return;
 let active=null,activeId='',rotation=0,theater=false;
 const allowed=[0,90,180,270];
 // File ids are only used for local display preferences; never for access.
 const key=id=>'noctra2.video.rotation.'+id;
 function getRotation(id){
   try{const n=Number(localStorage.getItem(key(id))||0);return allowed.includes(n)?n:0;}
   catch{return 0;}
 }
 function saveRotation(){
   if(!activeId)return;
   try{if(rotation)localStorage.setItem(key(activeId),String(rotation));
       else localStorage.removeItem(key(activeId));}catch{}
 }
 function updateUi(){
   rotateButton.disabled=!active;
   rotateButton.textContent=rotation?'↻ Girar imagen · '+rotation+'°':'↻ Girar imagen';
   rotateButton.setAttribute('aria-label',rotation?
     'Girar video otros 90 grados, orientación actual '+rotation+' grados':
     'Girar video 90 grados si aparece de lado');
   rotateButton.setAttribute('aria-pressed',String(rotation!==0));
   theaterButton.textContent=theater?'⤢ Salir de modo cine':'⛶ Modo cine';
   theaterButton.setAttribute('aria-pressed',String(theater));
   dialog.classList.toggle('noctra-player-theater',theater);
   dialog.classList.toggle('noctra-video-portrait',rotation===90||rotation===270);
   frame.dataset.videoRotation=String(rotation);
 }
 function attach(el,id){
   if(!el||el.tagName!=='MOVI-PLAYER')return;
   active=el;
   activeId=String(id||'').slice(0,150);
   rotation=getRotation(activeId);
   // Movi Player applies rotate to the picture, not its touch controls.
   el.setAttribute('objectfit','contain');
   el.setAttribute('rotate',String(rotation));
   el.addEventListener('rotatechange',()=>{
     if(active!==el)return;
     const n=Number(el.getAttribute('rotate'));
     if(allowed.includes(n)&&n!==rotation){rotation=n;saveRotation();updateUi();}
   });
   updateUi();
 }
 rotateButton.addEventListener('click',()=>{
   if(!active)return;
   rotation=(rotation+90)%360;
   active.setAttribute('rotate',String(rotation));
   saveRotation();updateUi();
 });
 theaterButton.addEventListener('click',()=>{
   theater=!theater;
   updateUi();
 });
 dialog.addEventListener('close',()=>{
   active=null;activeId='';rotation=0;theater=false;
   updateUi();
 });
 document.addEventListener('keydown',event=>{
   if(!dialog.open||!theater||event.key!=='Escape')return;
   event.preventDefault();event.stopPropagation();theater=false;updateUi();
 },true);
 window.noctraPlayerControls={attach};
 updateUi();
})();
