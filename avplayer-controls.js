/* ANTOO PELIS · Ocultar barra y progreso de AVPlayer cuando no se usan.
   El gesto táctil y el mouse hacen reaparecer los controles. */
(()=>{
 'use strict';
 function create(player,frame,dialog){
   if(!player||!frame||!dialog)return {destroy(){}};
   const delay=3200;
   let disposed=false,hidden=false,interactionAt=Date.now(),held=false,timer=0;
   const playing=()=>dialog.open&&Number(player.getStatus?.())===6;
   const optionsOpen=()=>!!frame.querySelector('.antoo-av-options:not([hidden])');
   function visible(){
     if(disposed)return;
     const wasHidden=hidden;
     hidden=false;
     frame.classList.remove('antoo-av-controls-hidden');
     // No hacer un render Yox por cada movimiento de mouse.
     if(wasHidden||player.ui?.get?.('showBar')!==true)
       try{player.ui?.set?.('showBar',true);}catch{}
   }
   function hide(){
     if(disposed||!playing()||optionsOpen()||held)return;
     if(Date.now()-interactionAt<delay)return;
     hidden=true;
     frame.classList.add('antoo-av-controls-hidden');
     try{player.ui?.set?.('showBar',false);}catch{}
   }
   function awake(){
     interactionAt=Date.now();
     clearTimeout(timer);
     visible();
     timer=setTimeout(hide,delay);
   }
   function onPointerMove(e){
     if(e.pointerType==='mouse'||e.pointerType==='pen')awake();
   }
   function onPointerDown(e){
     if(e.target instanceof Element&&e.target.closest('.avplayer-ui-progress-container'))held=true;
     awake();
   }
   function onPointerUp(){
     held=false;
     // Al terminar de arrastrar la línea, mantener controles unos segundos.
     awake();
   }
   function onKeys(e){
     if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','Enter'].includes(e.key))awake();
   }
   function onFocus(){awake();}
   frame.addEventListener('pointermove',onPointerMove,{passive:true});
   frame.addEventListener('pointerdown',onPointerDown,{passive:true});
   frame.addEventListener('pointerup',onPointerUp,{passive:true});
   frame.addEventListener('pointercancel',onPointerUp,{passive:true});
   frame.addEventListener('touchstart',awake,{passive:true});
   frame.addEventListener('focusin',onFocus);
   document.addEventListener('keydown',onKeys,true);
   const poll=setInterval(()=>{
     if(disposed)return;
     if(!playing()||optionsOpen()||held){
       if(hidden)visible();
       return;
     }
     if(!hidden&&Date.now()-interactionAt>=delay)hide();
   },850);
   awake();
   return {
     show:awake,
     destroy(){
       disposed=true;
       clearTimeout(timer);clearInterval(poll);
       frame.removeEventListener('pointermove',onPointerMove);
       frame.removeEventListener('pointerdown',onPointerDown);
       frame.removeEventListener('pointerup',onPointerUp);
       frame.removeEventListener('pointercancel',onPointerUp);
       frame.removeEventListener('touchstart',awake);
       frame.removeEventListener('focusin',onFocus);
       document.removeEventListener('keydown',onKeys,true);
       frame.classList.remove('antoo-av-controls-hidden');
       try{player.ui?.set?.('showBar',true);}catch{}
     }
   };
 }
 window.antooAVControls={create};
})();