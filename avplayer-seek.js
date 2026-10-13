/* ANTOO PELIS · Saltos de 10 s en AVPlayer sin botones extra.
   Móvil: doble toque a izquierda/derecha del vídeo.
   PC: flechas izquierda/derecha o doble clic en el vídeo. */
(()=>{
 'use strict';
 function create(player,frame,dialog){
   if(!player||!frame||!dialog)return {destroy(){}};
   let disposed=false,queued=0,busy=false,hideTimer=0;
   let lastTap={time:0,x:0,y:0,side:''};
   let ignoreClickUntil=0;
   const notice=document.createElement('div');
   notice.className='antoo-av-seek-feedback';
   notice.setAttribute('role','status');
   notice.setAttribute('aria-live','polite');
   notice.hidden=true;
   frame.appendChild(notice);
   function show(side){
     notice.textContent=side==='left'?'↶ 10 s':'10 s ↷';
     notice.classList.toggle('antoo-seek-left',side==='left');
     notice.classList.toggle('antoo-seek-right',side==='right');
     notice.hidden=false;
     clearTimeout(hideTimer);
     hideTimer=setTimeout(()=>{notice.hidden=true;},780);
   }
   function isReady(){
     return !disposed&&dialog.open&&typeof player.seek==='function'
       &&typeof player.getDuration==='function'
       &&Number(player.getStatus?.()||0)>=4
       &&!player.isLive?.();
   }
   async function drain(){
     if(busy||disposed)return;
     busy=true;
     try{
       while(queued!==0&&!disposed){
         const delta=queued;queued=0;
         if(!isReady())break;
         const duration=Number(player.getDuration());
         const current=Number(player.currentTime);
         if(!Number.isFinite(duration)||duration<=0||!Number.isFinite(current))continue;
         const max=Math.max(0,Math.floor(duration-250));
         const destination=Math.max(0,Math.min(max,Math.round(current)+delta));
         if(Math.abs(destination-current)<1)continue;
         try{await player.seek(BigInt(destination));}
         catch(error){console.warn('ANTOO PELIS: no se pudo avanzar o retroceder 10 s.',error);}
       }
     }finally{busy=false;}
   }
   function seek10(side){
     if(!isReady())return false;
     queued+=(side==='left'?-10000:10000);
     show(side);
     void drain();
     return true;
   }
   function spot(target,clientX,clientY){
     if(!(target instanceof Element))return null;
     // No interferir con los controles, configuración, subtítulos ni la barra de progreso.
     if(target.closest('.antoo-av-options,button,a,input,select,textarea,[contenteditable="true"]'))return null;
     const surface=target.closest('.avplayer-ui-player');
     if(!surface||!frame.contains(surface))return null;
     const rect=surface.getBoundingClientRect();
     if(!rect.width||!rect.height||clientX<rect.left||clientX>rect.right)return null;
     const portion=(clientX-rect.left)/rect.width;
     const side=portion<.44?'left':portion>.56?'right':null;
     return side?{side,x:clientX,y:clientY}:null;
   }
   function tap(target,x,y,event){
     const hit=spot(target,x,y);
     if(!hit){lastTap.time=0;return;}
     const now=Date.now();
     const repeat=hit.side===lastTap.side&&now-lastTap.time<355
       &&Math.hypot(hit.x-lastTap.x,hit.y-lastTap.y)<85;
     lastTap={time:now,x:hit.x,y:hit.y,side:hit.side};
     if(repeat){
       lastTap.time=0;
       if(seek10(hit.side)){
         ignoreClickUntil=now+550;
         event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
       }
     }
   }
   function onPointer(e){
     if(e.pointerType!=='touch'&&e.pointerType!=='pen')return;
     if(e.isPrimary===false)return;
     tap(e.target,e.clientX,e.clientY,e);
   }
   function onTouch(e){
     // Navegadores antiguos sin Pointer Events.
     if(typeof PointerEvent==='function'||e.changedTouches?.length!==1)return;
     const touch=e.changedTouches[0];
     tap(e.target,touch.clientX,touch.clientY,e);
   }
   function onClick(e){
     if(Date.now()>ignoreClickUntil)return;
     if(!e.target?.closest?.('.avplayer-ui-player'))return;
     e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
   }
   function onDoubleClick(e){
     // Conveniencia para equipos con mouse; las flechas son el control principal de PC.
     const hit=spot(e.target,e.clientX,e.clientY);
     if(!hit||!seek10(hit.side))return;
     e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
   }
   function shouldUseKeys(e){
     if(disposed||!dialog.open||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)return false;
     if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return false;
     if(e.target?.closest?.('input,textarea,select,button,[contenteditable="true"],.antoo-av-options'))return false;
     return true;
   }
   function onKeyDown(e){
     if(!shouldUseKeys(e))return;
     // El AVPlayer original maneja también estas flechas, pero puede pasar al
     // siguiente fotograma al estar pausado. Evitar saltos duplicados.
     e.preventDefault();e.stopImmediatePropagation();e.stopPropagation();
     if(e.repeat)return;
     seek10(e.key==='ArrowLeft'?'left':'right');
   }
   function onKeyUp(e){
     if(!shouldUseKeys(e))return;
     e.preventDefault();e.stopImmediatePropagation();e.stopPropagation();
   }
   frame.addEventListener('pointerup',onPointer,true);
   frame.addEventListener('touchend',onTouch,{capture:true,passive:false});
   frame.addEventListener('click',onClick,true);
   frame.addEventListener('dblclick',onDoubleClick,true);
   document.addEventListener('keydown',onKeyDown,true);
   document.addEventListener('keyup',onKeyUp,true);
   return {
     seek10,
     destroy(){
       disposed=true;queued=0;
       clearTimeout(hideTimer);
       frame.removeEventListener('pointerup',onPointer,true);
       frame.removeEventListener('touchend',onTouch,true);
       frame.removeEventListener('click',onClick,true);
       frame.removeEventListener('dblclick',onDoubleClick,true);
       document.removeEventListener('keydown',onKeyDown,true);
       document.removeEventListener('keyup',onKeyUp,true);
       notice.remove();
     }
   };
 }
 window.antooAVSeek={create};
})();