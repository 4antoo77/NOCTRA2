'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const KEY='noctra.catalog.v1';
let movies=[],page='home',genre='Todas',editing=null,active=null,storageOK=true;
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function driveId(s){try{const u=new URL(s);if(u.protocol!=='https:'||u.hostname!=='drive.google.com')return null;const id=u.pathname.match(/^\/file\/d\/([\w-]+)(?:\/|$)/)?.[1]||(u.pathname==='/open'?u.searchParams.get('id'):null);return id&&/^[\w-]{10,}$/.test(id)?id:null;}catch{return null;}}
function posterURL(s){if(!s)return '';try{const u=new URL(s);return u.protocol==='https:'?u.href:'';}catch{return '';}}
function validMovie(m){return m&&typeof m.id==='string'&&typeof m.title==='string'&&m.title.trim()&&m.title.length<=100&&driveId(m.drive)&&Array.isArray(m.variants)&&m.variants.length<=8&&m.variants.every(v=>v&&typeof v.label==='string'&&v.label.length<=40&&driveId(v.url));}
try{const data=JSON.parse(localStorage.getItem(KEY)||'[]');if(!Array.isArray(data)||!data.every(validMovie))throw Error('catalog');movies=data;}catch{storageOK=false;setTimeout(()=>toast('No se pudo leer el catálogo guardado. Puedes importar una copia desde tu perfil.'),100);}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(movies));storageOK=true;return true;}catch{toast('El navegador no permite guardar. Exporta una copia desde tu perfil.');return false;}}
function toast(s){$('#toast').textContent=s;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),5000);}
function dialog(s){$(s).showModal();}
$$('dialog').forEach(d=>{d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});});
$$('.close').forEach(b=>b.onclick=()=>b.closest('dialog').close());
function setPage(p){page=p;document.body.classList.toggle('library-mode',p!=='home');$$('.nav').forEach(b=>b.classList.toggle('active',b.dataset.page===p));$('#section-title').textContent=p==='list'?'Mi lista':$('#search').value.trim()?'Resultados de búsqueda':window.noctraMediaCategory==='series'?'Series':'Películas';render();window.scrollTo(0,0);}
$$('.nav').forEach(b=>b.onclick=()=>setPage(b.dataset.page));
$$('.brand').forEach(a=>a.onclick=e=>{e.preventDefault();setPage('home');});
$('#explore').onclick=()=>$('#catalog').scrollIntoView({behavior:'smooth'});
// The one shared search input now lives in the floating top navigation.
$('#search').addEventListener('input',()=>{
  if(typeof window.noctraShowLibrary==='function')window.noctraShowLibrary();
  else render();
  if($('#search').value.trim())$('#catalog').scrollIntoView({behavior:'smooth',block:'start'});
});
$('#search').addEventListener('keydown',e=>{
  if(e.key==='Enter'){e.preventDefault();$('#catalog').scrollIntoView({behavior:'smooth',block:'start'});}
  if(e.key==='Escape'&&$('#search').value){
    $('#search').value='';
    if(typeof window.noctraShowLibrary==='function')window.noctraShowLibrary();
    else render();
  }
});
$('#sort').onchange=render;
$$('#filters [data-genre]').forEach(b=>b.addEventListener('click',()=>{
 genre=b.dataset.genre;
 $$('#filters [data-genre]').forEach(c=>{
  const selected=c===b;
  c.classList.toggle('selected',selected);
  c.setAttribute('aria-pressed',String(selected));
 });
 render();
}));
function render(){
 noctraSpotlight.update();
 const local=window.noctraCloud?.user?.role==='admin'?movies:[];
 const totalMovies=new Map([...(window.noctraCloud?.movies||[]),...local].filter(m=>!m.seriesName).map(m=>[m.fileId||m.id,m]));
 $('#count').textContent=totalMovies.size;
 const term=$('#search').value.trim().toLocaleLowerCase('es');
 const viewingSeries=window.noctraMediaCategory==='series'&&!term;
 let list=[...(viewingSeries?[]:local.filter(m=>!m.seriesName)),...(window.serverMovies||[]).filter(m=>!m.seriesName)]
   .filter(m=>(page!=='list'||m.saved)&&(genre==='Todas'||m.genre===genre)&&m.title.toLocaleLowerCase('es').includes(term));
 const unique=new Set();
 list=list.filter(m=>{const key=m.fileId||m.id;if(unique.has(key))return false;unique.add(key);return true;});
 if($('#sort').value==='az')list.sort((a,b)=>a.title.localeCompare(b.title,'es'));else list.sort((a,b)=>(b.added||0)-(a.added||0));
 $('#real-grid').innerHTML=list.map(m=>`<button class="movie-card" data-id="${esc(m.id)}"><div class="poster"><img src="${esc(posterURL(m.poster)||'assets/mountain.svg')}" alt="" loading="lazy"><span class="card-tag">${m.local?'REPRODUCTOR NOCTRA':'GOOGLE DRIVE'}</span>${!m.poster?`<div class="poster-text">${esc(m.title)}<small>TU COLECCIÓN</small></div>`:''}</div><div class="card-info"><strong>${esc(m.title)}</strong><span>${m.saved?'✓':'↗'}</span></div><p>${esc(m.genre||'Película')}${m.year?' · '+esc(m.year):''}</p></button>`).join('');
 $('#real-grid').querySelectorAll('img').forEach(i=>i.onerror=()=>{i.onerror=null;i.src='assets/mountain.svg';});
 $('#real-grid').querySelectorAll('button').forEach(b=>b.onclick=()=>openDetail(list.find(m=>m.id===b.dataset.id)));
 $('#empty').hidden=list.length>0;
 if(!list.length){
   $('#empty h3').textContent=page==='list'?'Aquí van las que no te quieres perder.':term?'No encontramos títulos con esa búsqueda.':(window.noctraCloud?.movies?.length||movies.length)?'No hay títulos en esta sección.':'El catálogo está vacío.';
   $('#empty p').textContent=page==='list'?'Abre una película o serie y añádela a tu lista.':term?'Prueba a escribir otro nombre de película o serie.':'El administrador puede publicar más títulos.';
 }
}
// Abyss-inspired vertical spotlight: real published movies, no demo posters.
// Stable daily selection: a visitor sees the same six within their local day.
// As the local date changes, the chosen six rotate through the catalog.
const noctraSpotlight=(()=>{
 const hero=$('#hero'),carousel=$('#hero-carousel'),track=$('#hero-feature-track');
 const title=$('#hero-feature-title'),description=$('#hero-feature-description');
 const eyebrow=$('#hero-feature-eyebrow'),counter=$('#hero-feature-counter');
 const backdrop=$('#hero-feature-backdrop');
 const play=$('#hero-feature-play'),info=$('#hero-feature-info');
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches||false;
 let chosen=[],activeIndex=0,visualIndex=0,interval=null,dayKey='',signature='';
 const timerDelay=6000;
 const hash=str=>{let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;};
 const seededShuffle=(arr,seed)=>{
   const a=[...arr];let state=(seed>>>0)||123456789;
   for(let i=a.length-1;i>0;i--){
     state^=state<<13;state^=state>>>17;state^=state<<5;
     const j=(state>>>0)%(i+1);
     [a[i],a[j]]=[a[j],a[i]];
   }
   return a;
 };
 const today=()=>{
   const d=new Date(),y=d.getFullYear(),m=d.getMonth(),n=d.getDate();
   return {key:y+'-'+String(m+1).padStart(2,'0')+'-'+String(n).padStart(2,'0'),
           number:Math.floor(Date.UTC(y,m,n)/86400000)};
 };
 const poster=m=>posterURL(m.poster);
 // TMDB w500 posters are appropriate for thumbnails, not full-screen backdrops.
 const sharpPoster=m=>{
   const url=poster(m);
   return url&&url.startsWith('https://image.tmdb.org/t/p/w500/')?
     url.replace('/t/p/w500/','/t/p/w780/'):url;
 };
 const cinematicBackdrop=m=>posterURL(m.backdrop);
 const movieKey=m=>String(m.fileId||m.id||m.title);
 function stop(){if(interval){clearInterval(interval);interval=null;}}
 function start(){
   stop();
   if(chosen.length<2||document.hidden)return;
   // Always move to the next movie after six seconds, even while the pointer
   // is over a poster or the user requests reduced-motion accessibility.
   interval=setInterval(()=>{
     if(document.hidden)return;
     const now=today();
     if(now.key!==dayKey){update();return;}
     show((activeIndex+1)%chosen.length,true);
   },timerDelay);
 }
 function applyVisual(animate){
   if(!track)return;
   track.style.transition=animate&&!reduced?'':'none';
   // Pixel translation avoids unsupported calc(length * number) on some browsers.
   const step=parseFloat(getComputedStyle(carousel).getPropertyValue('--hero-rowstep'))||174;
   track.style.transform='translate3d(0, '+(-(visualIndex-1)*step)+'px, 0)';
   if(!animate)requestAnimationFrame(()=>{if(track)track.style.transition='';});
   track.querySelectorAll('.abyss-hero-slide').forEach(btn=>{
     const match=Number(btn.dataset.featureIndex)===activeIndex;
     btn.classList.toggle('active',match);
     btn.setAttribute('aria-pressed',String(match));
   });
 }
 function show(i,autoplay=false){
   if(!chosen.length)return;
   const before=activeIndex;
   activeIndex=i;
   visualIndex=chosen.length+i;
   if(autoplay&&before===chosen.length-1&&i===0)visualIndex=chosen.length*2;
   const m=chosen[i],art=cinematicBackdrop(m);
   eyebrow.textContent=[m.year,m.genre].filter(Boolean).join(' · ').toUpperCase()||'PELÍCULA DESTACADA';
   title.textContent=m.title;
   description.textContent=m.description?.trim()||'Disponible en tu catálogo. Selecciona Reproducir para disfrutarla.';
   counter.textContent=String(i+1).padStart(2,'0')+' / '+String(chosen.length).padStart(2,'0');
   if(art){backdrop.hidden=false;if(backdrop.src!==art)backdrop.src=art;}
   else{backdrop.removeAttribute('src');backdrop.hidden=true;}
   applyVisual(autoplay||before!==i);
 }
 function buildTrack(){
   track.replaceChildren();
   // Three copies make the last-to-first upward movement continuous.
   for(let copy=0;copy<3;copy++)for(let i=0;i<chosen.length;i++){
     const m=chosen[i],btn=document.createElement('button');
     btn.type='button';btn.className='abyss-hero-slide';
     btn.dataset.featureIndex=String(i);
     btn.setAttribute('aria-label','Destacar '+m.title);
     btn.tabIndex=copy===1?0:-1;
     const art=document.createElement('img');art.alt='';art.loading=copy===1?'eager':'lazy';
     art.src=sharpPoster(m)||'assets/mountain.svg';
     art.onerror=()=>{art.onerror=null;art.src='assets/mountain.svg';};
     const detail=document.createElement('span');detail.className='abyss-hero-slide-detail';
     const number=document.createElement('small');number.textContent=String(i+1).padStart(2,'0');
     const name=document.createElement('strong');name.textContent=m.title;
     detail.append(number,name);btn.append(art,detail);
     btn.onclick=()=>{show(i);start();};
     track.append(btn);
   }
   visualIndex=chosen.length;
   track.style.transition='none';
   applyVisual(false);
 }
 track?.addEventListener('transitionend',e=>{
   if(e.propertyName!=='transform'||visualIndex<chosen.length*2)return;
   visualIndex=chosen.length;
   applyVisual(false);
 });
 backdrop?.addEventListener('error',()=>{
   backdrop.removeAttribute('src');backdrop.hidden=true;
 });
 // No mousehover/focus pause: the carousel is meant to change every 6 s.
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)start();else stop();});
 play.onclick=()=>{
   const m=chosen[activeIndex];
   if(m)window.noctraCloud?.play(m);
 };
 info.onclick=()=>{
   const m=chosen[activeIndex];
   if(m)openDetail(m);
 };
 function update(){
   if(!hero||!carousel||!track)return;
   const day=today();
   const pool=(window.noctraCloud?.movies||[])
     .filter(m=>m&&!m.seriesName&&m.title&&(m.fileId||m.id))
     .sort((a,b)=>movieKey(a).localeCompare(movieKey(b)));
   const seen=new Set();
   const distinct=pool.filter(m=>{const id=movieKey(m);if(seen.has(id))return false;seen.add(id);return true;});
   // Prefer actual poster art when there are enough posters for a full row.
   const withArt=distinct.filter(poster);
   const eligible=withArt.length>=6?withArt:distinct;
   const current=day.key+'|'+eligible.map(m=>[movieKey(m),m.title,m.poster,m.backdrop,m.description].join('~')).join('|');
   if(signature===current)return;
   signature=current;dayKey=day.key;stop();
   if(!eligible.length){
     chosen=[];carousel.hidden=true;play.hidden=true;info.hidden=true;
     backdrop.hidden=true;title.textContent='Descubre tu próxima película.';
     description.textContent='Explora el catálogo de NOCTRA2 y disfruta de tus películas favoritas.';
     return;
   }
   const base=seededShuffle(eligible,hash('noctra|'+eligible.map(movieKey).join('|')));
   const offset=base.length>6?((day.number*6)%base.length):0;
   chosen=[];
   for(let j=0;j<Math.min(6,base.length);j++)chosen.push(base[(offset+j)%base.length]);
   chosen=seededShuffle(chosen,hash('noctra-day|'+day.key));
   carousel.hidden=false;play.hidden=false;info.hidden=false;
   hero.classList.add('is-abyss-feature');
   activeIndex=0;buildTrack();show(0);start();
 }
 return {update};
})();
function openEditor(m=null){if(window.noctraCloud?.user?.role!=='admin')return;editing=m?.id||null;$('#movie-form').reset();$('#variants').innerHTML='';$('#form-error').textContent='';$('#edit-title').textContent=m?'Editar película':'Añadir película';if(m){for(const key of ['title','genre','year','description','poster','drive'])$('#movie-form').elements[key].value=m[key]||'';m.variants.forEach(v=>addVariant(v));}dialog('#editor');}
$$('[data-add]').forEach(b=>b.onclick=()=>openEditor());
function addVariant(v={label:'1080p',url:''}){if($('#variants').children.length>=8)return;const row=document.createElement('div');row.className='variant';row.innerHTML=`<select aria-label="Calidad declarada">${['360p','480p','720p','1080p','1440p','2160p','Original'].map(q=>`<option ${q===v.label?'selected':''}>${q}</option>`).join('')}</select><input type="url" placeholder="Enlace de esta versión en Drive" aria-label="Enlace de la versión" required value="${esc(v.url)}"><button type="button" aria-label="Eliminar versión">×</button>`;row.querySelector('button').onclick=()=>row.remove();$('#variants').append(row);}
$('#add-variant').onclick=()=>addVariant();
$('#movie-form').onsubmit=e=>{e.preventDefault();const f=e.target.elements;const drive=f.drive.value.trim();const variants=[...$('#variants').children].map(r=>({label:r.querySelector('select').value,url:r.querySelector('input').value.trim()}));if(!driveId(drive)||variants.some(v=>!driveId(v.url))){$('#form-error').textContent='Usa enlaces de archivos de drive.google.com/file/d/…/view. No se admiten enlaces de carpetas.';return;}if(f.poster.value&&!posterURL(f.poster.value)){$('#form-error').textContent='La portada debe usar una URL HTTPS.';return;}const existing=movies.find(m=>m.id===editing);if(movies.some(m=>m.id!==editing&&driveId(m.drive)===driveId(drive))){$('#form-error').textContent='Esa película ya está en tu colección. Puedes editarla desde su ficha.';return;}const m={id:editing||crypto.randomUUID(),title:f.title.value.trim(),genre:f.genre.value,year:f.year.value,description:f.description.value.trim(),poster:posterURL(f.poster.value),drive,variants,saved:existing?.saved||false,added:existing?.added||Date.now()};if(!m.title)return;if(editing)movies=movies.map(x=>x.id===editing?m:x);else movies.push(m);const ok=persist();$('#editor').close();render();if(ok)toast('Película guardada en tu colección.');};
function openDetail(m){if(!m)return;active=m;$('#detail-content').innerHTML=`<div class="detail-art">${m.poster?`<img src="${esc(posterURL(m.poster))}" alt="">`:''}<button class="close" aria-label="Cerrar">×</button></div><p class="eyebrow purple">${m.local?'REPRODUCTOR PROPIO · ARCHIVO DETECTADO':'TU COLECCIÓN PERSONAL'}</p><h2>${esc(m.title)}</h2><p class="detail-meta">${esc(m.genre||'Película')}${m.year?' · '+esc(m.year):''} ${Number(m.rating)>0?' · ★ '+Number(m.rating).toFixed(1):''}${Number(m.duration)>0?' · '+Math.round(Number(m.duration))+' min':''} · ${m.local?'MKV / VIDEO':'Google Drive'}</p><p class="detail-desc">${esc(m.description||'Prepara tu lugar favorito. Tu próxima historia te espera.')}</p><div class="button-row"><button class="primary" id="play-movie">▶ Reproducir</button><button class="secondary" id="save-movie">${m.saved?'✓ En mi lista':'＋ Mi lista'}</button></div><div class="notice">${m.local?'El servidor analiza la resolución y prepara solo la calidad que elijas. Puede tardar unos segundos.':m.variants.length?`${m.variants.length+1} versiones añadidas. Resoluciones declaradas por ti, sin verificar.`:'Reproducción con Google Drive. Las calidades disponibles se controlan dentro de su reproductor.'}</div><div class="detail-bottom">${m.local?'<span class="hint">Archivo de tu carpeta de películas</span>':'<button class="text-button" id="edit-movie">Editar película</button><button class="text-button danger" id="delete-movie">Eliminar de mi catálogo</button>'}</div>`;$('#detail-content .close').onclick=()=>$('#details').close();$('#play-movie').onclick=()=>{ $('#details').close();m.local?window.playLocal(m):playMovie(m);};$('#save-movie').onclick=()=>{m.saved=!m.saved;if(m.local){window.saveLocalFavorites();}else persist();$('#save-movie').textContent=m.saved?'✓ En mi lista':'＋ Mi lista';render();};if(!m.local){if(window.noctraCloud?.user?.role!=='admin'){const bottom=$('#detail-content .detail-bottom');if(bottom)bottom.hidden=true;return dialog('#details');}$('#edit-movie').onclick=()=>{$('#details').close();openEditor(m);};$('#delete-movie').onclick=()=>{if(!confirm('¿Eliminar esta película de tu catálogo? El archivo de Drive no se modifica.'))return;movies=movies.filter(x=>x.id!==m.id);persist();$('#details').close();render();toast('Película eliminada del catálogo.');};}dialog('#details');}
function playMovie(m){
  const id=m.fileId||(typeof driveId==='function'?driveId(m.drive):null);
  const cloud=window.noctraCloud?.movies?.find(x=>x.fileId===id);
  if(cloud)return window.noctraCloud.play(cloud);
  toast('Para reproducir con Movi Player, publica primero esta película en Administrar → Publicar catálogo actual.');
}
$('#player').addEventListener('close',()=>{$('#frame-container').innerHTML='';});
$('#settings').onclick=$('#help').onclick=()=>dialog('#settings-dialog');
$('#export').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({version:1,movies},null,2)],{type:'application/json'}));a.download='noctra-catalogo.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('Copia del catálogo exportada.');};
$('#import').onclick=()=>$('#import-file').click();
$('#import-file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>5e6)throw Error();const d=JSON.parse(await f.text());if(d.version!==1||!Array.isArray(d.movies)||d.movies.length>2000||!d.movies.every(validMovie))throw Error();let n=0;for(const m of d.movies){if(!movies.some(x=>driveId(x.drive)===driveId(m.drive))){movies.push({...m,id:crypto.randomUUID(),poster:posterURL(m.poster)});n++;}}const ok=persist();render();if(ok)toast(`${n} películas importadas.`);}catch{toast('Archivo no válido. Selecciona una copia JSON exportada por NOCTRA.');}finally{e.target.value='';}};
render();