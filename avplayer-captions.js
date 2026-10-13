/* ANTOO PELIS · Respaldo visual para subtítulos de texto MKV.
 * Conserva el demux/decodificador de libmedia; solo refleja los diálogos
 * de SRT, ASS/SSA y WebVTT encima del vídeo cuando Safari no los muestra.
 * Nunca lee ni modifica archivos originales. */
(()=>{
 'use strict';
 const sessions=new WeakMap();
 function cleanText(event){
   const source=event?.Text;
   let text=typeof source==='string'?source:
     (source?.combined||source?.raw||'');
   if(typeof text!=='string')return '';
   // Los códigos ASS son marcas de formato, no diálogos.
   text=text.replace(/\{\\[^}]*\}/g,'')
     .replace(/\\[Nn]/g,'\n').replace(/\\h/g,' ')
     .replace(/\r/g,'').replace(/<[^>]*>/g,'').trim();
   return text.length>1000?text.slice(0,1000):text;
 }
 function create(player,frame,dialog){
   if(!player||!frame||!dialog)return {destroy(){},status(){return 'No disponible';}};
   let disposed=false,wrapped=null,rendered=0,lastCue='',lastEnd=0;
   const overlay=document.createElement('div');
   overlay.className='antoo-av-captions-mirror';
   overlay.setAttribute('aria-live','off');
   overlay.setAttribute('aria-hidden','true');
   overlay.hidden=true;
   let surface=null;
   function mount(){
     const host=frame.querySelector('.avplayer-ui-player');
     if(host&&host!==surface){surface=host;surface.appendChild(overlay);}
   }
   function install(){
     if(disposed)return;
     mount();
     // subtitleRender es una propiedad TS "private" que en libmedia se
     // mantiene como propiedad JS durante la reproducción.
     const sr=player.subtitleRender;
     const renderer=sr?.render;
     if(!renderer||typeof renderer.render!=='function')return;
     if(wrapped?.renderer===renderer)return;
     unhook();
     const original=renderer.render;
     const replacement=function(event){
       let result;
       try{return result=original.call(this,event);}
       finally{
         if(!disposed){
           try{
             const text=cleanText(event);
             const end=Number(event?.End);
             if(text){
               rendered++;
               lastCue=text;
               lastEnd=Number.isFinite(end)?(end>1e8?end/1000:end):Number(player.currentTime)/1000+4;
               // Mostrar el texto original del subtítulo en una capa DOM
               // independiente, por encima del canvas y fuera del footer.
               overlay.textContent=text;
               overlay.hidden=false;
               frame.classList.add('antoo-av-captions-mirrored');
             }
           }catch(e){console.warn('ANTOO respaldo subtítulos:',e);}
         }
       }
     };
     renderer.render=replacement;
     wrapped={renderer,original,replacement};
   }
   function unhook(){
     if(wrapped&&wrapped.renderer&&wrapped.renderer.render===wrapped.replacement)
       wrapped.renderer.render=wrapped.original;
     wrapped=null;
   }
   const poll=setInterval(()=>{
     if(disposed)return;
     install();
     if(!overlay.hidden){
       const t=Number(player.currentTime)/1000;
       if(Number.isFinite(t)&&lastEnd>0&&(t>lastEnd+.1||t<lastEnd-20)){
         overlay.hidden=true;
         overlay.textContent='';
       }
     }
   },130);
   install();
   const instance={
     status(){
       const sr=player.subtitleRender;
       if(!sr)return 'El motor de subtítulos no se ha iniciado.';
       if(!sr.render)return 'Motor detectado, pero sin dibujador disponible.';
       if(rendered===0)return 'Motor disponible. Esperando el próximo diálogo.';
       return 'Modo de subtítulos compatible activo ('+rendered+' diálogos).';
     },
     destroy(){
       disposed=true;clearInterval(poll);unhook();
       frame.classList.remove('antoo-av-captions-mirrored');
       overlay.remove();
       sessions.delete(player);
     }
   };
   sessions.set(player,instance);
   return instance;
 }
 window.antooAVCaptions={create,status(player){return sessions.get(player)?.status()||'';}};
})();