/* Admin-only metadata editor. Manual save works with existing catalog API;
   TMDB lookup uses optional admin-only Worker endpoints. */
(()=>{
'use strict';
const TYPES=['Acción','Ciencia ficción','Drama','Suspenso','Documental','Animación','Comedia','Terror','Otros'];
const el=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text)x.textContent=text;return x;};
const https=v=>{if(!v)return '';try{let u=new URL(v);return u.protocol==='https:'?u.href:'';}catch{return '';}};
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const clean=s=>String(s||'').replace(/\.(mkv|mp4|avi|webm)$/i,'').replace(/\b(1080p|2160p|720p|webrip|web-dl|bluray|x264|x265|hevc)\b/gi,'').replace(/[._]/g,' ').trim();
function mount(target,api,request){
 if(!target||api?.user?.role!=='admin')return;
 if(target.firstChild){target.noctraRefresh?.();return;}
 const box=el('div','noctra-meta-editor'),msg=el('p','admin-note','Edita una ficha manualmente o busca el título en TMDB.');
 const label=(text,child)=>{const node=el('label','',text);node.append(child);return node;};
 const picker=el('select');picker.id='metadata-item';
 const query=el('input');query.type='search';query.placeholder='Título para buscar en TMDB';query.maxLength=120;
 const tools=el('div','button-row');
 const searchBtn=el('button','secondary','Buscar y elegir');
 const autoBtn=el('button','secondary','Autocompletar');
 for(const b of [searchBtn,autoBtn])b.type='button';
 tools.append(searchBtn,autoBtn);
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
 box.append(msg,label('Selecciona una película o serie',picker),label('Buscar título',query),tools,results,form,credit);
 target.append(box);
 let items=[],current=null;
 function status(s){msg.textContent=s;}
 function refresh(){
   const previous=picker.value;items=[];let seen=new Set();
   for(const m of api.movies||[]){
     if(!m.fileId)continue;
     const group=String(m.seriesName||'').trim();
     const key=group?'tv|'+group:'movie|'+m.fileId;
     if(seen.has(key))continue;seen.add(key);
     items.push({key,name:group||m.title,type:group?'tv':'movie',movie:m});
   }
   items.sort((a,b)=>a.name.localeCompare(b.name,'es'));
   picker.replaceChildren();
   if(!items.length){picker.add(new Option('Publica primero tus películas',''));form.hidden=true;status('El catálogo está vacío.');return;}
   for(const x of items)picker.add(new Option((x.type==='tv'?'Serie: ':'Película: ')+x.name,x.key));
   picker.value=items.some(x=>x.key===previous)?previous:items[0].key;
   changed();
 }
 function changed(){
   current=items.find(x=>x.key===picker.value);
   if(!current)return;
   const m=current.movie;
   title.value=current.name;title.readOnly=current.type==='tv';
   genre.value=TYPES.includes(m.genre)?m.genre:'Otros';
   year.value=m.year||'';description.value=m.description||'';poster.value=m.poster||'';
   poster.dispatchEvent(new Event('input'));
   query.value=clean(current.name);
   results.hidden=true;results.replaceChildren();form.hidden=false;
   status('Puedes guardar campos manualmente o buscar datos en TMDB.');
 }
 picker.onchange=changed;target.noctraRefresh=refresh;
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
     const m=data.metadata;
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
 form.onsubmit=async event=>{
   event.preventDefault();if(!current)return;
   const name=title.value.trim(),image=https(poster.value.trim());
   if(current.type==='movie'&&!name){status('Escribe un título.');return;}
   if(poster.value.trim()&&!image){status('La portada debe tener una URL HTTPS válida.');return;}
   if(year.value.trim()&&!/^\d{4}$/.test(year.value.trim())){status('Introduce un año de cuatro cifras.');return;}
   const data={genre:genre.value,year:year.value.trim(),description:description.value.trim(),poster:image};
   if(current.type==='movie')data.title=name;
   const list=api.movies||[];
   const belongs=m=>current.type==='tv'?m.seriesName===current.name:m.fileId===current.movie.fileId;
   const count=list.filter(belongs).length;
   if(!count){status('Esta película ya no está en el catálogo.');return;}
   const update=list.map(m=>belongs(m)?{...m,...data}:m);
   save.disabled=true;status('Guardando…');
   try{
     const result=await request('/api/admin/catalog',{method:'PUT',body:{movies:update}});
     await api.reloadCatalog();refresh();
     status('Ficha guardada para '+count+' archivo(s). Catálogo actualizado ('+result.count+').');
   }catch(e){status('No se pudo guardar: '+e.message);}finally{save.disabled=false;}
 };
 refresh();
}
window.noctraMetadataAdmin={mount};
})();
