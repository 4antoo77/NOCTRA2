/* Automatic TMDB metadata engine; administrator reviews unmatched titles and overrides wrong matches. */
(()=>{
'use strict';
const TYPES=['Acción','Ciencia ficción','Drama','Suspenso','Documental','Animación','Comedia','Terror','Otros'];
const el=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text)x.textContent=text;return x;};
const https=v=>{if(!v)return '';try{let u=new URL(v);return u.protocol==='https:'?u.href:'';}catch{return '';}};
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const clean=s=>String(s||'').replace(/\.(mkv|mp4|avi|mov|webm|m4v|ts)$/i,'').replace(/[._]/g,' ').replace(/[\[(]((?:19|20)\d{2})[\])]/g,' ').replace(/\b(?:19|20)\d{2}\b/g,' ').replace(/\b(1080p|2160p|720p|480p|webrip|web.?dl|bluray|x264|x265|hevc|brrip|hdr|dual|latino)\b/gi,' ').replace(/\s+[A-Z]\s*$/,'').replace(/\s{2,}/g,' ').trim();
function mount(target,api,request){
 if(!target||api?.user?.role!=='admin')return;
 if(target.firstChild){target.noctraRefresh?.();return;}
 const box=el('div','noctra-meta-editor'),msg=el('p','admin-note','NOCTRA2 busca los metadatos automáticamente. Aquí solo corriges coincidencias incorrectas o títulos pendientes.');
 const progress=el('div','noctra-meta-progress','Comprobando metadatos automáticos…');
 const retryBtn=el('button','secondary','Volver a buscar este título');retryBtn.type='button';
 const syncBtn=el('button','secondary','Comprobar ahora');syncBtn.type='button';
 const label=(text,child)=>{const node=el('label','',text);node.append(child);return node;};
 const picker=el('select');picker.id='metadata-item';
 const filter=el('input');filter.type='search';filter.placeholder='Buscar dentro de tu catálogo';
 const onlyReview=el('input');onlyReview.type='checkbox';onlyReview.style.width='auto';
 const reviewLabel=label('Mostrar solo títulos que necesitan revisión',onlyReview);
 reviewLabel.classList.add('noctra-meta-review-switch');
 const query=el('input');query.type='search';query.placeholder='Título para buscar en TMDB';query.maxLength=120;
 const tools=el('div','button-row');
 const searchBtn=el('button','secondary','Buscar y elegir');
 const autoBtn=el('button','secondary','Autocompletar');
 for(const b of [searchBtn,autoBtn])b.type='button';
 tools.append(searchBtn,autoBtn,retryBtn,syncBtn);
 const results=el('div','noctra-meta-results');results.hidden=true;
 const form=el('form','noctra-meta-form');
 const title=el('input');title.maxLength=150;title.required=true;
 const year=el('input');year.maxLength=4;year.inputMode='numeric';year.placeholder='2026';
 const genre=el('select');for(const value of TYPES)genre.add(new Option(value,value));
 const description=el('textarea');description.rows=4;description.maxLength=750;
 const poster=el('input');poster.type='url';poster.placeholder='https://...';
 const save=el('button','primary','Guardar ficha');save.type='submit';
 const pic=el('img','noctra-meta-art');pic.alt='Vista previa';pic.hidden=true;
 pic.onerror=()=>pic.hidden=true;
 poster.addEventListener('input',()=>{const v=https(poster.value.trim());pic.hidden=!v;if(v)pic.src=v;});
 const seriesNote=el('small','admin-note','Para una serie, la ficha se comparte entre episodios sin cambiar sus títulos.');
 form.append(label('Título',title),label('Género',genre),label('Año',year),label('Sinopsis',description),label('Portada (URL HTTPS)',poster),pic,seriesNote,save);
 const credit=el('p','admin-note','Metadatos de TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.');
 const tmdb=document.createElement('a');tmdb.href='https://www.themoviedb.org';tmdb.target='_blank';tmdb.rel='noopener';tmdb.textContent='The Movie Database';
 const logo=document.createElement('img');logo.alt='TMDB';logo.width=44;logo.style.cssText='width:44px;height:auto;vertical-align:middle;margin-right:8px';logo.src='https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_1-5bdc75aaebeb75dc7ae79426ddd9be3b2be1e342510f8202baf6bffa71d7f5c4.svg';
 credit.prepend(logo,tmdb,document.createTextNode(' — '));
 box.append(msg,progress,label('Buscar en el catálogo',filter),reviewLabel,label('Selecciona una película o serie',picker),label('Buscar título en TMDB',query),tools,results,form,credit);
 target.append(box);
 let items=[],current=null,lastTmdb=null;
 function status(s){msg.textContent=s;}
 function refresh(){
   const previous=picker.value;items=[];let seen=new Set();
   for(const m of api.movies||[]){
     if(!m.fileId)continue;
     const group=String(m.seriesName||'').trim();
     const key=group?'tv:'+group.toLocaleLowerCase('es').trim():'movie:'+m.fileId;
     if(seen.has(key))continue;seen.add(key);
     items.push({key,name:group||m.title,type:group?'tv':'movie',movie:m});
   }
   items.sort((a,b)=>a.name.localeCompare(b.name,'es'));
   picker.replaceChildren();
   if(!items.length){picker.add(new Option('Publica primero tus películas',''));form.hidden=true;status('El catálogo está vacío.');return;}
   const term=norm(filter.value);
   const displayed=items.filter(x=>(!term||norm(x.name).includes(term))&&(!onlyReview.checked||x.movie.metadataStatus==='review'));
   if(!displayed.length){picker.add(new Option('No hay títulos con esos filtros',''));form.hidden=true;current=null;status('No hay títulos con esos filtros.');return;}
   for(const x of displayed){
     const flag=x.movie.metadataStatus==='auto'?'✓ ':x.movie.metadataStatus==='manual'?'✎ ':x.movie.metadataStatus==='review'?'⚠ ':'○ ';
     picker.add(new Option(flag+(x.type==='tv'?'Serie: ':'Película: ')+x.name,x.key));
   }
   picker.value=displayed.some(x=>x.key===previous)?previous:(displayed.find(x=>x.movie.metadataStatus==='review')||displayed[0]).key;
   changed();
 }
 function changed(){
   current=items.find(x=>x.key===picker.value);
   if(!current)return;
   const m=current.movie;lastTmdb={tmdbId:m.tmdbId||null,rating:m.rating||0,duration:m.duration||0};
   title.value=m.seriesTitle||current.name;title.readOnly=false;
   genre.value=TYPES.includes(m.genre)?m.genre:'Otros';
   year.value=m.year||'';description.value=m.description||'';poster.value=m.poster||'';
   poster.dispatchEvent(new Event('input'));
   query.value=clean(current.name);
   results.hidden=true;results.replaceChildren();form.hidden=false;
   status(m.metadataStatus==='review'?'No se encontró una coincidencia segura: busca y selecciona la ficha correcta.':m.metadataStatus==='auto'?'Metadatos automáticos: puedes corregirlos si no coinciden.':m.metadataStatus==='manual'?'Esta ficha se editó manualmente y no será reemplazada automáticamente.':'NOCTRA2 procesará este título automáticamente.');
 }
 picker.onchange=changed;filter.oninput=refresh;onlyReview.onchange=refresh;
 target.noctraRefresh=refresh;
 async function lookup(){
   if(query.value.trim().length<2)throw Error('Introduce un título.');
   const data=await request('/api/admin/metadata/search?type='+current.type+'&q='+encodeURIComponent(query.value.trim()));
   return data.results||[];
 }
 async function pick(match){
   const key=current.key;status('Consultando la ficha…');
   try{
     const data=await request('/api/admin/metadata/details?type='+current.type+'&id='+match.id);
     if(current.key!==key)return;
     const m=data.metadata;lastTmdb={tmdbId:m.tmdbId||null,rating:m.rating||0,duration:m.duration||0};
     if(m.title&&current.type==='movie')title.value=m.title;
     if(m.genre)genre.value=TYPES.includes(m.genre)?m.genre:'Otros';
     if(m.year)year.value=m.year;
     if(m.description)description.value=m.description;
     if(m.poster)poster.value=m.poster;
     poster.dispatchEvent(new Event('input'));
     results.hidden=true;status('Ficha encontrada. Revísala y pulsa «Guardar ficha».');
   }catch(e){status(e.message);}
 }
 function showMatches(matches){
   results.replaceChildren();results.hidden=!matches.length;
   for(const m of matches){
     const button=el('button','noctra-meta-result');button.type='button';
     if(m.poster){const image=el('img');image.alt='';image.loading='lazy';image.src=m.poster;button.append(image);}
     const detail=el('span');
     detail.append(el('strong','',m.title),el('small','',m.year||'Sin año'));
     button.append(detail);button.onclick=()=>pick(m);results.append(button);
   }
 }
 async function lookupClick(automatic){
   if(!current)return;
   const button=automatic?autoBtn:searchBtn;
   button.disabled=true;status('Buscando en TMDB…');
   try{
     const matches=await lookup();
     if(automatic){
       const exact=matches.filter(m=>norm(m.title)===norm(query.value)&&(!year.value||!m.year||m.year===year.value));
       if(exact.length===1){await pick(exact[0]);return;}
       status('Hay varias coincidencias o ninguna exacta: selecciona la correcta.');
     }else status(matches.length?'Elige la ficha correcta.':'No hay coincidencias; puedes editar manualmente.');
     showMatches(matches);
   }catch(e){
     status(/Ruta no encontrada/.test(e.message)?'Búsqueda pendiente de activar en Cloudflare. La edición manual ya funciona.':e.message);
   }finally{button.disabled=false;}
 }
 searchBtn.onclick=()=>lookupClick(false);autoBtn.onclick=()=>lookupClick(true);
 retryBtn.onclick=async()=>{
   if(!current||!confirm('¿Volver a intentar los metadatos automáticos de '+current.name+'?'))return;
   retryBtn.disabled=true;
   try{
     await request('/api/admin/metadata/retry',{method:'POST',body:{key:current.key}});
     status('El título se volverá a comprobar automáticamente.');
     window.noctraMetadataAdmin?.autoStart?.(api,request,true);
   }catch(e){status(e.message);}finally{retryBtn.disabled=false;}
 };
 syncBtn.onclick=()=>window.noctraMetadataAdmin?.autoStart?.(api,request,true);
 form.onsubmit=async event=>{
   event.preventDefault();if(!current)return;
   const name=title.value.trim(),image=https(poster.value.trim());
   if(!name){status('Escribe un título.');return;}
   if(poster.value.trim()&&!image){status('La portada debe tener una URL HTTPS válida.');return;}
   if(year.value.trim()&&!/^\d{4}$/.test(year.value.trim())){status('Introduce un año de cuatro cifras.');return;}
   const data={title:name,genre:genre.value,year:year.value.trim(),description:description.value.trim(),poster:image};
   data.key=current.key;
   if(current.type==='tv')data.seriesName=current.name;
   if(lastTmdb)Object.assign(data,lastTmdb);
   save.disabled=true;status('Guardando corrección…');
   try{
     await request('/api/admin/metadata/item',{method:'PATCH',body:data});
     await api.reloadCatalog();refresh();
     status('Corrección guardada. Se conservará aunque vuelvas a sincronizar Google Drive.');
     window.noctraMetadataAdmin?.refreshProgress?.(request);
   }catch(e){status('No se pudo guardar: '+e.message);}finally{save.disabled=false;}
 };
 target.noctraProgress=progress;
 refresh();
 window.noctraMetadataAdmin?.refreshProgress?.(request);
}
let running=false;
let lastPromise=null;
async function refreshProgress(request){
 const p=document.querySelector('#admin-metadata-slot .noctra-meta-progress');
 try{
   const result=await request('/api/admin/metadata/status');
   if(p){
     p.textContent=!result.configured?'TMDB todavía no está configurado en Cloudflare.':
       'Metadatos: '+(result.completed+result.manual)+' de '+result.total+' completados · '+result.pending+' pendientes · '+result.review+' por revisar'+(result.working?' · '+result.working+' en proceso':'')+'.';
   }
   return result;
 }catch(e){
   if(p)p.textContent='La actualización automática requiere desplegar el Worker. '+e.message;
   return null;
 }
}
function autoStart(api,request,force=false){
 if(api?.user?.role!=='admin')return Promise.resolve();
 if(running)return lastPromise||Promise.resolve();
 running=true;
 lastPromise=(async()=>{
   let status=await refreshProgress(request);
   if(!status?.configured)return;
   // Each request is capped at five TMDB entries; an offline cron continues
   // remaining work automatically even when no browser is open.
   let changed=false;
   for(let pass=0;pass<220;pass++){
     if(status.pending===0)break;
     try{
       const step=await request('/api/admin/metadata/sync',{method:'POST'});
       changed ||=step.processed>0;
       status=step;
       const p=document.querySelector('#admin-metadata-slot .noctra-meta-progress');
       if(p)p.textContent='Metadatos: '+(step.completed+step.manual)+' de '+step.total+' completados · '+step.pending+' pendientes · '+step.review+' por revisar.';
       if(!step.processed)break;
     }catch{break;}
     // Yield between batches to reduce TMDB rate pressure and keep UI responsive.
     await new Promise(resolve=>setTimeout(resolve,1100));
   }
   if(changed){
     try{await api.reloadCatalog();}catch{}
     document.querySelector('#admin-metadata-slot')?.noctraRefresh?.();
   }
   await refreshProgress(request);
 })().finally(()=>{running=false;lastPromise=null;});
 return lastPromise;
}
window.noctraMetadataAdmin={mount,autoStart,refreshProgress};
})();
