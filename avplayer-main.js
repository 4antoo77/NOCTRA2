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
   document.removeEventListener('fullscreenchange',sessionToStop.fullscreenListener);
   document.removeEventListener('webkitfullscreenchange',sessionToStop.fullscreenListener);
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
   const player=new Ctor({
     container:frame,
     fullscreenDom:frame,
     ui:{hasFolder:false,hasHeader:false,hasFooter:true},
     getWasm:wasm
   });
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
   const state={player,options:null,frame,dialog,fullscreenListener};
   session=state;
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