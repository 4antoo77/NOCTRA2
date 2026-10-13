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
 let loader=null,session=null,serial=0,stopping=Promise.resolve();
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
 async function cleanup(sessionToStop){
   if(!sessionToStop)return;
   sessionToStop.options?.destroy?.();
   sessionToStop.seekControls?.destroy?.();
   sessionToStop.captions?.destroy?.();
   sessionToStop.controls?.destroy?.();
   sessionToStop.touchCleanup?.();
   document.removeEventListener('fullscreenchange',sessionToStop.fullscreenListener);
   document.removeEventListener('webkitfullscreenchange',sessionToStop.fullscreenListener);
   document.documentElement.classList.remove('antoo-avplayer-fullscreen');
   sessionToStop.dialog.classList.remove('antoo-avplayer-immersive','antoo-avplayer-landscape','antoo-avplayer-portrait');
   try{
     if((document.fullscreenElement||document.webkitFullscreenElement)===sessionToStop.frame)
       Promise.resolve(document.exitFullscreen?.()||document.webkitExitFullscreen?.()).catch(()=>{});
   }catch{}
   try{screen.orientation?.unlock?.();}catch{}
   sessionToStop.frame.classList.remove('antoo-avplayer-container');
   sessionToStop.dialog.classList.remove('antoo-avplayer-active');
   try{await Promise.resolve(sessionToStop.player?.stop?.());}catch{}
   try{await Promise.resolve(sessionToStop.player?.destroy?.());}catch{}
 }
 function stop(){
   serial++;
   const previous=session;session=null;
   if(!previous)return stopping;
   stopping=(async()=>{
     // libmedia exposes asynchronous player controls. Mute and pause in order,
     // then stop and destroy only after the audio graph has applied both.
     try{await Promise.resolve(previous.player?.setVolume?.(0));}catch{}
     try{await Promise.resolve(previous.player?.pause?.());}catch{}
     await cleanup(previous);
   })();
   return stopping;
 }
 // Usa el control original de libmedia, pero procesa las pulsaciones táctiles
 // antes del clic sintetizado. El modo de respaldo cubre el viewport cuando
 // el navegador no permite requestFullscreen sobre un canvas o div.
 function installTouchFullscreen(state){
   const {frame,dialog}=state;
   let lastTouch=0,lastTarget=null,lastVolume=1,mode='none';
   let resizeFrame=0,resizeLater=0,resizeEnd=0,observer=null;
   let previousDimensions='';
   const inLandscape=()=>matchMedia('(orientation:landscape)').matches;
   // Se adapta a la orientación de pantalla del navegador,
   // sin acceder al acelerómetro ni girar artificialmente el vídeo.
   // Libmedia escucha resize con retraso; actualizamos su canvas al cambiar
   // el tamaño efectivo del contenedor.
   function updatePlayerSize(force=false){
     const surface=frame.querySelector('.avplayer-ui-player')||frame;
     const w=Math.round(surface.clientWidth);
     const h=Math.round(surface.clientHeight);
     if(!w||!h||!state.player||state.player.getStatus?.()<4)return;
     const stamp=w+'x'+h;
     if(!force&&previousDimensions===stamp)return;
     previousDimensions=stamp;
     try{Promise.resolve(state.player.resize(w,h)).catch(e=>console.warn('ANTOO PELIS tamaño del video:',e));}
     catch(e){console.warn('ANTOO PELIS tamaño del video:',e);}
   }
   function schedulePlayerSize(){
     if(resizeFrame)cancelAnimationFrame(resizeFrame);
     clearTimeout(resizeLater);
     clearTimeout(resizeEnd);
     resizeFrame=requestAnimationFrame(()=>{
       resizeFrame=requestAnimationFrame(()=>{resizeFrame=0;updatePlayerSize();});
     });
     resizeLater=setTimeout(()=>updatePlayerSize(),180);
     resizeEnd=setTimeout(()=>updatePlayerSize(),630);
   }
   function syncOrientation(){
     const fullscreen=mode==='host'||mode==='native';
     const landscape=inLandscape();
     dialog.classList.toggle('antoo-avplayer-landscape',fullscreen&&landscape);
     dialog.classList.toggle('antoo-avplayer-portrait',fullscreen&&!landscape);
     schedulePlayerSize();
   }
   function setHost(){
     mode='host';
     dialog.classList.add('antoo-avplayer-immersive');
     document.documentElement.classList.add('antoo-avplayer-fullscreen');
     syncOrientation();
   }
   function exitHost(){
     mode='none';
     dialog.classList.remove('antoo-avplayer-immersive','antoo-avplayer-landscape','antoo-avplayer-portrait');
     document.documentElement.classList.remove('antoo-avplayer-fullscreen');
     syncOrientation();
   }
   function toggle(){
     if(document.fullscreenElement||document.webkitFullscreenElement){
       try{Promise.resolve(document.exitFullscreen?.()||document.webkitExitFullscreen?.()).catch(()=>{});}catch{}
       return;
     }
     if(mode==='host'){exitHost();return;}
     // Utilizamos la pantalla completa del contenedor cuando se permita,
     // sin forzar la orientación mediante el modo de video propio de iOS.
     const request=frame.requestFullscreen||frame.webkitRequestFullscreen;
     if(!request){setHost();return;}
     try{
       // Ejecutar síncronamente con pointerup para conservar la activación.
       Promise.resolve(request.call(frame,{navigationUI:'hide'}))
         .then(()=>{mode='native';syncOrientation();},()=>setHost());
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
   const onOrientation=()=>syncOrientation();
   const onNative=()=>{
     const active=(document.fullscreenElement||document.webkitFullscreenElement)===frame;
     if(active)mode='native';
     else if(mode==='native')mode='none';
     syncOrientation();
   };
   frame.addEventListener('pointerup',onTap,true);
   frame.addEventListener('touchend',onTap,{capture:true,passive:false});
   frame.addEventListener('click',onTap,true);
   window.addEventListener('orientationchange',onOrientation);
   window.addEventListener('resize',onOrientation);
   window.visualViewport?.addEventListener('resize',onOrientation);
   document.addEventListener('fullscreenchange',onNative);
   document.addEventListener('webkitfullscreenchange',onNative);
   if(typeof ResizeObserver==='function'){
     observer=new ResizeObserver(schedulePlayerSize);
     observer.observe(frame);
     const display=frame.querySelector('.avplayer-ui-player');
     if(display)observer.observe(display);
   }
   schedulePlayerSize();
   state.requestResize=schedulePlayerSize;
   return ()=>{
     state.requestResize=null;
     if(resizeFrame)cancelAnimationFrame(resizeFrame);
     clearTimeout(resizeLater);clearTimeout(resizeEnd);
     observer?.disconnect();
     frame.removeEventListener('pointerup',onTap,true);
     frame.removeEventListener('touchend',onTap,true);
     frame.removeEventListener('click',onTap,true);
     window.removeEventListener('orientationchange',onOrientation);
     window.removeEventListener('resize',onOrientation);
     window.visualViewport?.removeEventListener('resize',onOrientation);
     document.removeEventListener('fullscreenchange',onNative);
     document.removeEventListener('webkitfullscreenchange',onNative);
     dialog.classList.remove('antoo-avplayer-immersive','antoo-avplayer-landscape','antoo-avplayer-portrait');
     document.documentElement.classList.remove('antoo-avplayer-fullscreen');
   };
 }
 // El motor de libmedia escoge una pista por defecto ANTES de crear su
 // renderizador. Si el primer subtítulo es PGS (imagen), no crea el
 // renderizador y después selectSubtitle tampoco funciona.
 // Filtrar SOLO esa selección conserva el algoritmo original de audio/vídeo.
 const subtitleCodecs=new Set([94210,94212,94213,94225,94226,94230,94232]);
 function fixInitialSubtitleTrack(player){
   if(typeof player.findBestStream!=='function')return false;
   const original=player.findBestStream;
   player.findBestStream=function(streams,mediaType,...extra){
     if(Number(mediaType)!==3)return original.call(this,streams,mediaType,...extra);
     try{
       const info=player.getStreams?.()||[];
       const usable=new Set(info.filter(s=>{
         const type=String(s.mediaType||'').toLowerCase();
         const cp=s.codecparProxy||{};
         return type.includes('subtitle')&&subtitleCodecs.has(Number(cp.codecId));
       }).map(s=>Number(s.id)));
       const candidates=streams.filter(s=>usable.has(Number(s.id)));
       if(!candidates.length){
         console.info('ANTOO: este archivo no contiene subtítulos de texto decodificables; las pistas gráficas necesitan otra implementación.');
         return undefined;
       }
       const selected=original.call(this,candidates,mediaType,...extra);
       console.info('ANTOO: subtítulo inicial compatible',selected?.id);
       return selected;
     }catch(error){
       console.warn('ANTOO: selección inicial de subtítulos',error);
       return original.call(this,streams,mediaType,...extra);
     }
   };
   return true;
 }
 async function start({url,frame,dialog,hint,title,resumeAt=0,media=null,startupRetry=0}){
   if(!/^https:\/\//.test(String(url)))throw Error('El enlace de reproducción no es válido.');
   if(!frame||!dialog)throw Error('No existe el contenedor del reproductor.');
   await stop();
   const request=serial;
   const Ctor=await component();
   if(request!==serial||!dialog.open)return false;
   frame.replaceChildren();
   frame.classList.add('antoo-avplayer-container');
   dialog.classList.add('antoo-avplayer-active');
   let player;
   try{
     const isPhone=/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
       ||(navigator.maxTouchPoints>1&&matchMedia('(pointer:coarse)').matches);
     player=new Ctor({
       container:frame,
       fullscreenDom:frame,
       // libmedia 1.3.1 SubtitleRender.pull only accepts AVPacket pointers.
       // Without shared memory, its worker demuxer sends serialized objects
       // instead; the subtitle reader then stalls before decoding any text.
       // Keep packets in the same heap on ordinary pages (including GitHub
       // Pages). Isolated pages can retain workers with shared memory.
       enableWorker:globalThis.crossOriginIsolated===true
         && typeof globalThis.SharedArrayBuffer==='function',
       ui:{hasFolder:false,hasHeader:false,hasFooter:true},
       getWasm:wasm,
       // libmedia: audioWorkletBufferLength usa bloques de 128 muestras.
       // Sus valores predeterminados (20 móvil, 10 escritorio) pueden causar
       // microcortes cuando la comunicación de audio sufre latencia.
       audioWorkletBufferLength:isPhone?64:32,
       // Archivos MKV bajo demanda de Google Drive: dar un poco más de margen
       // a la carga inicial sin habilitar el modo de baja latencia en vivo.
       preLoadTime:6,
       lowLatency:false
     });
   }catch(e){
     frame.classList.remove('antoo-avplayer-container');
     dialog.classList.remove('antoo-avplayer-active');
     throw e;
   }
   window.noctraPlayerFullscreen?.mountBackButton?.();
   const fullscreenListener=()=>{
     const active=(document.fullscreenElement||document.webkitFullscreenElement)===frame;
     document.documentElement.classList.toggle('antoo-avplayer-fullscreen',active);
     // Nunca bloquear 'landscape': la pantalla completa sigue al teléfono.
     state.requestResize?.();
   };
   const state={player,options:null,seekControls:null,captions:null,controls:null,touchCleanup:null,requestResize:null,frame,dialog,fullscreenListener};
   session=state;
   state.touchCleanup=installTouchFullscreen(state);
   document.addEventListener('fullscreenchange',fullscreenListener);
   document.addEventListener('webkitfullscreenchange',fullscreenListener);
   try{
     window.antooAvplayerSpanish?.apply?.(player);
     state.options=window.antooAvplayerOptions?.create?.(player,frame)||null;
     state.seekControls=window.antooAVSeek?.create?.(player,frame,dialog)||null;
     state.controls=window.antooAVControls?.create?.(player,frame,dialog)||null;
     if(hint)hint.textContent='Preparando '+(title||'tu película')+' con AVPlayer…';
     await player.load(url);
     if(request!==serial||!dialog.open){if(session===state)stop();return false;}
     // El filtro se instala después de analizar las pistas del MKV y
     // antes de elegir la que inicializa SubtitleRender.
     fixInitialSubtitleTrack(player);
     state.options?.refresh?.();
     state.requestResize?.();
     // Conectar el respaldo ANTES de play para no perder el primer diálogo.
     // El módulo espera a que libmedia cree subtitleRender durante play.
     state.captions=window.antooAVCaptions?.create?.(player,frame,dialog)||null;
     // Registrar el primer cuadro antes de play. En móviles el progreso se
     // aplica solo después de que el video haya dibujado, para no dejar el canvas negro.
     const isPhone=/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
       ||(navigator.maxTouchPoints>1&&matchMedia('(pointer:coarse)').matches);
     let firstFramePromise=null;
     if(isPhone&&typeof player.one==='function'){
       firstFramePromise=new Promise(resolve=>player.one('firstVideoRendered',resolve));
     }
     // Pedir explícitamente audio, video y subtítulos del MKV.
     await player.play({audio:true,video:true,subtitle:true});
     if(request!==serial||!dialog.open){if(session===state)stop();return false;}
     if(isPhone&&player.isSuspended?.()){
       try{await player.resume?.();}catch(err){console.warn('ANTOO PELIS: el navegador no reactivó el audio:',err);}
       if(player.isSuspended?.()&&hint)hint.textContent='El teléfono pausó el audio. Toca reproducir para activarlo.';
     }
     // Si el primer intento no dibuja ningún cuadro, reiniciar AVPlayer una vez
     // automáticamente. Es el mismo reinicio manual que antes necesitaba el usuario.
     if(firstFramePromise){
       let timeoutId=0;
       const rendered=await Promise.race([
         firstFramePromise.then(()=>true),
         new Promise(resolve=>{timeoutId=setTimeout(()=>resolve(false),7000);})
       ]);
       clearTimeout(timeoutId);
       if(request!==serial||!dialog.open){if(session===state)stop();return false;}
       if(!rendered){
         if(startupRetry<1){
           if(hint)hint.textContent='El video tardó en iniciar. Reiniciando AVPlayer…';
           await stop();
           if(!dialog.open)return false;
           return start({url,frame,dialog,hint,title,resumeAt,media,startupRetry:startupRetry+1});
         }
         throw Error('AVPlayer no pudo mostrar el video después de dos intentos.');
       }
     }
     // El renderizador interno se crea durante play, no en load.
     const resumeMilliseconds=Math.max(0,Number(resumeAt)||0)*1000;
     if(Number.isFinite(resumeMilliseconds)&&resumeMilliseconds>0){
       await player.seek(BigInt(Math.round(resumeMilliseconds)));
     }
     window.noctraWatchState?.attach?.(player,{media,resumeAt});
     // Reactivar la pista elegida después del inicio para que libmedia
     // dibuje los subtítulos SRT/SSA ya detectados en el MKV.
     state.options?.syncSubtitleAfterStart?.();
     state.requestResize?.();
     state.controls?.show?.();
     if(hint)hint.textContent='Reproduciendo MKV original con AVPlayer. Idiomas y subtítulos: ⚙ Configuración.';
     return true;
   }catch(err){
     if(session===state)stop();
     throw err;
   }
 }
 window.antooAVPlayerMain={start,stop,get active(){return !!session;}};
})();