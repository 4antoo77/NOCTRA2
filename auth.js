(() => {
  'use strict';
  const cfg=window.NOCTRA2_CONFIG||{};
  const root=String(cfg.API_BASE||'').replace(/\/+$/,'');
  const validApi=/^https:\/\/[a-z\d.-]+(?::\d+)?$/i.test(root)&&!root.includes('TU-WORKER');
  const form=document.getElementById('noctra-login-form'),setup=document.getElementById('noctra-setup');
  const error=document.getElementById('login-error');
  const $=id=>document.getElementById(id);
  let token=sessionStorage.getItem('noctra2.token')||'',me=null,loaded=false,cloud=[];
  let moviLoader=null,activePlayer=null,playRequest=0;
  async function loadMovi(){
    if(customElements.get('movi-player'))return;
    if(!moviLoader)moviLoader=import('https://cdn.jsdelivr.net/npm/movi-player/dist/element.js').catch(e=>{moviLoader=null;throw e;});
    await moviLoader;
    if(!customElements.get('movi-player'))throw Error('El componente Movi Player no está disponible.');
  }
  document.getElementById('player').addEventListener('close',()=>{
    playRequest++;
    const qualityRow=$('quality')?.closest('label');
    if(qualityRow)qualityRow.hidden=false;
    if(activePlayer){
      try{activePlayer.pause();activePlayer.removeAttribute('src');}catch{}
      activePlayer.remove();activePlayer=null;
    }
    $('frame-container').replaceChildren();
  });
  function msg(s){error.textContent=s;}
  async function request(path,opts={}){
    if(!validApi)throw Error('Falta configurar la URL del Worker en config.js.');
    const headers={'Content-Type':'application/json',...(opts.headers||{})};
    if(token)headers.Authorization='Bearer '+token;
    const response=await fetch(root+path,{method:opts.method||'GET',headers,body:opts.body===undefined?undefined:JSON.stringify(opts.body),cache:'no-store',mode:'cors'});
    let data={};try{data=await response.json();}catch{}
    if(!response.ok)throw Error(data.error||'Error de conexión ('+response.status+').');return data;
  }
  const cloudApi={
    get user(){return me},get movies(){return cloud},get token(){return token},
    request,
    async reloadCatalog(){const d=await request('/api/catalog');let fav;try{fav=new Set(JSON.parse(localStorage.getItem('noctra2.favorites')||'[]'));}catch{fav=new Set();}cloud=(d.movies||[]).map(m=>({...m,saved:fav.has(m.fileId)}));if(typeof window.noctraShowLibrary==='function')window.noctraShowLibrary();else {window.serverMovies=[...cloud];if(typeof render==='function')render();}return cloud;},
    async play(m){
      const fileId=m.fileId||(typeof driveId==='function'?driveId(m.drive):null)||
        (typeof m.id==='string'&&m.id.startsWith('gdrive-')?m.id.slice(7):null);
      if(!fileId){if(typeof toast==='function')toast('No se encontró el archivo de Google Drive.');return;}
      const playId=++playRequest;
      const dialog=$('player'),hint=dialog.querySelector('.hint');
      $('player-title').textContent=m.title;
      $('drive-open').href=m.drive||'https://drive.google.com/file/d/'+encodeURIComponent(fileId)+'/view';
      // El selector externo añadido en pruebas no era parte de Movi Player.
      // Las pistas reales se eligen desde la configuración integrada (⚙).
      const row=$('quality').closest('label');
      if(row)row.hidden=true;
      hint.textContent='Es normal que algunas películas tarden un poco en iniciar. Espera unos momentos.';
      $('frame-container').textContent='Cargando reproductor…';
      if(!dialog.open)dialog.showModal();
      $('retry').onclick=()=>cloudApi.play(m);
      try{
        const signed=await request('/api/play/'+encodeURIComponent('gdrive-'+fileId),{method:'POST'});
        await loadMovi();
        if(playId!==playRequest)return;
        if(activePlayer){
          try{activePlayer.pause?.();activePlayer.removeAttribute('src');}catch{}
          activePlayer.remove();activePlayer=null;
        }
        const el=document.createElement('movi-player');
        ['controls','autoplay','playsinline','resume','fastseek','subtitlepicker'].forEach(a=>el.setAttribute(a,''));
        el.setAttribute('spinnerdelay','0');
        // Recupera la configuración original de Movi usada para el MKV.
        // No forzar primero "native": puede limitar el acceso a las pistas muxed.
        el.setAttribute('sw','auto');
        el.setAttribute('theme','dark');
        el.setAttribute('persist','volume speed audiolang subtitlelang');
        el.setAttribute('persistkey','noctra2-cine');
        el.setAttribute('resumekey','noctra2-'+fileId);
        el.setAttribute('title',m.title||'NOCTRA2');
        el.style.cssText='display:block;width:100%;height:100%;min-height:230px;background:#000';
        el.addEventListener('loadedmetadata',()=>{
          if(playId!==playRequest)return;
          const tracks=el.player?.getAudioTracks?.()||[];
          if(tracks.length>1){
            hint.textContent='Hay '+tracks.length+' pistas de audio en el archivo. Cámbialas en los controles de Movi Player.';
          }else if(tracks.length===1){
            hint.textContent='Movi Player ha detectado una pista de audio en este archivo. Las opciones disponibles aparecen en los controles.';
          }else{
            hint.textContent='Reproducción original del MKV. Los idiomas y subtítulos aparecerán dentro de Movi Player cuando se detecten.';
          }
        });
        el.addEventListener('trackschange',()=>{
          if(playId!==playRequest)return;
          const tracks=el.player?.getAudioTracks?.()||[];
          if(tracks.length>1)hint.textContent='Hay '+tracks.length+' pistas de audio. Usa los controles de Movi Player para elegir idioma.';
        });
        // Aviso sencillo durante la preparación inicial o nuevas esperas.
        // No representa el progreso de descarga ni altera el motor Movi.
        const notice=document.createElement('div');
        notice.className='noctra-loading-notice';
        notice.setAttribute('role','status');
        const noticeHeading=document.createElement('strong');
        noticeHeading.textContent='La película se está preparando';
        const noticeText=document.createElement('span');
        noticeText.textContent='Algunas películas tardan un poco en iniciar. Es normal, espera unos momentos.';
        notice.append(noticeHeading,noticeText);
        el.addEventListener('waiting',()=>{
          if(playId!==playRequest)return;
          notice.hidden=false;
          hint.textContent='Es normal que esta película tarde un poco en comenzar. Espera mientras se prepara.';
        });
        el.addEventListener('playing',()=>{
          if(playId!==playRequest)return;
          notice.hidden=true;
          hint.textContent='Reproduciendo con Movi Player.';
        });
        el.addEventListener('error',()=>{
          if(playId!==playRequest)return;
          notice.hidden=true;
          hint.textContent='Movi Player no pudo abrir este archivo. Comprueba el formato y la conexión.';
        });
        activePlayer=el;
        $('frame-container').replaceChildren(el,notice);
        el.src=signed.url;

        // Movi Player es el único reproductor. La preparación de este MKV
        // puede tardar; la interfaz indica el estado sin superponer otro player.
        if(typeof el.play==='function')Promise.resolve(el.play()).catch(()=>{});

      }catch(e){
        if(playId!==playRequest)return;
        const message=/Película no encontrada/i.test(e.message)
          ?'Este archivo no está publicado. Ve a Administrar → Publicar catálogo actual.'
          :e.message;
        hint.textContent='Error al iniciar el reproductor: '+message;
        $('frame-container').textContent=message;
        if(typeof toast==='function')toast(message);
      }
    },
    saveFavorite(m){m.saved=!m.saved;let x=[];try{x=JSON.parse(localStorage.getItem('noctra2.favorites')||'[]');}catch{}const s=new Set(x);m.saved?s.add(m.fileId):s.delete(m.fileId);localStorage.setItem('noctra2.favorites',JSON.stringify([...s]));if(typeof render==='function')render();},
    async logout(){try{await request('/api/logout',{method:'POST'});}catch{}sessionStorage.removeItem('noctra2.token');token='';location.reload();}
  };
  window.noctraCloud=cloudApi;
  function script(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(Error('No se pudo cargar '+src));document.body.append(s);});}
  function userbar(){const box=document.createElement('div');box.className='noctra-userbar';const name=document.createElement('span');name.className='auth-user';name.textContent=me.username;box.append(name);if(me.role==='admin'){const b=document.createElement('button');b.textContent='Administrar';b.onclick=()=>openAdmin();box.append(b);}const exit=document.createElement('button');exit.textContent='Salir';exit.onclick=cloudApi.logout;box.append(exit);document.querySelector('.header-right').append(box);}
  async function activate(user){me=user;form.reset();$('noctra-login').hidden=true;document.body.classList.remove('auth-locked');if(!loaded){await script('app.js?v=20261012-hd-episodes8');await script('drive.js?v=20261012-hd-episodes8');await script('responsive.js?v=20261012-global-search2');loaded=true;userbar();
    document.body.classList.toggle('noctra-admin',me.role==='admin');
    if(me.role!=='admin'){
      document.querySelectorAll('[data-add], #editor, #import, #export, #import-file').forEach(el=>{el.hidden=true;el.disabled=true;});
      const settings=$('settings-dialog')?.querySelector('.settings-section:first-of-type');
      if(settings)settings.hidden=true;
    }
    if(me.role!=='admin'){
      document.querySelectorAll('.banner .primary, .empty .text-button, header .add-top').forEach(b=>{b.textContent='Ver películas';b.onclick=()=>{document.querySelector('#catalog').scrollIntoView({behavior:'smooth'});};});document.querySelector('.showcase')?.setAttribute('hidden','');
      const panel=document.querySelector('.drive-panel');if(panel)panel.hidden=true;
    }
    await cloudApi.reloadCatalog();
    // Automatic TMDB processing starts on admin login; no per-title clicks.
    if(me.role==='admin')void window.noctraMetadataAdmin?.autoStart?.(cloudApi,request);
  }}
  async function init(){if(!validApi){msg('Configura primero Cloudflare: abre config.js y reemplaza TU-WORKER.');return;}try{const s=await request('/api/status');setup.hidden=!!s.ready;form.hidden=!s.ready;if(token && s.ready){const v=await request('/api/me');await activate(v.user);}}catch(e){msg(e.message);}}
  form.addEventListener('submit',async e=>{e.preventDefault();msg('');$('login-submit').disabled=true;try{const d=await request('/api/login',{method:'POST',body:{username:$('login-username').value.trim(),password:$('login-password').value}});token=d.token;sessionStorage.setItem('noctra2.token',token);await activate(d.user);}catch(e){msg(e.message);}finally{$('login-submit').disabled=false;}});
  setup.addEventListener('submit',async e=>{e.preventDefault();msg('');$('setup-submit').disabled=true;try{await request('/api/setup',{method:'POST',body:{bootstrapSecret:$('setup-secret').value,username:$('setup-username').value.trim(),password:$('setup-password').value}});$('setup-secret').value='';$('setup-password').value='';setup.hidden=true;form.hidden=false;msg('Administrador creado. Inicia sesión.');}catch(e){msg(e.message);}finally{$('setup-submit').disabled=false;}});
  async function openAdmin(){
    if(me?.role!=='admin')return;
    let d=$('noctra-admin-dialog');if(!d){d=document.createElement('dialog');d.id='noctra-admin-dialog';d.innerHTML=`<div class="dialog-top"><div><p class="eyebrow purple">NOCTRA2 · ADMINISTRACIÓN</p><h2>Usuarios y catálogo</h2></div><button class="close" type="button" aria-label="Cerrar">×</button></div><section><h3 class="admin-subtitle">Crear cuenta para un amigo</h3><form id="new-user-form"><label>Usuario (sin correo)<input id="new-username" required minlength="3" maxlength="32" autocomplete="off" placeholder="amigo1"></label><label>Contraseña (12 caracteres mínimo)<input id="new-password" type="password" required minlength="12" autocomplete="new-password"></label><button class="primary" type="submit">Crear usuario</button></form><p class="admin-error" id="admin-error" role="alert"></p></section><section><h3 class="admin-subtitle">Cuentas</h3><div id="admin-users"></div></section><section><h3 class="admin-subtitle">Google Drive · conexión y sincronización</h3><p class="admin-note">Solo el administrador conecta, configura y sincroniza las carpetas. Los invitados usan el catálogo publicado sin Google.</p><div id="admin-drive-slot"></div></section><section><h3 class="admin-subtitle">Herramientas del catálogo local</h3><div id="admin-local-tools-slot"></div></section><section><h3 class="admin-subtitle">Metadatos de películas y series</h3><p class="admin-note">NOCTRA2 completa automáticamente las fichas, fondos en HD y nombres de los episodios. Si falta una película, búscala por nombre original o pega su enlace de TMDB. Pulsa el resultado correcto para guardarlo; la edición avanzada es opcional.</p><div id="admin-metadata-slot"></div></section><section><h3 class="admin-subtitle">Películas para todos</h3><p class="admin-note">Conecta tu Drive como administrador, espera a que se analice la carpeta y pulsa «Publicar catálogo». Se guardan títulos y enlaces, NO videos. Solo usuarios autorizados pueden consultar estos datos.</p><div class="button-row"><button class="secondary" id="publish-scan" type="button">Publicar catálogo actual</button><button class="secondary" id="refresh-cloud" type="button">Actualizar catálogo</button></div><label>O importar el JSON exportado de NOCTRA<input type="file" id="cloud-json" accept=".json,application/json"></label><p class="admin-note">Importar sustituye el catálogo compartido. Revisa que todos los archivos sean tuyos y que sus permisos sean adecuados.</p></section><p class="admin-error" id="admin-catalog-error" role="alert"></p>`;document.body.append(d);d.querySelector('.close').onclick=()=>d.close();d.querySelector('#new-user-form').onsubmit=async e=>{e.preventDefault();const er=$('admin-error');er.textContent='';try{await request('/api/admin/users',{method:'POST',body:{username:$('new-username').value.trim(),password:$('new-password').value}});e.target.reset();er.textContent='Usuario creado.';await listUsers();}catch(ex){er.textContent=ex.message;}};d.querySelector('#publish-scan').onclick=async()=>{const er=$('admin-catalog-error');er.textContent='';const local=typeof movies!=='undefined'?movies:[];const scanned=window.noctraScanLibrary||[];const all=[...cloud,...local,...scanned];if(!all.length){er.textContent='Primero conecta Drive o importa un catálogo.';return;}if(!confirm('¿Publicar '+all.length+' entradas de catálogo compartido? Las cuentas podrán ver sus títulos.'))return;try{const r=await request('/api/admin/catalog',{method:'PUT',body:{movies:all}});await cloudApi.reloadCatalog();void window.noctraMetadataAdmin?.autoStart?.(cloudApi,request);er.textContent=r.count+' archivos publicados. NOCTRA2 completará sus metadatos automáticamente.';}catch(ex){er.textContent=ex.message;}};d.querySelector('#refresh-cloud').onclick=()=>cloudApi.reloadCatalog().catch(e=>$('admin-catalog-error').textContent=e.message);d.querySelector('#cloud-json').onchange=async e=>{const er=$('admin-catalog-error');try{const f=e.target.files[0];if(!f)return;if(f.size>1000000)throw Error('El catálogo es demasiado grande.');const j=JSON.parse(await f.text());const a=Array.isArray(j)?j:j.movies;if(!Array.isArray(a))throw Error('JSON incorrecto.');if(!confirm('¿Sustituir el catálogo compartido por '+a.length+' películas?'))return;const r=await request('/api/admin/catalog',{method:'PUT',body:{movies:a}});await cloudApi.reloadCatalog();void window.noctraMetadataAdmin?.autoStart?.(cloudApi,request);er.textContent=r.count+' películas importadas. Se buscarán sus metadatos automáticamente.';}catch(ex){er.textContent=ex.message;}finally{e.target.value='';}};}
    window.noctraDriveAdmin?.mount(d.querySelector('#admin-drive-slot'));
    window.noctraMetadataAdmin?.mount(d.querySelector('#admin-metadata-slot'),cloudApi,request);
    const localSettings=$('settings-dialog')?.querySelector('.settings-section:first-of-type');
    const localSlot=d.querySelector('#admin-local-tools-slot');
    if(localSettings&&localSlot){localSlot.append(localSettings);localSettings.hidden=false;}
    d.showModal();await listUsers();}
  async function listUsers(){const box=$('admin-users');box.textContent='Cargando…';try{const data=await request('/api/admin/users');box.replaceChildren();for(const u of data.users){const row=document.createElement('div');row.className='admin-row';const detail=document.createElement('div');const name=document.createElement('strong');name.textContent=u.username;const subtitle=document.createElement('small');subtitle.textContent=u.role==='admin'?'Administrador':u.disabled?'Desactivado':'Activo';detail.append(name,subtitle);row.append(detail);if(u.role!=='admin'){const actions=document.createElement('div');actions.className='admin-actions';const block=document.createElement('button');block.textContent=u.disabled?'Reactivar':'Desactivar';block.onclick=async()=>{try{await request('/api/admin/users/'+u.id,{method:'PATCH',body:{disabled:!u.disabled}});await listUsers();}catch(e){$('admin-error').textContent=e.message;}};const pass=document.createElement('button');pass.textContent='Cambiar contraseña';pass.onclick=async()=>{const p=prompt('Nueva contraseña para '+u.username+' (12 caracteres mínimo):');if(p===null)return;try{await request('/api/admin/users/'+u.id,{method:'PATCH',body:{password:p}});$('admin-error').textContent='Contraseña actualizada. Sesiones anteriores cerradas.';}catch(e){$('admin-error').textContent=e.message;}};actions.append(block,pass);row.append(actions);}box.append(row);}}catch(e){box.textContent=e.message;}}
  init();
})();