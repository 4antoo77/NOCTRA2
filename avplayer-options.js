/* ANTOO PELIS - Configuracion funcional para libmedia AVPlayerUI.
   Trabaja con las pistas reales del MKV sin generar calidades inexistentes. */
(()=>{
 'use strict';
 // Códecs de texto compatibles con el renderizador de subtítulos de libmedia.
 // Los subtítulos gráficos PGS/DVD/DVB presentes en algunos MKV no lo son.
 const textSubtitleCodecs=new Set([94210,94212,94213,94225,94226,94230,94232]);
 function textSubtitleSupported(stream){
   const id=Number((stream.codecparProxy||stream.codecpar||{}).codecId);
   return !Number.isFinite(id)||textSubtitleCodecs.has(id);
 }
 function kind(stream){
   const media=String(stream?.mediaType||'').toLowerCase();
   if(media.includes('subtitle'))return 'subtitle';
   if(media.includes('audio'))return 'audio';
   if(media.includes('video'))return 'video';
   const type=Number(stream?.codecpar?.codecType);
   return type===0?'video':type===1?'audio':type===3?'subtitle':'unknown';
 }
 function label(stream,type,index){
   const m=stream.metadata||{};
   const lang=m.languageString||m.language||'';
   const title=m.title||m.name||'';
   const c=stream.codecparProxy||stream.codecpar||{};
   const dimensions=(c.width&&c.height)?' · '+c.width+'×'+c.height:'';
   const codec=c.codecId&&type==='video'?' · Códec '+c.codecId:'';
   const main=String(title||lang||('Pista '+(index+1)));
   return main+(title&&lang?' · '+lang:'')+(type==='video'?dimensions+codec:'');
 }
 function create(player,host){
   if(!player||!host)return {destroy(){}};
   let open=false,busy=false;
   const panel=document.createElement('div');
   panel.className='antoo-av-options';
   panel.hidden=true;
   panel.setAttribute('role','dialog');
   panel.setAttribute('aria-modal','true');
   panel.setAttribute('aria-label','Opciones de reproducción');
   panel.innerHTML='<div class="antoo-av-options-shade"></div>'+
     '<section class="antoo-av-options-content" aria-labelledby="antoo-av-options-title">'+
     '<header class="antoo-av-options-head"><h2 id="antoo-av-options-title">Opciones de reproducción</h2>'+
     '<button type="button" class="antoo-av-options-close" aria-label="Cerrar configuración">✕</button></header>'+
     '<div class="antoo-av-options-main">'+
     '<label for="antoo-av-audio">Idioma y pista de audio</label>'+
     '<select id="antoo-av-audio" aria-label="Pista de audio"></select>'+
     '<label for="antoo-av-subtitles">Subtítulos</label>'+
     '<select id="antoo-av-subtitles" aria-label="Pista de subtítulos"></select>'+
     '<p class="antoo-av-quality-note" id="antoo-av-subtitle-help"></p>'+
     '<label class="antoo-av-sub-file">Cargar subtítulos externos (SRT o VTT)<input type="file" id="antoo-av-sub-file" accept=".srt,.vtt,.ass,.ssa" /></label>'+
     '<label for="antoo-av-video">Pista de video del archivo</label>'+
     '<select id="antoo-av-video" aria-label="Calidad de video"></select>'+
     '<p class="antoo-av-quality-note" id="antoo-av-quality-note"></p>'+
     '<label for="antoo-av-aspect">Formato de pantalla</label>'+
     '<select id="antoo-av-aspect" aria-label="Relación de aspecto del video">'+
     '<option value="original" selected>Original · Ajustar sin recortar</option>'+
     '<option value="16:9">16:9 · Panorámico</option>'+
     '<option value="4:3">4:3 · Clásico</option>'+
     '<option value="21:9">21:9 · Cine</option>'+
     '<option value="fill">Rellenar pantalla · Recortar bordes</option></select>'+
     '<p class="antoo-av-quality-note">Cambia el encuadre de pantalla, no la resolución ni el peso del archivo.</p>'+
     '<label for="antoo-av-speed">Velocidad</label>'+
     '<select id="antoo-av-speed" aria-label="Velocidad de reproducción">'+
     '<option value="0.5">0.5×</option><option value="0.75">0.75×</option>'+
     '<option value="1" selected>Normal (1×)</option><option value="1.25">1.25×</option>'+
     '<option value="1.5">1.5×</option><option value="2">2×</option></select>'+
     '<p id="antoo-av-settings-status" class="antoo-av-settings-status" role="status"></p>'+
     '</div></section>';
   host.appendChild(panel);
   const get=sel=>panel.querySelector(sel);
   const audio=get('#antoo-av-audio');
   const subs=get('#antoo-av-subtitles');
   const video=get('#antoo-av-video');
   const speed=get('#antoo-av-speed');
   const aspect=get('#antoo-av-aspect');
   const status=get('#antoo-av-settings-status');
   const hint=get('#antoo-av-quality-note');
   const file=get('#antoo-av-sub-file');
   let sets={audio:[],subtitle:[],video:[]};
   let subtitleOff=false;
   function selectedSubtitleId(){
     try{return Number(player.getSelectedSubtitleStreamId?.()??-1);}
     catch{return -1;}
   }
   // Libmedia puede conservar la pista seleccionada después de que el
   // renderizador de texto haya dejado de mostrar cues. Para reactivarlo,
   // reiniciar el motor de ASS/SRT además de confirmar el stream ID.
   async function activateSubtitle(id){
     if(!Number.isFinite(id)||id<0)
       throw Error('No hay una pista válida para activar.');
     const actual=selectedSubtitleId();
     if(actual!==id){
       if(typeof player.selectSubtitle!=='function')
         throw Error('El reproductor no permite cambiar la pista.');
       await player.selectSubtitle(id);
     }
     if(selectedSubtitleId()!==id)
       throw Error('El reproductor no ha seleccionado esta pista.');
     if(typeof player.setSubtitleEnable==='function'){
       player.setSubtitleEnable(false);
       player.setSubtitleEnable(true);
     }
   }
   function syncSubtitleAfterStart(){
     const selected=selectedSubtitleId();
     if(subtitleOff||selected<0)return;
     const stream=(player.getStreams?.()||[]).find(track=>Number(track.id)===selected);
     if(stream&&kind(stream)==='subtitle'&&textSubtitleSupported(stream)){
       try{player.setSubtitleEnable?.(true);}
       catch(err){console.warn('ANTOO subtítulos al iniciar:',err);}
     }
     refresh();
   }
   let format='original', resizeObserver=null, resizeFrame=0, resizeTail=0, resizeFrameLast=0;
   const stage=()=>host.querySelector('.avplayer-ui-player');
   const dimensionKey=['position','inset','top','left','right','bottom','width','height','min-width','min-height','max-width','max-height','transform'];
   function layoutAspect(){
     const el=stage();if(!el)return;
     if(format==='original'||format==='fill'){
       dimensionKey.forEach(k=>el.style.removeProperty(k));
     }else{
       const ratio=format==='4:3'?4/3:format==='16:9'?16/9:21/9;
       const W=host.clientWidth,H=host.clientHeight;
       if(!(W>0&&H>0))return;
       const w=Math.round(Math.min(W,H*ratio));
       const h=Math.round(Math.min(H,W/ratio));
       const declarations={
         position:'absolute',inset:'auto',left:Math.round((W-w)/2)+'px',
         top:Math.round((H-h)/2)+'px',right:'auto',bottom:'auto',
         width:w+'px',height:h+'px','min-width':'0px','min-height':'0px',
         'max-width':'none','max-height':'none',transform:'none'
       };
       Object.entries(declarations).forEach(([key,val])=>el.style.setProperty(key,val,'important'));
     }
     // Libmedia no reajusta automáticamente el lienzo al cambiar solo
     // las dimensiones CSS: informar la nueva área de reproducción.
     const width=Math.round(el.clientWidth),height=Math.round(el.clientHeight);
     if(width&&height&&Number(player.getStatus?.()??0)>=4){
       const stamp=format+':'+width+'x'+height;
       if(stamp!==resizeFrameLast){
         resizeFrameLast=stamp;
         try{player.setRenderMode?.(format==='original'?0:1);}catch(e){console.warn('ANTOO formato:',e);}
         try{player.resize?.(width,height);}catch(e){console.warn('ANTOO video:',e);}
       }
     }
   }
   function scheduleAspect(){
     if(resizeFrame)cancelAnimationFrame(resizeFrame);
     clearTimeout(resizeTail);
     resizeFrame=requestAnimationFrame(()=>{resizeFrame=0;layoutAspect();});
     resizeTail=setTimeout(layoutAspect,180);
   }
   aspect.addEventListener('change',()=>{
     format=aspect.value;
     resizeFrameLast=0;
     scheduleAspect();
     message(format==='original'?'Formato original restaurado.':
       format==='fill'?'Rellenando pantalla (puede recortar imagen).':
       'Formato '+format+' aplicado (puede recortar imagen).');
   });
   if(typeof ResizeObserver==='function'){
     resizeObserver=new ResizeObserver(scheduleAspect);
     resizeObserver.observe(host);
   }
   window.addEventListener('resize',scheduleAspect);
   window.addEventListener('orientationchange',scheduleAspect);
   function message(t){status.textContent=t||'';}
   function populate(select,items,selectedId,empty){
     select.replaceChildren();
     if(!items.length){
       const opt=document.createElement('option');
       opt.textContent=empty;opt.value='';select.appendChild(opt);
       select.disabled=true;return;
     }
     select.disabled=items.length===1;
     items.forEach((s,i)=>{
       const opt=document.createElement('option');
       opt.value=String(s.id);opt.textContent=label(s,select===video?'video':'audio',i);
       opt.selected=Number(s.id)===Number(selectedId);
       select.appendChild(opt);
     });
   }
   function refresh(){
     scheduleAspect();
     let streams=[];
     try{streams=player.getStreams?.()||[];}catch(e){console.warn('ANTOO pistas:',e);}
     sets={audio:[],subtitle:[],video:[]};
     for(const stream of streams){
       const type=kind(stream);
       if(sets[type])sets[type].push(stream);
     }
     populate(audio,sets.audio,player.getSelectedAudioStreamId?.(),'Este archivo no tiene pistas de audio');
     const selected=selectedSubtitleId();
     subs.replaceChildren();
     const no=document.createElement('option');
     no.value='off';no.textContent='Desactivados';
     no.selected=subtitleOff||selected<0;
     subs.appendChild(no);
     let supportedCount=0;
     sets.subtitle.forEach((track,i)=>{
       const opt=document.createElement('option');
       opt.value=String(track.id);
       const supported=textSubtitleSupported(track);
       if(supported)supportedCount++;
       opt.textContent=label(track,'subtitle',i)+(supported?'':' · No compatible (gráfico)');
       opt.disabled=!supported;
       opt.selected=!subtitleOff&&supported&&Number(track.id)===selected;
       subs.appendChild(opt);
     });
     // Mantener el selector desactivado si solo hay pistas de subtítulos
     // gráficos que libmedia no decodifica; SRT externo sigue disponible.
     subs.disabled=supportedCount===0;
     const subHelp=get('#antoo-av-subtitle-help');
     if(subHelp){
       subHelp.textContent=!sets.subtitle.length
         ?'No se detectaron subtítulos integrados. Puedes cargar un SRT, ASS o VTT.'
         :supportedCount===0
           ?'Los subtítulos integrados parecen ser gráficos (por ejemplo PGS). Este reproductor solo decodifica subtítulos de texto; puedes cargar un SRT o VTT externo.'
           :'Selecciona la pista de texto deseada. Si la película no tiene diálogo subtitulado en ese momento, espera a que aparezca.';
     }
     populate(video,sets.video,player.getSelectedVideoStreamId?.(),'Video no disponible');
     if(sets.video.length===1){
       const s=sets.video[0],p=s.codecparProxy||s.codecpar||{};
       hint.textContent='Calidad original'+(p.width&&p.height?' ('+p.width+' × '+p.height+')':'')+
         '. Este MKV tiene una sola pista de video; no hay calidades alternativas que seleccionar.';
       const opt=video.options[0];
       if(opt)opt.textContent='Original'+(p.width&&p.height?' · '+p.width+'×'+p.height:'');
     }else if(sets.video.length>1){
       hint.textContent='Puedes elegir entre las '+sets.video.length+' pistas de video incluidas en este archivo MKV.';
     }else{
       hint.textContent='No se pudo detectar una pista de video.';
     }
   }
   async function change(type,select,callback){
     if(busy)return;
     busy=true;select.disabled=true;
     message('Cambiando '+type+'…');
     try{await callback();message(type+' actualizado.');}
     catch(e){message('No se pudo cambiar '+type+': '+(e?.message||e));}
     finally{busy=false;refresh();}
   }
   audio.addEventListener('change',()=>change('el audio',audio,()=>player.selectAudio(Number(audio.value))));
   subs.addEventListener('change',()=>change('los subtítulos',subs,async()=>{
     if(subs.value==='off'){
       subtitleOff=true;
       player.setSubtitleEnable?.(false);
       return;
     }
     const id=Number(subs.value);
     const stream=sets.subtitle.find(track=>Number(track.id)===id);
     if(!stream||!textSubtitleSupported(stream))
       throw Error('Esta pista de subtítulos no es compatible. Carga un archivo SRT o VTT.');
     await activateSubtitle(id);
     subtitleOff=false;
   }));
   video.addEventListener('change',()=>change('la pista de video',video,()=>player.selectVideo(Number(video.value))));
   speed.addEventListener('change',()=>{
     try{player.setPlaybackRate(Number(speed.value));message('Velocidad actualizada.');}
     catch(e){message('No se pudo cambiar la velocidad: '+(e?.message||e));}
   });
   file.addEventListener('change',async()=>{
     const selected=file.files?.[0];
     if(!selected)return;
     if(selected.size>15*1024*1024){message('El archivo de subtítulos es demasiado grande (máximo 15 MB).');file.value='';return;}
     try{
       if(typeof player.loadExternalSubtitle!=='function')throw Error('No se admiten subtítulos externos en este motor.');
       const before=new Set((player.getStreams?.()||[]).map(s=>Number(s.id)));
       await player.loadExternalSubtitle({title:selected.name.replace(/\.[^.]+$/,''),source:selected});
       refresh();
       const added=sets.subtitle.find(s=>!before.has(Number(s.id)));
       if(!added)throw Error('El archivo no creó una pista de subtítulos compatible.');
       await activateSubtitle(Number(added.id));
       subtitleOff=false;
       refresh();
       message('Subtítulos externos cargados y activados: '+selected.name);
     }catch(e){message('No se pudieron cargar los subtítulos: '+(e?.message||e));}
     file.value='';
   });
   function close(){open=false;panel.hidden=true;}
   function show(){refresh();message('');open=true;panel.hidden=false;get('.antoo-av-options-close').focus();}
   // AVPlayerUI usa clics del mouse. Algunos WebKit táctiles no emiten
   // el click sintético sobre sus controles SVG: atendemos pointerup/touchend.
   // Al llegar también el click lo suprimimos para no abrir y cerrar dos veces.
   let lastTouchAction=0;
   function captureGear(e){
     const origin=e.target;
     if(!(origin instanceof Element))return;
     const gear=origin.closest('.avplayer-ui-control-settings');
     if(!gear||!host.contains(gear))return;
     if(e.type==='pointerup'&&e.pointerType!=='touch')return;
     const now=Date.now();
     const duplicate=now-lastTouchAction<450;
     e.preventDefault();e.stopImmediatePropagation();e.stopPropagation();
     if(duplicate)return;
     if(e.type!=='click')lastTouchAction=now;
     try{player.ui?.set?.('showSettings',false);}catch{}
     if(open)close();else show();
   }
   host.addEventListener('click',captureGear,true);
   host.addEventListener('pointerup',captureGear,true);
   host.addEventListener('touchend',captureGear,{capture:true,passive:false});
   get('.antoo-av-options-close').addEventListener('click',close);
   get('.antoo-av-options-shade').addEventListener('click',close);
   const keyHandler=e=>{if(open&&e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}};
   document.addEventListener('keydown',keyHandler,true);
   return {
     refresh,open:show,syncSubtitleAfterStart,
     destroy(){close();
       host.removeEventListener('click',captureGear,true);
       host.removeEventListener('pointerup',captureGear,true);
       host.removeEventListener('touchend',captureGear,true);
       document.removeEventListener('keydown',keyHandler,true);
       window.removeEventListener('resize',scheduleAspect);
       window.removeEventListener('orientationchange',scheduleAspect);
       resizeObserver?.disconnect();
       if(resizeFrame)cancelAnimationFrame(resizeFrame);
       clearTimeout(resizeTail);
       const el=stage();if(el)dimensionKey.forEach(k=>el.style.removeProperty(k));
       panel.remove();}
   };
 }
 window.antooAvplayerOptions={create};
})();