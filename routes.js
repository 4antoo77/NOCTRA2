/* ANTOO PELIS | SPA routes with shareable movie, series and episode URLs.
 * Everything stays in the same application; private media remain authenticated.
 */
(()=>{
 'use strict';
 const fallback=new URL(location.href).searchParams.get('__route');
 if(fallback){
   try{
     const dest=new URL(fallback,location.origin);
     if(dest.origin===location.origin&&dest.pathname.startsWith('/'))
       history.replaceState(history.state,'',dest.pathname+dest.search+dest.hash);
   }catch{}
 }
 let ready=false,restoring=false;
 const hash=value=>{
   let result=2166136261;
   for(const c of String(value)){result^=c.charCodeAt(0);result=Math.imul(result,16777619);}
   return (result>>>0).toString(36);
 };
 const slug=value=>String(value||'titulo')
   .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
   .toLowerCase().replace(/[^a-z0-9]+/g,'-')
   .replace(/^-|-$/g,'').slice(0,65).replace(/-$/,'')||'titulo';
 const seriesBase=(name,items=[])=>'/series/'+slug(items.find(x=>x.seriesTitle)?.seriesTitle||name)+'--'+hash(name);
 const movieBase=m=>'/peliculas/'+slug(m.title)+'--'+hash(m.fileId||m.id||m.title);
 const seasonPath=(name,items,key)=>seriesBase(name,items)+'/temporada/'+encodeURIComponent(String(key));
 const episodePath=(m,name,items,key)=>seasonPath(name,items,key)+
   '/episodio/'+slug(m.episodeTitle||m.title)+'--'+hash(m.fileId||m.id||m.title);
 function navigate(path,replace=false){
   if(restoring||!path||path===location.pathname)return;
   try{history[replace?'replaceState':'pushState']({antoo:true},'',path);}catch{}
 }
 const sections={home:'/',library:'/peliculas',list:'/mi-lista'};
 function section(page,media){
   const path=page==='library'&&media==='series'?'/series':sections[page]||'/';
   navigate(path);
 }
 function selectMedia(kind){
   const tab=document.querySelector('.media-tabs [data-kind="'+kind+'"]');
   if(tab)tab.click();
   else if(typeof window.noctraShowLibrary==='function')window.noctraShowLibrary();
 }
 const catalog=()=>[
   ...(window.noctraCloud?.movies||[]),
   ...((window.noctraCloud?.user?.role==='admin'&&typeof movies!=='undefined')?movies:[]),
   ...(window.noctraScanLibrary||[])
 ];
 function groups(){
   const out=new Map();
   for(const m of catalog()){
     if(!m?.seriesName)continue;
     if(!out.has(m.seriesName))out.set(m.seriesName,[]);
     out.get(m.seriesName).push(m);
   }
   return out;
 }
 function closeDialogs(){
   for(const id of ['player','details','episodes-dialog']){
     const node=document.getElementById(id);
     if(node?.open)node.close();
   }
 }
 function findHash(path,type){
   const suffix=path.split('/')[2]?.match(/--([a-z0-9]+)$/)?.[1];
   if(!suffix)return null;
   if(type==='movie')
     return catalog().find(m=>!m.seriesName&&hash(m.fileId||m.id||m.title)===suffix)||null;
   for(const [name,items] of groups())
     if(hash(name)===suffix)return {name,items};
   return null;
 }
 function markEpisode(path){
   const entries=document.querySelectorAll('#noctra-season-episode-list .noctra-episode-play');
   const target=[...entries].find(el=>el.dataset.episodeRoute===path);
   if(target){
     target.classList.add('antoo-episode-linked');
     target.setAttribute('aria-current','true');
     target.scrollIntoView({block:'nearest'});
   }
 }
 function restore(){
   if(!ready||restoring||document.body.classList.contains('auth-locked'))return;
   restoring=true;
   try{
     const path=decodeURI(location.pathname);
     const movieRoute=path.startsWith('/peliculas/');
     const seriesRoute=path.startsWith('/series/');
     closeDialogs();
     const mode=movieRoute?'movies':seriesRoute||path==='/series'?'series':'movies';
     const sectionName=path==='/mi-lista'?'list':path==='/'?'home':'library';
     if(typeof setPage==='function')setPage(sectionName);
     selectMedia(mode);
     if(movieRoute){
       const m=findHash(path,'movie');
       if(m&&typeof openDetail==='function')openDetail(m);
       else if(typeof toast==='function')toast('Esa película no está disponible en tu catálogo.');
     }else if(seriesRoute){
       const match=findHash(path,'series');
       if(match&&typeof window.noctraOpenEpisodes==='function'){
         const tail=path.replace(/^\/series\/[^/]+/,'');
         const season=tail.match(/^\/temporada\/([^/]+)/)?.[1]||null;
         window.noctraOpenEpisodes(match.name,match.items,season);
         if(tail.includes('/episodio/'))requestAnimationFrame(()=>markEpisode(path));
       }else if(typeof toast==='function')toast('Esa serie no está disponible en tu catálogo.');
     }
   }catch(e){console.warn('ANTOO PELIS route:',e);}
   finally{restoring=false;}
 }
 const api={
   get isRestoring(){return restoring;},
   moviePath:movieBase,seriesPath:seriesBase,seasonPath,episodePath,
   section,
   detail(m){if(m&&!m.seriesName)navigate(movieBase(m));},
   series(name,items){navigate(seriesBase(name,items));},
   season(name,items,key){navigate(seasonPath(name,items,key));},
   episode(m,name,items,key){navigate(episodePath(m,name,items,key));},
   onCatalogReady(){if(!ready){ready=true;restore();}},
   restore
 };
 window.antooRoutes=api;
 window.addEventListener('popstate',restore);
})();
