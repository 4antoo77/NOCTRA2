/* ANTOO PELIS: Google OAuth runs in the visitor browser; no credentials in source. */
(() => {
 'use strict';
 const ROOT='', FOLDER='application/vnd.google-apps.folder';
 let token='',expires=0,scanning=false,aborter=null,client=null,player=null,playSerial=0,category='movies';
 const isAdmin=()=>window.noctraCloud?.user?.role==='admin';
 let library=[],series=[],lastScan='';
 const storeGet=k=>{try{return localStorage.getItem(k)||'';}catch{return '';}};
 const storeSet=(k,v)=>{try{localStorage.setItem(k,v);}catch{toast('No se pudo guardar la configuración en este navegador.');}};
 function storedJSON(k,fallback){try{return JSON.parse(storeGet(k)||'null')||fallback;}catch{return fallback;}}
 const config=storedJSON('noctra.drive.config',{clientId:'',root:ROOT});
 if(typeof config.clientId!=='string')config.clientId='';if(!validId(config.root))config.root=ROOT;
 window.serverMovies=[]; window.noctraScanLibrary=[];
 function status(text){$('#drive-status').textContent=text;}
 function validId(v){return /^[A-Za-z0-9_-]{10,}$/.test(v);}
 function parseRoot(v){try{const u=new URL(v);return u.hostname==='drive.google.com'?u.pathname.match(/^\/drive\/folders\/([\w-]+)/)?.[1]||'':'';}catch{return validId(v)?v:'';}}
 function authorized(){return token&&Date.now()<expires;}
 const panel=document.createElement('section');panel.className='drive-panel';panel.innerHTML=`<div><p class="eyebrow purple">TU VIDEOTECA CONECTADA</p><h3>Una carpeta. Todas tus historias.</h3><p id="drive-status" role="status">Configura Google para leer tus carpetas desde esta página.</p></div><div class="button-row"><button class="primary" id="connect-drive">Conectar Google Drive</button><button class="secondary" id="sync-drive" disabled>↻ Actualizar</button><button class="text-button" id="drive-options">Configurar</button></div>`;
 panel.hidden=true;
 document.body.append(panel); // Aislado del catálogo, solo Administrar lo montará
 const tabs=document.createElement('div');tabs.className='filters media-tabs';tabs.setAttribute('aria-label','Tipo de contenido');tabs.innerHTML='<button class="chip selected" data-kind="movies" type="button" aria-pressed="true">Películas</button><button class="chip" data-kind="series" type="button" aria-pressed="false">Series</button>';
 $('#catalog .section-heading').after(tabs);
 const setup=document.createElement('dialog');setup.id='drive-setup';setup.innerHTML=`<div class="dialog-top"><div><p class="eyebrow purple">CONEXIÓN DE LA PÁGINA</p><h2>Conectar tu videoteca</h2></div><button class="close" aria-label="Cerrar">×</button></div><p class="hint">Esta conexión es independiente de la de ChatGPT. Google exige registrar la página una vez para que puedas iniciar sesión.</p><label>Carpeta principal<input id="root-input" placeholder="Enlace de la carpeta principal"></label><label style="margin-top:18px">ID de cliente web de Google<input id="client-input" placeholder="…apps.googleusercontent.com" autocomplete="off"><small>Es un identificador público. No pegues una contraseña ni una clave privada.</small></label><details><summary>Configuración inicial, una sola vez</summary><ol class="setup-steps"><li>En Google Cloud, crea o abre un proyecto y activa <b>Google Drive API</b>.</li><li>Configura Google Auth Platform (marca, audiencia y acceso a datos). Añade el permiso <b>drive.readonly</b>. Si está en prueba, añade tu cuenta como usuario de prueba.</li><li>Crea un cliente OAuth de tipo <b>Aplicación web</b>. En «Orígenes de JavaScript autorizados» añade <code>${esc(location.origin)}</code>.</li><li>Copia su <b>ID de cliente</b> aquí. Esta aplicación no utiliza un secreto de cliente.</li></ol><a class="text-button" href="https://console.cloud.google.com/auth/clients" target="_blank" rel="noopener">Abrir Google Cloud ↗</a></details><div class="notice">Google solicitará permiso de lectura de Drive. NOCTRA consulta la carpeta elegida y sus subcarpetas. La autorización se conserva solo durante esta sesión. Los invitados no deben conectar su cuenta: tú publicas las películas para ellos desde Administrar.</div><p class="error" id="setup-error" role="alert"></p><div class="button-row"><button class="primary" id="save-drive-config">Guardar configuración</button><button class="secondary" id="disconnect-drive">Desconectar</button></div>`;document.body.append(setup);setup.querySelector('.close').onclick=()=>setup.close();
 function openSetup(){if(!isAdmin())return;$('#root-input').value='https://drive.google.com/drive/folders/'+config.root;$('#client-input').value=config.clientId;$('#setup-error').textContent='';setup.showModal();}
 $('#drive-options').onclick=openSetup;
 $('#save-drive-config').onclick=()=>{if(!isAdmin())return;const root=parseRoot($('#root-input').value.trim()),id=$('#client-input').value.trim();if(!validId(root)||!/^\d+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(id)){$('#setup-error').textContent='Introduce una carpeta válida y el ID de cliente OAuth de tipo aplicación web.';return;}config.root=root;config.clientId=id;storeSet('noctra.drive.config',JSON.stringify(config));client=null;setup.close();status('Configuración guardada. Pulsa «Conectar Google Drive».');};
 async function loadGoogle(){if(window.google?.accounts?.oauth2)return;await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.onload=resolve;s.onerror=()=>reject(Error('No se pudo cargar el inicio de sesión de Google. Comprueba tu conexión.'));document.head.append(s);});}
 // La API de Google se carga bajo demanda, solo para el administrador.
 $('#connect-drive').onclick=async()=>{if(!isAdmin())return;if(!config.clientId){openSetup();return;}try{await loadGoogle();}catch(e){status(e.message);return;}if(!client)client=google.accounts.oauth2.initTokenClient({client_id:config.clientId,scope:'https://www.googleapis.com/auth/drive.readonly',callback:r=>{if(r.error){status('Google no autorizó la conexión: '+r.error);return;}aborter?.abort();library=[];window.noctraScanLibrary=[];showLibrary();token=r.access_token;expires=Date.now()+Math.max(0,Number(r.expires_in)-60)*1000;$('#sync-drive').disabled=false;$('#connect-drive').textContent='Renovar acceso';scan();},error_callback:e=>status(e.type==='popup_closed'?'Se cerró la ventana de Google. Puedes volver a intentarlo.':'No se pudo abrir Google. Permite las ventanas emergentes para esta página.')});client.requestAccessToken({prompt:''});};
 $('#disconnect-drive').onclick=()=>{if(!isAdmin())return;if(token&&window.google?.accounts?.oauth2)google.accounts.oauth2.revoke(token,()=>{});token='';expires=0;aborter?.abort();library=[];series=[];window.noctraScanLibrary=[];showLibrary();player?.pause();if($('#player').open)$('#player').close();$('#sync-drive').disabled=true;$('#connect-drive').textContent='Conectar Google Drive';status('Desconectado. El catálogo de Drive se eliminó de esta sesión.');render();setup.close();};
 async function api(path,params={},signal){if(!authorized())throw Error('Tu sesión de Google ha caducado. Pulsa «Conectar Google Drive» para renovarla.');const u=new URL('https://www.googleapis.com/drive/v3/'+path);Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));const r=await fetch(u,{headers:{Authorization:'Bearer '+token},signal});if(!r.ok){if(r.status===401){token='';throw Error('La sesión de Google caducó. Renueva el acceso.');}if(r.status===403)throw Error('Google ha limitado la solicitud o tu cuenta no tiene permiso. Comprueba los permisos y vuelve a intentarlo más tarde.');if(r.status===404)throw Error('Google no encuentra la carpeta o el archivo para esta cuenta.');throw Error('Google Drive no respondió correctamente ('+r.status+').');}return r.json();}
 function cleanTitle(name){return name.replace(/\.(mkv|mp4|webm|avi|mov|m4v|ts)$/i,'').replace(/[._]/g,' ').replace(/\b(?:2160p|1080p|720p|480p|web[- ]?dl|bdrip|bluray|full hd)\b/gi,'').replace(/\s+/g,' ').trim();}
 function showLibrary(){
   const searching=Boolean($('#search').value.trim());
   // Search across both categories. Normal browsing displays only films or grouped series.
   const wanted=m=>searching||(category==='series'?Boolean(m.seriesName):!m.seriesName);
   const listed=library.filter(wanted);
   const published=(window.noctraCloud?.movies||[]).filter(wanted);
   window.noctraMediaCategory=category;
   window.noctraScanLibrary=isAdmin()?library:[];
   const seen=new Set();
   window.serverMovies=[...published,...listed].filter(m=>{
     const key=m.fileId||m.id;
     if(seen.has(key))return false;
     seen.add(key);return true;
   });
   if(page!=='list')$('#section-title').textContent=searching?'Resultados de búsqueda':category==='series'?'Series':'Películas';
   render();
 }
 window.noctraShowLibrary=showLibrary;
 const oldRender=render;
 render=function(){
   oldRender();
   if(category==='series'||$('#search').value.trim())groupSeries();
 };
 function groupSeries(){
   const term=$('#search').value.trim().toLocaleLowerCase('es');
   const searching=Boolean(term);
   const shown=window.serverMovies.filter(m=>
     m.seriesName &&
     (page!=='list'||m.saved) &&
     (genre==='Todas'||m.genre===genre) &&
     (m.title.toLocaleLowerCase('es').includes(term)||m.seriesName.toLocaleLowerCase('es').includes(term)||String(m.seriesTitle||'').toLocaleLowerCase('es').includes(term))
   );
   const groups=new Map();
   for(const m of shown){
     if(!groups.has(m.seriesName))groups.set(m.seriesName,[]);
     groups.get(m.seriesName).push(m);
   }
   const grid=$('#real-grid');
   if(!searching)grid.replaceChildren();
   const names=[...groups.keys()];
   if($('#sort').value==='az')names.sort((a,b)=>a.localeCompare(b,'es'));
   for(const name of names){
     const episodes=groups.get(name);
     const b=document.createElement('button');
     b.type='button';
     b.className='movie-card';
     const poster=episodes.find(m=>posterURL(m.poster));
     const displayName=episodes.find(m=>m.seriesTitle)?.seriesTitle||name;
     b.innerHTML='<div class="poster"><img src="'+esc(poster?posterURL(poster.poster):'assets/city.svg')+'" alt="" loading="lazy"><span class="card-tag">SERIE · '+episodes.length+' EPISODIOS</span><div class="poster-text">'+esc(displayName)+'<small>SERIE</small></div></div><div class="card-info"><strong>'+esc(displayName)+'</strong><span>↗</span></div>';
     b.onclick=()=>openEpisodes(name,episodes);
     grid.append(b);
   }
   $('#empty').hidden=grid.children.length>0;
   if(!grid.children.length){
     $('#empty h3').textContent=searching?'No encontramos títulos con esa búsqueda.':'No hay series disponibles.';
     $('#empty p').textContent=searching?'Prueba con otro nombre de película o serie.':'Prueba más tarde: el administrador puede publicar nuevas series.';
   }
 }
 const episodeDialog=document.createElement('dialog');episodeDialog.id='episodes-dialog';document.body.append(episodeDialog);
 function resolutionLabel(m){
   const w=Number(m.width||0),h=Number(m.height||0);
   if(w>0&&h>0&&w>=1900&&w<=2048&&h>=780&&h<1000)return 'Full HD panorámico · '+w+'×'+h;
   if(w>0&&h>0)return w+'×'+h;
   return h>0?h+' px de alto (formato original)':'Resolución por comprobar';
 }
 const episodeEditDialog=document.createElement('dialog');
 episodeEditDialog.id='noctra-episode-edit';
 episodeEditDialog.innerHTML='<div class="dialog-top"><div><p class="eyebrow purple">ANTOO PELIS · EPISODIO</p><h2>Editar nombre y sinopsis</h2></div><button class="close" type="button" aria-label="Cerrar">×</button></div>'+
 '<form class="noctra-episode-edit-form"><label>Nombre del episodio<input name="title" maxlength="150" required></label><label>Sinopsis<textarea name="description" maxlength="1200" rows="5"></textarea></label><p class="hint">Esta corrección se conservará al actualizar Google Drive.</p><p id="noctra-episode-edit-error" role="alert"></p><div class="button-row"><button class="primary" type="submit">Guardar episodio</button><button type="button" class="secondary" id="noctra-episode-cancel">Cancelar</button></div></form>';
 document.body.append(episodeEditDialog);
 episodeEditDialog.querySelector('.close').onclick=()=>episodeEditDialog.close();
 episodeEditDialog.querySelector('#noctra-episode-cancel').onclick=()=>episodeEditDialog.close();
 function editEpisode(m,seriesName,items,seasonKey=null){
   if(!isAdmin()||!m.cloud)return;
   const form=episodeEditDialog.querySelector('form');
   form.elements.title.value=m.episodeTitle||m.title;
   form.elements.description.value=m.episodeDescription||'';
   const error=episodeEditDialog.querySelector('#noctra-episode-edit-error');
   error.textContent='';
   form.onsubmit=async event=>{
     event.preventDefault();const button=form.querySelector('button[type="submit"]');
     button.disabled=true;error.textContent='Guardando…';
     try{
       await window.noctraCloud.request('/api/admin/metadata/episode',{method:'PATCH',body:{
         fileId:m.fileId,title:form.elements.title.value.trim(),
         description:form.elements.description.value.trim(),filename:m.title,path:m.path||''
       }});
       m.episodeTitle=form.elements.title.value.trim();
       m.episodeDescription=form.elements.description.value.trim();
       episodeEditDialog.close();
       await window.noctraCloud.reloadCatalog();
       openEpisodes(seriesName,items,seasonKey);
     }catch(e){error.textContent=e.message;}
     finally{button.disabled=false;}
   };
   episodeEditDialog.showModal();
 }
 // Infer seasons for items that have not yet been enriched by the Worker.
 // Never confuse 1080p/years with episode numbers; ambiguous files remain separate.
 function seasonOf(m){
   const synced=Number(m.season);
   if(m.episode>0&&Number.isInteger(synced)&&synced>=0&&synced<=80)return synced;
   const title=String(m.title||'');
   const path=String(m.path||'');
   const joined=(path+' / '+title).replace(/[._-]/g,' ');
   const explicit=/(?:^|[^\p{L}\p{N}])(?:s|t)\s*0*(\d{1,2})\s*e\s*0*\d{1,3}(?!\d)/iu.exec(joined)||
     /(?:^|[^\d])(\d{1,2})\s*x\s*0*\d{1,3}(?!\d)/i.exec(joined);
   if(explicit)return Number(explicit[1]);
   const folder=/(?:^|[/\\ ])(?:temporada|season|temp|seas)\s*0*(\d{1,2})(?!\d)/i.exec(path);
   if(folder)return Number(folder[1]);
   return null;
 }
 function episodeOf(m){
   if(Number(m.episode)>0)return Number(m.episode);
   const title=String(m.title||'').replace(/[._-]/g,' ');
   const numbered=/(?:^|[^\p{L}\p{N}])(?:s|t)\s*\d{1,2}\s*e\s*0*(\d{1,3})(?!\d)/iu.exec(title)||
     /(?:^|[^\d])\d{1,2}\s*x\s*0*(\d{1,3})(?!\d)/i.exec(title)||
     /(?:episodio|episode|capitulo|capítulo|cap|ep)\s*0*(\d{1,3})(?!\d)/i.exec(title);
   if(numbered)return Number(numbered[1]);
   const folder=/(?:temporada|season|temp|seas)\s*\d{1,2}/i.test(String(m.path||''));
   const simple=folder?/^\s*0*(\d{1,3})(?:\s|$)/.exec(title):null;
   return simple?Number(simple[1]):null;
 }
 function openEpisodes(name,items,preferredSeason=null){
   const featured=items.find(m=>m.description||m.poster)||items[0]||{};
   const displayName=featured.seriesTitle||name;
   const year=featured.year?esc(featured.year):'';
   const genreText=featured.genre&&featured.genre!=='Otros'?esc(featured.genre):'';
   const rating=Number(featured.rating)>0?'★ '+Number(featured.rating).toFixed(1):'';
   const duration=Number(featured.duration)>0?Math.round(Number(featured.duration))+' min':'';
   const meta=[genreText,year,rating,duration].filter(Boolean).join(' · ');
   const poster=posterURL(featured.poster);
   const group=new Map();
   for(const m of items){
     const season=seasonOf(m);
     const key=season===null?'unknown':String(season);
     if(!group.has(key))group.set(key,[]);
     group.get(key).push(m);
   }
   const keys=[...group.keys()].sort((a,b)=>
     a==='unknown'?1:b==='unknown'?-1:Number(a)-Number(b));
   if(!keys.length)return;
   // Preserve the chosen season when re-opening after an episode edit.
   let selected=preferredSeason!==null&&group.has(String(preferredSeason))?
     String(preferredSeason):keys.find(x=>Number(x)===1)||keys[0];
   const labelFor=key=>key==='unknown'?'Sin temporada':Number(key)===0?'Especiales':'Temporada '+Number(key);
   episodeDialog.classList.add('noctra-seasons-dialog');
   episodeDialog.innerHTML='<div class="dialog-top noctra-series-dialog-head"><div>'+
     '<p class="eyebrow purple">ANTOO PELIS · SERIES</p><h2>'+esc(displayName)+'</h2></div>'+
     '<button class="close" type="button" aria-label="Cerrar">×</button></div>'+
     '<div class="noctra-series-overview">'+(poster?'<img src="'+esc(poster)+'" alt="" loading="lazy">':'')+
     '<div>'+(meta?'<p class="noctra-series-meta">'+meta+'</p>':'')+
     (featured.description?'<p>'+esc(featured.description)+'</p>':'')+'</div></div>'+
     '<div class="noctra-season-heading"><h3>Temporadas</h3></div>'+
     '<div class="noctra-season-tabs" role="tablist" aria-label="Temporadas de '+esc(displayName)+'"></div>'+
     '<div class="noctra-season-current" role="status"></div>'+
     '<div class="episode-list noctra-episode-catalog" id="noctra-season-episode-list" role="tabpanel"></div>';
   const tabs=episodeDialog.querySelector('.noctra-season-tabs');
   const list=episodeDialog.querySelector('.episode-list');
   const currentHeading=episodeDialog.querySelector('.noctra-season-current');
   episodeDialog.querySelector('.close').onclick=()=>episodeDialog.close();
   function fillSeason(key,focus=false){
     selected=key;tabs.querySelectorAll('button').forEach(button=>{
       const active=button.dataset.season===key;
       button.classList.toggle('is-current',active);
       button.setAttribute('aria-selected',String(active));
       button.tabIndex=active?0:-1;
       if(active)list.setAttribute('aria-labelledby',button.id);
     });
     if(focus)tabs.querySelector('[aria-selected="true"]')?.focus();
     const seasonItems=[...group.get(key)].sort((a,b)=>{
       const ea=episodeOf(a),eb=episodeOf(b);
       if(ea!==null&&eb!==null&&ea!==eb)return ea-eb;
       if(ea!==null&&eb===null)return -1;
       if(ea===null&&eb!==null)return 1;
       return String(a.path||'').localeCompare(String(b.path||''),'es',{numeric:true})||
         String(a.title||'').localeCompare(String(b.title||''),'es',{numeric:true});
     });
     currentHeading.textContent=labelFor(key);
     list.replaceChildren();
     for(const m of seasonItems){
       const row=document.createElement('div');row.className='episode-item noctra-episode-entry';
       const main=document.createElement('button');main.type='button';
       main.className='noctra-episode-play';
       main.dataset.episodeRoute=window.antooRoutes?.episodePath?.(m,name,items,key)||'';
       const n=episodeOf(m),number=n!==null?'E'+String(n).padStart(2,'0'):'EPISODIO';
       const episodeTitle=m.episodeTitle||m.title;
       const still=posterURL(m.episodeStill);
       main.innerHTML=(still?'<img class="noctra-episode-still" src="'+esc(still)+'" alt="" loading="lazy">':
         '<span class="noctra-episode-play-icon">▶</span>')+
         '<div class="noctra-episode-text"><small class="noctra-episode-number">'+esc(number)+'</small>'+
         '<strong>'+esc(episodeTitle)+'</strong>'+
         (m.episodeDescription?'<p>'+esc(m.episodeDescription)+'</p>':
            '<small class="noctra-episode-filename">'+esc(m.title)+'</small>')+
         '</div><span class="noctra-episode-watch">▶</span>';
       main.onclick=()=>{
         window.noctraWatchState?.setQueue?.(seasonItems,m,name,key);
         window.antooRoutes?.episode?.(m,name,items,key);
         window.noctraPlayerFullscreen?.setReturnInfo?.(()=>openEpisodes(name,items,key));
         episodeDialog.close();
         if(m.cloud)window.noctraCloud.play(m);else playDirect(m);
       };
       const progress=window.noctraWatchState?.progressElement?.(m,'noctra-episode-progress');
       if(progress)main.querySelector('.noctra-episode-text')?.append(progress);
       row.append(main);
       if(isAdmin()&&m.cloud){
         const edit=document.createElement('button');edit.type='button';
         edit.className='noctra-episode-edit';edit.textContent='Editar';
         edit.setAttribute('aria-label','Editar '+episodeTitle);
         edit.onclick=()=>editEpisode(m,name,items,key);
         row.append(edit);
       }
       list.append(row);
     }
     list.scrollTop=0;
   }
   keys.forEach((key,i)=>{
     const tab=document.createElement('button');tab.type='button';
     tab.className='noctra-season-tab';tab.dataset.season=key;
     tab.id='noctra-season-tab-'+i;
     tab.setAttribute('role','tab');tab.setAttribute('aria-controls','noctra-season-episode-list');
     tab.textContent=labelFor(key);
     tab.onclick=()=>{fillSeason(key);window.antooRoutes?.season?.(name,items,key);};
     tab.onkeydown=e=>{
       if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft'&&e.key!=='Home'&&e.key!=='End')return;
       e.preventDefault();e.stopPropagation();const at=keys.indexOf(key);
       const next=e.key==='Home'?0:e.key==='End'?keys.length-1:
         (at+(e.key==='ArrowRight'?1:-1)+keys.length)%keys.length;
       fillSeason(keys[next],true);window.antooRoutes?.season?.(name,items,keys[next]);
     };
     tabs.append(tab);
   });
   fillSeason(selected);
   if(!episodeDialog.open)episodeDialog.showModal();
   if(preferredSeason!==null)window.antooRoutes?.season?.(name,items,selected);
   else window.antooRoutes?.series?.(name,items);
 }
 window.noctraOpenEpisodes=openEpisodes;

 tabs.querySelectorAll('button').forEach(b=>b.onclick=()=>{
   category=b.dataset.kind;
   if($('#search').value)$('#search').value='';
   tabs.querySelectorAll('button').forEach(x=>{
     const selected=x===b;
     x.classList.toggle('selected',selected);
     x.setAttribute('aria-pressed',String(selected));
   });
   showLibrary();
   window.antooRoutes?.section?.('library',category);
 });
 async function scan(){if(!isAdmin())return;if(scanning)return;if(!authorized()){status('Conecta Google Drive para actualizar.');return;}scanning=true;$('#sync-drive').textContent='Cancelar';$('#sync-drive').disabled=false;aborter=new AbortController();const signal=aborter.signal,found=[],queue=[{id:config.root,path:[]}],visited=new Set();let scanned=0;
 try{await api('files/'+config.root,{fields:'id,name,mimeType',supportsAllDrives:'true'},signal);
 while(queue.length){const folder=queue.shift();if(visited.has(folder.id))continue;visited.add(folder.id);let next='';do{const data=await api('files',{q:`'${folder.id}' in parents and trashed = false`,fields:'nextPageToken,incompleteSearch,files(id,name,mimeType,size,videoMediaMetadata,shortcutDetails)',pageSize:'1000',pageToken:next,includeItemsFromAllDrives:'true',supportsAllDrives:'true'},signal);if(data.incompleteSearch)throw Error('Drive devolvió una búsqueda incompleta. Conservamos el catálogo anterior para evitar omisiones.');for(const f of data.files||[]){if(f.mimeType===FOLDER)queue.push({id:f.id,path:[...folder.path,f.name]});else if(f.mimeType?.startsWith('video/')||/\.(mkv|mp4|webm|avi|mov|m4v|ts)$/i.test(f.name)){const seriesAt=folder.path.findIndex(p=>/^series?$/i.test(p));const m={id:'gdrive-'+f.id,fileId:f.id,title:cleanTitle(f.name),filename:f.name,genre:'Otros',drive:`https://drive.google.com/file/d/${f.id}/view`,variants:[],saved:false,added:0,connected:true,poster:'',path:folder.path.join(' / '),seriesName:seriesAt>=0?folder.path[seriesAt+1]||'Series':'',width:f.videoMediaMetadata?.width||null,height:f.videoMediaMetadata?.height||null,size:Number(f.size||0)};found.push(m);}}next=data.nextPageToken||'';status(`Explorando ${folder.path.join(' / ')||'carpeta principal'} · ${found.length} videos encontrados`);}while(next);scanned++;}
 const favorites=new Set(storedJSON('noctra.drive.favorites',[]));library=found.map(m=>({...m,saved:favorites.has(m.fileId)}));lastScan=new Date().toLocaleTimeString('es');status(`${library.length} videos · ${scanned} carpetas · Actualizado a las ${lastScan}`);showLibrary();
 }catch(e){status(e.name==='AbortError'?'Exploración cancelada. Se conserva el catálogo anterior.':e.message);}finally{scanning=false;$('#sync-drive').textContent='↻ Actualizar';}}
 $('#sync-drive').onclick=()=>{if(!isAdmin())return;scanning?aborter.abort():scan();};
 // Folder lists stay in memory: never publish a snapshot of private Drive contents.
 const originalDetail=openDetail;openDetail=function(m){originalDetail(m);if(m.cloud){$('#play-movie').onclick=()=>{window.noctraPlayerFullscreen?.setReturnInfo?.(()=>openDetail(m));$('#details').close();window.noctraCloud.play(m);};$('#save-movie').onclick=()=>{window.noctraCloud.saveFavorite(m);$('#save-movie').textContent=m.saved?'✓ En mi lista':'＋ Mi lista';};$('#detail-content .detail-bottom').innerHTML='<span class="hint">Película de tu catálogo compartido</span>';return;}if(!m.connected)return;$('#play-movie').onclick=()=>{window.noctraPlayerFullscreen?.setReturnInfo?.(()=>openDetail(m));$('#details').close();playDirect(m);};$('#save-movie').onclick=()=>{m.saved=!m.saved;storeSet('noctra.drive.favorites',JSON.stringify(library.filter(x=>x.saved).map(x=>x.fileId)));$('#save-movie').textContent=m.saved?'✓ En mi lista':'＋ Mi lista';showLibrary();};$('#detail-content .notice').textContent=m.height?`Archivo original: ${resolutionLabel(m)}. No se generan versiones adicionales.`:'Se reproducirá el archivo original. El reproductor comprobará sus pistas y resolución.';$('#detail-content .detail-bottom').innerHTML=`<span class="hint">${esc(m.path)} · ${(m.size/1e9).toFixed(2)} GB</span>`;};
 const iframePlay=playMovie;playMovie=function(m){playDirect(m);};
  function fallbackToDrive(m,reason){
    $('#frame-container').textContent=reason||'No se pudo reproducir este archivo. Comprueba el formato y la conexión.';
    $('#quality').innerHTML='<option>Reproducción no disponible</option>';
    $('#quality').disabled=true;
    $('#player .hint').textContent='ANTOO PELIS utiliza Movi Player, sin vista previa de Google Drive.';
  }
 async function playDirect(m){
 const fileId=m.fileId||(typeof driveId==='function'?driveId(m.drive):null);
 const cloudMovie=window.noctraCloud?.movies.find(x=>x.fileId===fileId);
 if(cloudMovie){return window.noctraCloud.play(cloudMovie);}
 if(fileId && window.noctraCloud){toast('Primero publica este archivo en Administrar → Publicar catálogo actual para reproducirlo con Movi Player.');return;}
 if(!authorized()){toast('Conecta Google Drive para reproducir el archivo original.');if(!config.clientId)openSetup();else $('#connect-drive').focus();return;}active=m;const serial=++playSerial;$('#player-title').textContent=m.title;$('#drive-open').href=m.drive;$('#quality').innerHTML='<option>Archivo original</option>';$('#quality').disabled=true;$('#quality').onchange=null;$('#player .hint').textContent='Leyendo el archivo original de Drive. La reproducción depende de los códecs y del dispositivo.';$('#frame-container').innerHTML='<div class="loading-player">Preparando tu película…</div>';if(!$('#player').open)$('#player').showModal();$('#retry').onclick=()=>playDirect(m);
 try{await import('https://cdn.jsdelivr.net/npm/movi-player/dist/element.js');if(serial!==playSerial)return;const fileId=m.fileId||driveId(m.drive);const sources=[{id:fileId,label:'Original'},...m.variants.map(v=>({id:driveId(v.url),label:v.label}))];const verified=[];for(const source of sources){const meta=await api('files/'+source.id,{fields:'id,name,mimeType,videoMediaMetadata,capabilities(canDownload)',supportsAllDrives:'true'});if(meta.capabilities?.canDownload===false)throw Error('El propietario no permite leer el archivo original.');verified.push({...source,height:meta.videoMediaMetadata?.height||0,mime:meta.mimeType});}if(serial!==playSerial)return;
 const el=document.createElement('movi-player');player=el;['controls','resume','playsinline','fastseek','subtitlepicker'].forEach(a=>el.setAttribute(a,''));el.setAttribute('resumekey','noctra-'+fileId);el.setAttribute('sw','auto');el.setAttribute('theme','dark');el.setAttribute('title',m.title);el.setAttribute('showtitle','');el.setAttribute('titlemode','both back');el.headers={Authorization:'Bearer '+token};el.style.cssText='display:block;width:100%;height:100%;';
 for(const source of verified){const s=document.createElement('source');s.src=`https://www.googleapis.com/drive/v3/files/${source.id}?alt=media`;if(source.mime)s.type=source.mime;if(source.height)s.dataset.height=source.height;s.dataset.label=source.height?source.height+'p':source.label;el.append(s);}if(verified.length===1)el.src=`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
 el.addEventListener('loadedmetadata',()=>{$('#player .hint').textContent=`Reproducción original${el.videoHeight?' · '+el.videoHeight+'p':''}. Audio y subtítulos disponibles en los controles.`;});el.addEventListener('error',()=>{if(serial===playSerial)fallbackToDrive(m,'Movi Player no pudo reproducir el archivo.');});$('#quality').innerHTML=verified.length===1?`<option>${verified[0].height?verified[0].height+'p · Original':'Original · resolución por comprobar'}</option>`:'<option>Calidades en ⚙ del reproductor</option>';$('#frame-container').replaceChildren(el);
 window.noctraPlayerFullscreen?.attach?.(el);
 $('#player .hint').textContent=verified.length===1?'Se reproduce la calidad original del archivo; no hay otras versiones verificadas.':'Selecciona una versión disponible en los ajustes del reproductor.';
 }catch(e){if(serial===playSerial){fallbackToDrive(m,'No se pudo iniciar la reproducción directa ('+(e?.message||'error desconocido')+').');}}}
 $('#player').addEventListener('close',()=>{
   playSerial++;
   const current=player;
   window.noctraWatchState?.detach?.(current?.player||current);
   for(const node of [current,current?.player,...(current?.shadowRoot?.querySelectorAll('audio,video')||[])].filter(Boolean)){
     try{node.muted=true;node.volume=0;node.setVolume?.(0);node.pause?.();node.stop?.();}catch{}
   }
   current?.remove?.();player=null;
 });
 window.addEventListener('pagehide',()=>{
   playSerial++;
   const current=player;
   if(!current)return;
   for(const node of [current,current.player,...(current.shadowRoot?.querySelectorAll('audio,video')||[])].filter(Boolean)){
     try{node.muted=true;node.volume=0;node.setVolume?.(0);node.pause?.();node.stop?.();}catch{}
   }
 },{capture:true});
 // Try to renew only through an explicit user click; never save OAuth tokens.
 setInterval(()=>{if(token&&!authorized()){token='';status('La sesión de Google caducó. Renueva el acceso para seguir leyendo Drive.');player?.pause();}},30000);
 // Mover los controles Google al diálogo privado de administración.
 window.noctraDriveAdmin={
   mount(target){
     if(!isAdmin()||!target)return;
     target.append(panel);
     panel.hidden=false;
   },
   openSetup(){if(isAdmin())openSetup();}
 };
 $('#settings-dialog .settings-section:last-child').innerHTML=
   '<h3>Reproducción y acceso</h3><p>Selecciona una película o serie de la biblioteca y pulsa Reproducir. El reproductor permite escoger idiomas y subtítulos cuando el archivo los incluye.</p><p>Si una película tarda en iniciar, espera un momento mientras se prepara.</p>';
})();
