/* ANTOO PELIS - Configuracion funcional para libmedia AVPlayerUI.
   Trabaja con las pistas reales del MKV sin generar calidades inexistentes. */
(()=>{
 'use strict';
 const byId=id=>document.getElementById(id);
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
     '<label class="antoo-av-sub-file">Cargar subtítulos externos (SRT o VTT)<input type="file" id="antoo-av-sub-file" accept=".srt,.vtt,.ass,.ssa" /></label>'+
     '<label for="antoo-av-video">Calidad / pista de video</label>'+
     '<select id="antoo-av-video" aria-label="Calidad de video"></select>'+
     '<p class="antoo-av-quality-note" id="antoo-av-quality-note"></p>'+
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
   const status=get('#antoo-av-settings-status');
   const hint=get('#antoo-av-quality-note');
   const file=get('#antoo-av-sub-file');
   let sets={audio:[],subtitle:[],video:[]};
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
     let streams=[];
     try{streams=player.getStreams?.()||[];}catch(e){console.warn('ANTOO pistas:',e);}
     sets={audio:[],subtitle:[],video:[]};
     for(const stream of streams){
       const type=kind(stream);
       if(sets[type])sets[type].push(stream);
     }
     populate(audio,sets.audio,player.getSelectedAudioStreamId?.(),'Este archivo no tiene pistas de audio');
     const selected=player.getSelectedSubtitleStreamId?.();
     subs.replaceChildren();
     let no=document.createElement('option');
     no.value='off';no.textContent='Desactivados';subs.appendChild(no);
     sets.subtitle.forEach((s,i)=>{
       const opt=document.createElement('option');
       opt.value=String(s.id);opt.textContent=label(s,'subtitle',i);
       opt.selected=Number(s.id)===Number(selected);
       subs.appendChild(opt);
     });
     subs.disabled=false;
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
     if(subs.value==='off'){player.setSubtitleEnable?.(false);return;}
     await player.selectSubtitle(Number(subs.value));
     player.setSubtitleEnable?.(true);
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
       await player.loadExternalSubtitle({title:selected.name.replace(/\.[^.]+$/,''),source:selected});
       refresh();
       message('Subtítulos añadidos. Selecciona la nueva pista en la lista.');
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
     refresh,open:show,
     destroy(){close();
       host.removeEventListener('click',captureGear,true);
       host.removeEventListener('pointerup',captureGear,true);
       host.removeEventListener('touchend',captureGear,true);
       document.removeEventListener('keydown',keyHandler,true);panel.remove();}
   };
 }
 window.antooAvplayerOptions={create};
})();