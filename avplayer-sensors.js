/* ANTOO PELIS · Orientación física para pantalla completa.
 * Usa gravedad del acelerómetro aunque iOS tenga el bloqueo de giro.
 * El permiso, cuando hace falta, se solicita desde el toque del usuario.
 * No registra ni envía datos de sensores fuera del dispositivo. */
(()=>{
 'use strict';
 function fromGravity(x,y){
   if(!Number.isFinite(x)||!Number.isFinite(y))return null;
   const ax=Math.abs(x),ay=Math.abs(y);
   if(ax>5.6&&ax>ay*1.3)return x>0?'landscape-right':'landscape-left';
   if(ay>5.6&&ay>ax*1.3)return 'portrait';
   return null;
 }
 function fromAngles(beta,gamma){
   if(!Number.isFinite(gamma))return null;
   if(Math.abs(gamma)>57)return gamma>0?'landscape-right':'landscape-left';
   // No forzar vertical cuando el móvil está apoyado horizontalmente.
   if(Math.abs(gamma)<23&&Number.isFinite(beta)&&Math.abs(beta)>28)
     return 'portrait';
   return null;
 }
 function create(onChange){
   let active=false,motionAt=0,chosen=null,candidate=null,candidateSince=0;
   let state={motion:'unknown',orientation:'unknown'};
   function accept(next){
     if(!active||!next)return;
     const now=Date.now();
     if(next===chosen){candidate=null;return;}
     if(candidate!==next){candidate=next;candidateSince=now;return;}
     // Evita cambios accidentales por pequeños movimientos de la mano.
     if(now-candidateSince<330)return;
     candidate=null;chosen=next;
     onChange?.(next);
   }
   function onMotion(e){
     const gravity=e.accelerationIncludingGravity;
     if(!gravity)return;
     const {x,y}=gravity;
     if(!Number.isFinite(x)||!Number.isFinite(y))return;
     motionAt=Date.now();
     accept(fromGravity(x,y));
   }
   function onOrientation(e){
     if(Date.now()-motionAt<1800)return; // Prioridad al acelerómetro.
     accept(fromAngles(e.beta,e.gamma));
   }
   function subscribe(){
     if(!active)return;
     window.removeEventListener('devicemotion',onMotion);
     window.removeEventListener('deviceorientation',onOrientation);
     if(state.motion==='granted')window.addEventListener('devicemotion',onMotion);
     if(state.orientation==='granted')window.addEventListener('deviceorientation',onOrientation);
   }
   function start(){
     if(active)return;
     active=true;
     const pending=[];
     // Ambas solicitudes se realizan en la MISMA interacción; no se
     // espera a la primera antes de pedir la segunda (requisito de iOS).
     for(const [kind,ctor] of [
       ['motion',window.DeviceMotionEvent],
       ['orientation',window.DeviceOrientationEvent]
     ]){
       if(!ctor){state[kind]='unavailable';continue;}
       if(typeof ctor.requestPermission==='function'&&state[kind]==='unknown'){
         try{
           const granted=Promise.resolve(ctor.requestPermission())
             .then(p=>{state[kind]=p==='granted'?'granted':'denied';},
               ()=>{state[kind]='denied';});
           pending.push(granted);
         }catch{state[kind]='denied';}
       }else if(typeof ctor.requestPermission!=='function'){
         state[kind]='granted';
       }
     }
     // En Android u otros navegadores sin prompt, comenzar inmediatamente.
     subscribe();
     if(pending.length)Promise.allSettled(pending).then(()=>{if(active)subscribe();});
   }
   function stop(){
     active=false;candidate=null;chosen=null;motionAt=0;
     window.removeEventListener('devicemotion',onMotion);
     window.removeEventListener('deviceorientation',onOrientation);
   }
   return {start,stop};
 }
 window.antooPhysicalOrientation={create,fromGravity,fromAngles};
})();