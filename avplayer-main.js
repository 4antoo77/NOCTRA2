/* ANTOO PELIS | Reproductor principal de MKV: libmedia AVPlayerUI.
   Conserva los MKV originales; usa los mismos enlaces firmados de Cloudflare.
   Movi Player permanece como respaldo para errores de inicializacion. */
(()=>{
 'use strict';
 const MOD='https://cdn.jsdelivr.net/npm/@libmedia/avplayer-ui@1.3.1/+esm';
 const WASM='https://cdn.jsdelivr.net/gh/zhaohappy/libmedia@latest/dist/';
 const codecs={
   27:'h264',173:'hevc',86018:'aac',86017:'mp3',86019:'ac3',
   86020:'dca',86028:'flac',86056:'eac3',86021:'vorbis',86076:'opus'
 };
 let loader=null,session=null,serial=0;
 function component(){
   if(!loader)loader=import(MOD).then(mod=>{
     const ctor=mod.default||mod.AVPlayerUI||mod.AVPlayer;
     if(typeof ctor!=='function')throw Error('No se encontró el reproductor AVPlayer.');
     return ctor;
   }).catch(e=>{loader=null;throw e;});
   return loader;
 }
 function wasm(type,id){
   if(type==='resampler')return WASM+'resample/resample-simd.wasm';
   if(type==='stretchpitcher')return WASM+'stretchpitch/stretchpitch-simd.wasm';
   if(type!=='decoder')return undefined;
   const name=codecs[Number(id)];
   if(!name)console.warn('ANTOO PELIS: decodificador no configurado',id);
   return name?WASM+'decode/'+name+'-simd.wasm':undefined;
 }
 function cleanup(sessionToStop){
   if(!sessionToStop)return;
   sessionToStop.options?.destroy?.();
   sessionToStop.touchCleanup?.();
   document.removeEventListener('fullscreenchange',sessionToStop.fullscreenListener);
   document.removeEventListener('webkitfullscreenchange',sessionToStop.fullscreenListener);
   document.documentElement.classList.remove('antoo-avplayer-fullscreen');
   sessionToStop.dialog.classList.remove('antoo-avplayer-immersive','antoo-avplayer-rotated');
   try{
     if((document.fullscreenElement||document.webkitFullscreenElement)===sessionToStop.frame)
       Promise.resolve(document.exitFullscreen?.()||document.webkitExitFullscreen?.()).catch(()=>{});
   }catch{}
   try{screen.orientation?.unlock?.();}catch{}
   sessionToStop.frame.classList.remove('antoo-avplayer-container');
   sessionToStop.dialog.classList.remove('antoo-avplayer-active');
   try{sessionToStop.player?.stop?.();}catch{}
   try{Promise.resolve(sessionToStop.player?.destroy?.()).catch(()=>{});}catch{}
 }
 function stop(){
   serial++;
   const previous=session;session=null;
   cleanup(previous);
 }
 // Usa el control original de libmedia, pero procesa las pulsaciones táctiles
 // antes del clic sintetizado. El modo de respaldo cubre el viewport cuando
 // el navegador no permite requestFullscreen sobre un canvas o div.
 function installTouchFullscreen(state){
   const {frame,dialog}=state;
   let lastTouch=0,lastTarget=null,lastVolume=1,mode='none';
   const inLandscape=()=>matchMedia('(orientation:landscape)').matches;
   function setHost(){
     mode='host';
     dialog.classList.add('antoo-avplayer-immersive');
     document.documentElement.classList.add('antoo-avplayer-fullscreen');
     rotate();
   }
   function rotate(){
     dialog.classList.toggle('antoo-avplayer-rotated',mode==='host'&&!inLandscape());
   }
   function exitHost(){
     mode='none';
     dialog.classList.remove('antoo-avplayer-immersive','antoo-avplayer-rotated');
     document.documentElement.classList.remove('antoo-avplayer-fullscreen');
     try{screen.orientation?.unlock?.();}catch{}
   }
   function toggle(){
     if(document.fullscreenElement||document.webkitFullscreenElement){
       try{Promise.resolve(document.exitFullscreen?.()||document.webkitExitFullscreen?.()).catch(()=>{});}catch{}
       return;
     }
     if(mode==='host'){exitHost();return;}
     const video=frame.querySelector('video');
     if(/iPhone|iPad|iPod/i.test(navigator.userAgent)&&video?.webkitEnterFullscreen){
       try{video.webkitEnterFullscreen();return;}catch{}
     }
     const request=frame.requestFullscreen||frame.webkitRequestFullscreen;
     if(!request){setHost();return;}
     try{
       // Ejecutar síncronamente con pointerup para conservar la activación.
       Promise.resolve(request.call(frame,{navigationUI:'hide'}))
         .then(()=>{mode='native';},()=>setHost());
     }catch{setHost();}
   }
   function onTap(e){
     const target=e.target;
     if(!(target instanceof Element))return;
     const control=target.closest('.avplayer-ui-control-fullscreen, .avplayer-ui-control-play, .avplayer-ui-volume-icon');
     if(!control||!frame.contains(control))return;
     if(e.type==='pointerup'&&e.pointerType!=='touch')return;
     const now=Date.now();
     // pointerup y touchend pueden llegar para el mismo dedo. Capturamos
     // ambos y deduplicamos por control; otro botón puede tocarse enseguida.
     if(e.type==='click'&&!(now-lastTouch<850&&lastTarget===control))return;
     e.preventDefault();e.stopImmediatePropagation();e.stopPropagation();
     if(e.type==='click')return;
     if(now-lastTouch<450&&lastTarget===control)return;
     lastTouch=now;lastTarget=control;
     if(control.matches('.avplayer-ui-control-fullscreen')){toggle();return;}
     if(control.matches('.avplayer-ui-control-play')){
       try{
         const status=state.player.getStatus?.();
         if(status===6)state.player.pause?.();else Promise.resolve(state.player.play?.()).catch(()=>{});
       }catch(err){console.warn('ANTOO PELIS pausa táctil:',err);}
       return;
     }
     if(control.matches('.avplayer-ui-volume-icon')){
       try{
         const volume=Number(state.player.getVolume?.()??1);
         if(volume>0){lastVolume=volume;state.player.setVolume?.(0);}
         else state.player.setVolume?.(lastVolume||1);
       }catch(err){console.warn('ANTOO PELIS volumen táctil:',err);}
     }
   }
   const onOrientation=()=>{if(mode==='host')rotate();};
   const onNative=()=>{
     const active=(document.fullscreenElement||document.webkitFullscreenElement)===frame;
     if(active)mode='native';
     else if(mode==='native')mode='none';
   };
   frame.addEventListener('pointerup',onTap,true);
   frame.addEventListener('touchend',onTap,{capture:true,passive:false});
   frame.addEventListener('click',onTap,true);
   window.addEventListener('orientationchange',onOrientation);
   window.addEventListener('resize',onOrientation);
   document.addEventListener('fullscreenchange',onNative);
   document.addEventListener('webkitfullscreenchange',onNative);
   return ()=>{
     exitHost();
     frame.removeEventListener('pointerup',onTap,true);
     frame.removeEventListener('touchend',onTap,true);
     frame.removeEventListener('click',onTap,true);
     window.removeEventListener('orientationchange',onOrientation);
     window.removeEventListener('resize',onOrientation);
     document.removeEventListener('fullscreenchange',onNative);
     document.removeEventListener('webkitfullscreenchange',onNative);
   };
 }
 async function start({url,frame,dialog,hint,title}){
   if(!/^https:\/\//.test(String(url)))throw Error('El enlace de reproducción no es válido.');
   if(!frame||!dialog)throw Error('No existe el contenedor del reproductor.');
   stop();
   const request=serial;
   const Ctor=await component();
   if(request!==serial||!dialog.open)return false;
   frame.replaceChildren();
   frame.classList.add('antoo-avplayer-container');
   dialog.classList.add('antoo-avplayer-active');
   let player;
   try{
     player=new Ctor({
       container:frame,
       fullscreenDom:frame,
       ui:{hasFolder:false,hasHeader:false,hasFooter:true},
       getWasm:wasm
     });
   }catch(e){
     frame.classList.remove('antoo-avplayer-container');
     dialog.classList.remove('antoo-avplayer-active');
     throw e;
   }
   const fullscreenListener=()=>{
     const active=(document.fullscreenElement||document.webkitFullscreenElement)===frame;
     if(active){
       document.documentElement.classList.add('antoo-avplayer-fullscreen');
       if(typeof screen.orientation?.lock==='function')
         Promise.resolve(screen.orientation.lock('landscape')).catch(()=>{});
     }else{
       document.documentElement.classList.remove('antoo-avplayer-fullscreen');
       try{screen.orientation?.unlock?.();}catch{}
     }
   };
   const state={player,options:null,touchCleanup:null,frame,dialog,fullscreenListener};
   session=state;
   state.touchCleanup=installTouchFullscreen(state);
   document.addEventListener('fullscreenchange',fullscreenListener);
   document.addEventListener('webkitfullscreenchange',fullscreenListener);
   try{
     window.antooAvplayerSpanish?.apply?.(player);
     state.options=window.antooAvplayerOptions?.create?.(player,frame)||null;
     if(hint)hint.textContent='Preparando '+(title||'tu película')+' con AVPlayer…';
     await player.load(url);
     if(request!==serial||!dialog.open){if(session===state)stop();return false;}
     state.options?.refresh?.();
     await player.play();
     if(request!==serial||!dialog.open){if(session===state)stop();return false;}
     if(hint)hint.textContent='Reproduciendo MKV original con AVPlayer. Idiomas y subtítulos: ⚙ Configuración.';
     return true;
   }catch(err){
     if(session===state)stop();
     throw err;
   }
 }
 window.antooAVPlayerMain={start,stop,get active(){return !!session;}};
})();