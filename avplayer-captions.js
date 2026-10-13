/* ANTOO PELIS · Subtítulos integrados MKV y archivos externos.
 * No modifica los vídeos. Decodificación MKV: libmedia.
 * Archivos SRT/VTT/ASS/SSA: lector independiente, visible en móvil/iOS.
 */
(()=>{
 'use strict';
 const sessions=new WeakMap();
 const clean=t=>String(t||'')
   .replace(/\{\\[^}]*\}/g,'')
   .replace(/\\[Nn]/g,'\n').replace(/\\h/g,' ')
   .replace(/<[^>]*>/g,'').replace(/\r/g,'').trim().slice(0,1500);
 function stamp(v){
   const m=String(v||'').trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/);
   if(!m)return NaN;
   return Number(m[1]||0)*3600+Number(m[2])*60+Number(m[3])+
     Number((m[4]||'0').padEnd(3,'0'))/1000;
 }
 function parseSrtVtt(body){
   const text=String(body||'').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
   const out=[];
   const blocks=text.split(/\n\s*\n/);
   for(const block of blocks){
     const ls=block.trim().split('\n');
     const i=ls.findIndex(l=>l.includes('-->'));
     if(i<0)continue;
     const match=ls[i].match(/(\d{1,3}:\d\d(?::\d\d)?[.,]\d{1,3})\s*-->\s*(\d{1,3}:\d\d(?::\d\d)?[.,]\d{1,3})/);
     if(!match)continue;
     const start=stamp(match[1]),end=stamp(match[2]);
     const txt=clean(ls.slice(i+1).join('\n'));
     if(Number.isFinite(start)&&Number.isFinite(end)&&end>start&&txt)out.push({start,end,text:txt});
   }
   return out.sort((a,b)=>a.start-b.start);
 }
 function parseAss(body){
   const out=[];let events=false,formats=[];
   for(const line of String(body||'').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').split('\n')){
     const l=line.trim();
     if(/^\[/.test(l)){events=/^\[Events\]/i.test(l);continue;}
     if(!events)continue;
     if(/^Format\s*:/i.test(l)){
       formats=l.replace(/^Format\s*:/i,'').split(',').map(x=>x.trim().toLowerCase());
       continue;
     }
     if(!/^Dialogue\s*:/i.test(l)||!formats.length)continue;
     const values=l.replace(/^Dialogue\s*:/i,'').split(',');
     const t=formats.indexOf('text'),a=formats.indexOf('start'),b=formats.indexOf('end');
     if(t<0||a<0||b<0||values.length<formats.length)continue;
     // ASS: el campo Text suele ser el último, y puede contener comas.
     const start=stamp(values[a]),end=stamp(values[b]);
     const txt=clean(values.slice(t,t===formats.length-1?undefined:t+1).join(','));
     if(Number.isFinite(start)&&Number.isFinite(end)&&end>start&&txt)out.push({start,end,text:txt});
   }
   return out.sort((a,b)=>a.start-b.start);
 }
 function parse(text,name){
   return /\.(ass|ssa)$/i.test(name)?parseAss(text):parseSrtVtt(text);
 }
 function create(player,frame,dialog){
   if(!player||!frame||!dialog)return {destroy(){},status(){return 'Motor no disponible'}};
   let disposed=false,hook=null,decoderHook=null,rendered=0,decoded=0,lastEnd=0,mode='native',external=null;
   let nativeCues=[];
   const overlay=document.createElement('div');
   overlay.className='antoo-av-captions-mirror';
   overlay.setAttribute('aria-live','off');
   overlay.setAttribute('aria-hidden','true');
   overlay.hidden=true;
   function mount(){
     // Las capas ASS de libmedia son hijas directas de frame.
     if(overlay.parentNode!==frame)frame.appendChild(overlay);
   }
   function hide(){
     overlay.hidden=true;
     overlay.textContent='';
     if(mode!=='external')frame.classList.remove('antoo-av-captions-mirrored');
   }
   function show(text){
     if(!text){hide();return;}
     mount();
     overlay.textContent=text;
     overlay.hidden=false;
     frame.classList.add('antoo-av-captions-mirrored');
   }
   function clock(){
     try{return Number(player.currentTime)/1000;}catch{return NaN;}
   }
   function pollExternal(){
     const cues=external?.cues;
     if(!cues?.length||mode!=='external')return;
     const t=clock();
     if(!Number.isFinite(t))return;
     // Búsqueda binaria para avanzar o retroceder libremente sin desincronizar.
     let lo=0,hi=cues.length;
     while(lo<hi){const mid=(lo+hi)>>>1;if(cues[mid].start<=t)lo=mid+1;else hi=mid;}
     const visible=[];
     for(let i=lo-1;i>=0&&i>=lo-5;i--){
       if(t>=cues[i].start&&t<cues[i].end)visible.unshift(cues[i].text);
     }
     const subtitle=visible.join('\n');
     if(subtitle!==overlay.textContent||!!subtitle===overlay.hidden)
       subtitle?show(subtitle):hide();
   }
   // Capturar subtítulos desde la SALIDA del decodificador, no desde AssRender.
   // SubRip/SSA con duración nula o tiempos desfasados se decodifican pero el
   // planificador de libmedia puede descartarlos antes de dibujarlos.
   function onDecoded(sub){
     if(disposed||mode!=='native')return;
     const now=clock();
     const pts=Number(sub?.pts)/1000;
     const duration=Number(sub?.duration)/1000;
     const start=Number.isFinite(pts)&&pts>=0?pts:now;
     const end=start+(Number.isFinite(duration)&&duration>.04?Math.min(duration,90):4);
     if(!Number.isFinite(start)||!Number.isFinite(end))return;
     const formats=player.subtitleRender?.formats||[];
     for(const rect of sub?.rects||[]){
       let raw=String(rect?.text||'');
       if(/^Dialogue\s*:/i.test(raw)){
         const fields=raw.replace(/^Dialogue\s*:\s*/i,'').split(',');
         const at=formats.findIndex(x=>String(x).toLowerCase()==='text');
         raw=at>=0?fields.slice(at).join(','):fields.slice(Math.min(9,fields.length-1)).join(',');
       }
       const subtitle=clean(raw);
       if(!subtitle)continue;
       decoded++;
       if(!nativeCues.some(c=>Math.abs(c.start-start)<.04&&c.text===subtitle))
         nativeCues.push({start,end,text:subtitle});
     }
     if(Number.isFinite(now))nativeCues=nativeCues.filter(c=>c.end>=now-6).slice(-150);
   }
   function unhookDecoder(){
     if(decoderHook&&decoderHook.decoder?.options?.onReceiveSubtitle===decoderHook.wrapped)
       decoderHook.decoder.options.onReceiveSubtitle=decoderHook.original;
     decoderHook=null;
   }
   function installDecoderHook(){
     const decoder=player.subtitleRender?.decoder;
     if(!decoder||typeof decoder.options?.onReceiveSubtitle!=='function')return;
     if(decoderHook?.decoder===decoder)return;
     unhookDecoder();
     const original=decoder.options.onReceiveSubtitle;
     const wrapped=function(sub){
       const ret=original.call(this,sub);
       try{onDecoded(sub);}catch(e){console.warn('ANTOO subtítulos recibidos:',e);}
       return ret;
     };
     decoder.options.onReceiveSubtitle=wrapped;
     decoderHook={decoder,original,wrapped};
   }
   function displayDecoded(){
     const t=clock();if(!Number.isFinite(t))return;
     nativeCues=nativeCues.filter(c=>c.end>=t-5);
     const active=nativeCues.filter(c=>t>=c.start-.15&&t<c.end);
     if(active.length){
       const txt=active.slice(-2).map(c=>c.text).join('\n');
       lastEnd=Math.max(lastEnd,...active.map(c=>c.end));
       if(overlay.hidden||overlay.textContent!==txt)show(txt);
     }
     else if(!overlay.hidden&&lastEnd>0&&(t>lastEnd+.15||t<lastEnd-20))hide();
   }
   function install(){
     if(disposed)return;
     mount();
     const renderer=player.subtitleRender?.render;
     if(!renderer||typeof renderer.render!=='function')return;
     if(hook?.renderer===renderer){installDecoderHook();return;}
     unhook();
     const original=renderer.render;
     const replacement=function(event){
       let result;
       try{result=original.call(this,event);}
       catch(err){console.warn('ANTOO render de subtítulos ASS:',err);}
       if(!disposed&&mode==='native'){
         try{
           const source=event?.Text;
           const text=clean(typeof source==='string'?source:source?.combined||source?.raw||'');
           const end=Number(event?.End);
           // AssRender transforma End de milisegundos a segundos al renderizar.
           const secs=typeof event?.End==='bigint'||end>1e6?end/1000:end;
           if(text){
             rendered++;
             lastEnd=Number.isFinite(secs)?secs:clock()+4;
             show(text);
           }
         }catch(e){console.warn('ANTOO lectura de subtítulo MKV:',e);}
       }
       return result;
     };
     renderer.render=replacement;
     hook={renderer,original,replacement};
     installDecoderHook();
   }
   function unhook(){
     if(hook&&hook.renderer&&hook.renderer.render===hook.replacement)hook.renderer.render=hook.original;
     hook=null;
     unhookDecoder();
   }
   const interval=setInterval(()=>{
     if(disposed)return;
     install();
     if(mode==='external'){pollExternal();return;}
     if(mode!=='native'){hide();return;}
     displayDecoded();
   },100);
   install();
   const instance={
     clear(){lastEnd=0;nativeCues=[];hide();},
     useNative(){
       external=null;mode='native';lastEnd=0;nativeCues=[];hide();
     },
     setEnabled(on){
       if(!on){mode='off';nativeCues=[];hide();frame.classList.remove('antoo-av-captions-mirrored');}
       else{mode=external?'external':'native';hide();if(external)pollExternal();}
     },
     async loadFile(file){
       if(!file||!/\.(srt|vtt|ass|ssa)$/i.test(file.name))
         throw Error('Solo se admiten archivos SRT, VTT, ASS o SSA.');
       const text=await file.text();
       const cues=parse(text,file.name);
       if(!cues.length)throw Error('No se encontraron diálogos con tiempos válidos.');
       external={name:file.name,cues};
       mode='external';
       hide();pollExternal();
       return cues.length;
     },
     selectExternal(){
       if(!external)return false;
       mode='external';hide();pollExternal();return true;
     },
     get externalName(){return external?.name||'';},
     status(){
       if(external)return 'SRT/VTT externo activo ('+external.cues.length+' diálogos)';
       const sr=player.subtitleRender;
       if(!sr)return 'No se inició el decodificador de subtítulos del MKV.';
       if(!sr.render)return 'Hay una pista, pero no se creó el renderizador de texto.';
       if(decoded)return 'Decodificados '+decoded+' subtítulos del MKV; visibles sin depender de ASS.';
       if(rendered)return 'Renderizados '+rendered+' diálogos del MKV.';
       const hasPort=Boolean(sr.currentPort);
       const q=Array.isArray(sr.queue)?sr.queue.length:'?';
       return hasPort
         ?'Decodificador conectado, sin diálogos recibidos (cola: '+q+', fin: '+!!sr.ended+').'
         :'Pista seleccionada, esperando conexión de subtítulos del MKV.';
     },
     destroy(){
       disposed=true;clearInterval(interval);unhook();
       frame.classList.remove('antoo-av-captions-mirrored');
       overlay.remove();sessions.delete(player);
     }
   };
   sessions.set(player,instance);
   return instance;
 }
 window.antooAVCaptions={
   create,
   status:p=>sessions.get(p)?.status()||'',
   clear:p=>sessions.get(p)?.clear(),
   useNative:p=>sessions.get(p)?.useNative(),
   setEnabled:(p,on)=>sessions.get(p)?.setEnabled(on),
   loadFile:(p,f)=>sessions.get(p)?.loadFile(f),
   selectExternal:p=>sessions.get(p)?.selectExternal(),
   externalName:p=>sessions.get(p)?.externalName||''
 };
})();