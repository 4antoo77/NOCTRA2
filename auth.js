(() => {
  'use strict';
  const cfg=window.NOCTRA2_CONFIG||{};
  const root=String(cfg.API_BASE||'').replace(/\/+$/,'');
  const validApi=/^https:\/\/[a-z\d.-]+(?::\d+)?$/i.test(root)&&!root.includes('TU-WORKER');
  const form=document.getElementById('noctra-login-form'),setup=document.getElementById('noctra-setup');
  const error=document.getElementById('login-error');
  const $=id=>document.getElementById(id);
  const rememberedKey='noctra2.remembered-token';
  const rememberInput=$('login-remember');
  const readStorage=(store,key)=>{try{return store.getItem(key)||'';}catch{return '';}};
  const clearSession=()=>{try{sessionStorage.removeItem('noctra2.token');localStorage.removeItem(rememberedKey);}catch{}};
  let token=readStorage(sessionStorage,'noctra2.token')||readStorage(localStorage,rememberedKey),me=null,loaded=false,cloud=[];
  if(rememberInput)rememberInput.checked=!!readStorage(localStorage,rememberedKey);
  function saveSession(value,remember){
    clearSession();token=value;
    try{(remember?localStorage:sessionStorage).setItem(remember?rememberedKey:'noctra2.token',value);}catch{
      // Browsers in private mode may forbid persistent storage.
      try{sessionStorage.setItem('noctra2.token',value);}catch{}
    }
  }
  // This is read-only recovery. It never republishes or overwrites Drive data.
  function catalogNotice(message=''){
    const catalog=$('catalog');if(!catalog)return;
    let node=$('noctra-catalog-notice');
    if(!node){
      node=document.createElement('div');
      node.id='noctra-catalog-notice';
      node.setAttribute('role','status');
      node.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;background:#282330;color:#f8f4ff;border:1px solid #ba99de88;border-radius:12px;padding:14px 18px;margin:12px 0 20px;font-size:14px;';
      const label=document.createElement('span');label.className='noctra-catalog-message';label.style.flex='1 1 200px';
      const retry=document.createElement('button');retry.type='button';retry.textContent='Volver a cargar catálogo';
      retry.className='secondary';retry.style.minHeight='44px';
      retry.onclick=async()=>{
        retry.disabled=true;
        try{await cloudApi.reloadCatalog();}catch(e){catalogNotice('No se pudo recuperar el catálogo: '+e.message);}
        finally{retry.disabled=false;}
      };
      node.append(label,retry);
      const heading=catalog.querySelector('.section-heading')||catalog.firstElementChild;
      if(heading)heading.insertAdjacentElement('afterend',node);else catalog.prepend(node);
    }
    node.hidden=!message;
    node.querySelector('.noctra-catalog-message').textContent=message;
  }

  let moviLoader=null,activePlayer=null,playRequest=0;
  async function loadMovi(){
    if(customElements.get('movi-player'))return;
    if(!moviLoader)moviLoader=import('https://cdn.jsdelivr.net/npm/movi-player/dist/element.js').catch(e=>{moviLoader=null;throw e;});
    await moviLoader;
    if(!customElements.get('movi-player'))throw Error('El componente Movi Player no está disponible.');
  }
  document.getElementById('player').addEventListener('close',()=>{
    playRequest++;
    window.antooAVPlayerMain?.stop?.();
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
    async reloadCatalog(){
      let data;
      try{data=await request('/api/catalog');}
      catch(e){catalogNotice('No se pudo consultar el catálogo publicado. Tus archivos no se han eliminado. '+e.message);throw e;}
      if(!Array.isArray(data.movies)){
        const e=Error('Respuesta de catálogo incorrecta.');
        catalogNotice('El servidor devolvió una respuesta de catálogo incorrecta. No vuelvas a publicar todavía.');
        throw e;
      }
      let fav;try{fav=new Set(JSON.parse(localStorage.getItem('noctra2.favorites')||'[]'));}catch{fav=new Set();}
      cloud=data.movies.map(m=>({...m,saved:fav.has(m.fileId)}));
      window.noctraWatchState?.render?.();
      if(typeof window.noctraShowLibrary==='function')window.noctraShowLibrary();
      else {window.serverMovies=[...cloud];if(typeof render==='function')render();}
      catalogNotice(cloud.length?'':'El servidor devolvió 0 títulos. No vuelvas a publicar ni importar un catálogo vacío. Usa «Volver a cargar catálogo» para comprobarlo.');
      window.antooRoutes?.onCatalogReady?.();
      window.antooRefreshHomeCarousel?.();
      return cloud;
    },
    async play(m,playOptions={}){
      const fileId=m.fileId||(typeof driveId==='function'?driveId(m.drive):null)||
        (typeof m.id==='string'&&m.id.startsWith('gdrive-')?m.id.slice(7):null);
      if(!fileId){if(typeof toast==='function')toast('No se encontró el archivo de Google Drive.');return;}
      const playId=++playRequest;
      window.antooAVPlayerMain?.stop?.();
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
        if(playId!==playRequest||!dialog.open)return;
        // AVPlayer fue verificado con MKV, audio y subtítulos en la prueba.
        // Si falla al iniciar este título concreto, recuperar Movi Player.
        if(window.antooAVPlayerMain?.start){
          if(activePlayer){
            try{activePlayer.pause?.();activePlayer.removeAttribute('src');activePlayer.remove();}catch{}
            activePlayer=null;
          }
          try{
            const ready=await window.antooAVPlayerMain.start({
              url:signed.url,frame:$('frame-container'),dialog,hint,title:m.title,resumeAt:playOptions.resumeAt||0,media:m
            });
            if(playId!==playRequest||!dialog.open)return;
            if(ready)return;
            return;
          }catch(newPlayerError){
            if(playId!==playRequest||!dialog.open)return;
            console.warn('ANTOO PELIS: AVPlayer no pudo iniciar, usando reproductor de respaldo.',newPlayerError);
            hint.textContent='Este archivo no inició con AVPlayer. Probando el reproductor alternativo…';
            $('frame-container').textContent='Cargando reproductor de respaldo…';
          }
        }
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
        el.setAttribute('title',m.title||'ANTOO PELIS');
        el.setAttribute('showtitle','');el.setAttribute('titlemode','both back');
        el.style.cssText='display:block;width:100%;height:100%;min-height:230px;background:#000';
        el.addEventListener('loadedmetadata',()=>{
          if(playId!==playRequest)return;
          const mediaPlayer=el.player||el;
          window.noctraWatchState?.attach?.(mediaPlayer,{media:m,resumeAt:playOptions.resumeAt||0,timeScale:1000});
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
          window.noctraWatchState?.reportError?.(m,'MEDIA_FORMAT');
          hint.textContent='Movi Player no pudo abrir este archivo. Comprueba el formato y la conexión.';
        });
        activePlayer=el;
        $('frame-container').replaceChildren(el,notice);
        // Movi Player keeps its own original fullscreen button.
        // iPhone Safari receives a video-only fallback without rotating UI.
        window.noctraPlayerFullscreen?.attach?.(el);
        el.src=signed.url;

        // Movi Player es el único reproductor. La preparación de este MKV
        // puede tardar; la interfaz indica el estado sin superponer otro player.
        if(typeof el.play==='function')Promise.resolve(el.play()).catch(()=>{});

      }catch(e){
        if(playId!==playRequest)return;
        window.noctraWatchState?.reportError?.(m,'PLAYBACK_START');
        const message=/Película no encontrada/i.test(e.message)
          ?'Este archivo no está publicado. Ve a Administrar → Publicar catálogo actual.'
          :e.message;
        hint.textContent='Error al iniciar el reproductor: '+message;
        $('frame-container').textContent=message;
        if(typeof toast==='function')toast(message);
      }
    },
    saveFavorite(m){m.saved=!m.saved;let x=[];try{x=JSON.parse(localStorage.getItem('noctra2.favorites')||'[]');}catch{}const s=new Set(x);m.saved?s.add(m.fileId):s.delete(m.fileId);localStorage.setItem('noctra2.favorites',JSON.stringify([...s]));if(typeof render==='function')render();},
    async logout(){try{await request('/api/logout',{method:'POST'});}catch{}clearSession();token='';location.reload();}
  };
  window.noctraCloud=cloudApi;
  function script(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(Error('No se pudo cargar '+src));document.body.append(s);});}
  // Profile image settings are browser-local until the API supports avatars.
  let avatarUrls=Object.create(null);
  function avatarFor(username){const url=avatarUrls[username]||'';return typeof url==='string'&&/^https:\/\//i.test(url)?url:'';}
  function setAvatar(username,url){avatarUrls[username]=url||'';}
  function avatarNode(username,large=false){
    const photo=document.createElement('span');photo.className='antoo-profile-avatar'+(large?' antoo-avatar-large':'');
    const url=avatarFor(username);
    if(url){const img=document.createElement('img');img.alt='Foto del perfil';img.src=url;img.referrerPolicy='no-referrer';img.onerror=()=>{photo.textContent=username.slice(0,1).toUpperCase();img.remove();};photo.append(img);}
    else photo.textContent=username.slice(0,1).toUpperCase();
    return photo;
  }
  const jokes=[
    'Porque cuando aparece, hasta el Wi-Fi se conecta solo.',
    'Porque mi corazón hace más ruido que una laptop jugando a 20 FPS.',
    'Porque ni Google sabe explicar este nivel de encule.',
    'Porque parece que salió de un cuento de ogros, pero del que yo soy fan.',
    'Porque me tiene más perdido que un control remoto entre los cojines.',
    'Porque si Paty fuera una película, la pondría en favoritos mil veces.'
  ];
  function openProfile(){
    if(!me)return;
    let modal=$('antoo-profile-dialog');
    if(!modal){modal=document.createElement('dialog');modal.id='antoo-profile-dialog';document.body.append(modal);}
    modal.replaceChildren();
    const close=document.createElement('button');close.type='button';close.className='close antoo-profile-close';close.textContent='×';close.setAttribute('aria-label','Cerrar perfil');close.onclick=()=>modal.close();
    const head=document.createElement('div');head.className='antoo-profile-head';head.append(avatarNode(me.username,true));
    const name=document.createElement('h2');name.textContent=me.username;head.append(name);
    const heading=document.createElement('h3');heading.textContent='RAZONES POR LAS QUE ESTOY ENCULADO DE PATY BURGOS';
    const list=document.createElement('ul');list.className='antoo-profile-jokes';jokes.forEach(j=>{const item=document.createElement('li');item.textContent=j;list.append(item);});
    modal.append(close,head,heading,list);modal.showModal();
  }
  function userbar(){const box=document.createElement('div');box.className='noctra-userbar';const name=document.createElement('button');name.type='button';name.className='antoo-profile-trigger';name.append(avatarNode(me.username),document.createTextNode(me.username));name.onclick=openProfile;box.append(name);if(me.role==='admin'){const b=document.createElement('button');b.textContent='Administrar';b.onclick=()=>openAdmin();box.append(b);}const exit=document.createElement('button');exit.textContent='Salir';exit.onclick=cloudApi.logout;box.append(exit);document.querySelector('.header-right').append(box);}
  async function activate(user){me=user;setAvatar(me.username,me.avatarUrl||'');form.reset();$('noctra-login').hidden=true;$('auth-loading').hidden=true;document.body.classList.remove('auth-locked');if(!loaded){await script('app.js?v=20261013-antoo-brand1');await script('drive.js?v=20261013-antoo-brand1');await script('watch-state.js?v=20261013-continue-watch1');await script('responsive.js?v=20261013-mobile-refresh34');loaded=true;userbar();
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
    try{await cloudApi.reloadCatalog();}
    catch(e){console.warn('ANTOO PELIS catalog read failed:',e);}
    await window.noctraWatchState?.syncFromServer?.();
    // Automatic TMDB processing starts on admin login; no per-title clicks.
    if(me.role==='admin')void window.noctraMetadataAdmin?.autoStart?.(cloudApi,request);
  }}
  async function init(){try{if(!validApi){msg('Configura primero Cloudflare: abre config.js y reemplaza TU-WORKER.');return;}const s=await request('/api/status');setup.hidden=!!s.ready;form.hidden=!s.ready;if(token&&s.ready){try{const v=await request('/api/me');await activate(v.user);}catch(e){if(/401|403|caduc|expir|inválid|invalid|autorizad|sesión/i.test(e.message)){clearSession();token='';msg('Tu sesión terminó. Inicia sesión de nuevo.');}else throw e;}}}catch(e){msg(e.message);if(me)catalogNotice('No se pudo completar el inicio del catálogo: '+e.message);}finally{document.body.classList.remove('auth-checking');$('auth-loading').hidden=true;if(document.body.classList.contains('auth-locked'))$('noctra-login').hidden=false;}}
  form.addEventListener('submit',async e=>{e.preventDefault();msg('');$('login-submit').disabled=true;try{const d=await request('/api/login',{method:'POST',body:{username:$('login-username').value.trim(),password:$('login-password').value}});saveSession(d.token,!!rememberInput?.checked);await activate(d.user);}catch(e){msg(e.message);}finally{$('login-submit').disabled=false;}});
  setup.addEventListener('submit',async e=>{e.preventDefault();msg('');$('setup-submit').disabled=true;try{await request('/api/setup',{method:'POST',body:{bootstrapSecret:$('setup-secret').value,username:$('setup-username').value.trim(),password:$('setup-password').value}});$('setup-secret').value='';$('setup-password').value='';setup.hidden=true;form.hidden=false;msg('Administrador creado. Inicia sesión.');}catch(e){msg(e.message);}finally{$('setup-submit').disabled=false;}});
  async function openAdmin(){
    if(me?.role!=='admin')return;
    let d=$('noctra-admin-dialog');if(!d){d=document.createElement('dialog');d.id='noctra-admin-dialog';d.innerHTML=`
      <div class="admin-shell-head">
        <div><p class="eyebrow purple">ANTOO PELIS · CENTRO DE CONTROL</p><h2>Administración</h2><p class="admin-shell-subtitle">Gestiona usuarios, catálogo y actividad desde un solo lugar.</p></div>
        <button class="close" type="button" aria-label="Cerrar">×</button>
      </div>
      <nav class="admin-nav" aria-label="Secciones de administración">
        <button type="button" data-admin-tab="overview" aria-pressed="true">Resumen</button>
        <button type="button" data-admin-tab="users" aria-pressed="false">Usuarios</button>
        <button type="button" data-admin-tab="catalog" aria-pressed="false">Catálogo</button>
        <button type="button" data-admin-tab="settings" aria-pressed="false">Ajustes</button>
      </nav>
      <section class="admin-panel" data-admin-panel="overview">
        <div class="admin-panel-heading"><div><h3>Actividad reciente</h3><p>Reproducciones, títulos populares y problemas técnicos de los últimos 30 días.</p></div><button class="secondary" id="refresh-activity" type="button">↻ Actualizar</button></div>
        <div id="admin-activity" aria-live="polite">Cargando actividad…</div>
      </section>
      <section class="admin-panel" data-admin-panel="users" hidden>
        <div class="admin-panel-heading"><div><h3>Cuentas de acceso</h3><p>Crea usuarios con nombre y contraseña, sin correo electrónico.</p></div></div>
        <div class="admin-user-create"><h4>Crear cuenta</h4><form id="new-user-form"><label>Nombre de usuario<input id="new-username" required minlength="3" maxlength="32" autocomplete="off" placeholder="Ejemplo: amigo1"></label><label>Contraseña temporal<input id="new-password" type="password" required minlength="12" autocomplete="new-password" placeholder="Mínimo 12 caracteres"></label><button class="primary" type="submit">＋ Crear usuario</button></form><p class="admin-error" id="admin-error" role="alert"></p></div>
        <div class="admin-user-list"><h4>Usuarios existentes</h4><div id="admin-users"></div></div>
      </section>
      <section class="admin-panel admin-catalog-panel" data-admin-panel="catalog" hidden>
        <div class="admin-panel-heading"><div><h3>Biblioteca y contenido</h3><p>Conecta Drive, revisa metadatos y publica el catálogo compartido.</p></div></div>
        <details class="admin-card" open><summary>Google Drive · conexión y sincronización</summary><p class="admin-note">Solo el administrador conecta y sincroniza las carpetas. Los invitados usan el catálogo publicado sin acceso a Drive.</p><div id="admin-drive-slot"></div></details>

        <details class="admin-card"><summary>Metadatos de películas y series</summary><p class="admin-note">Completa fichas, fondos y nombres de episodios. Si falta una película, búscala por nombre o pega su enlace de TMDB.</p><div id="admin-metadata-slot"></div></details>
        <details class="admin-card"><summary>Publicar o importar catálogo</summary><p class="admin-note">Se publican títulos y enlaces, no los videos. Solo las cuentas autorizadas pueden consultar el catálogo.</p><div class="button-row"><button class="secondary" id="publish-scan" type="button">Publicar catálogo actual</button><button class="secondary" id="refresh-cloud" type="button">Actualizar catálogo</button></div><label class="admin-import-label">Importar JSON del catálogo<input type="file" id="cloud-json" accept=".json,application/json"></label><p class="admin-note">Importar sustituye el catálogo compartido; confirma que el archivo sea el correcto.</p></details>
        <p class="admin-error" id="admin-catalog-error" role="alert"></p>
      </section>
      <section class="admin-panel" data-admin-panel="settings" hidden>
        <div class="admin-panel-heading"><div><h3>Ajustes de la página</h3><p>Herramientas generales disponibles para la cuenta administradora.</p></div></div>
        <div id="admin-settings-slot"></div>
      </section>`;document.body.append(d);setupAdminNav(d);d.querySelector('.close').onclick=()=>d.close();d.querySelector('#new-user-form').onsubmit=async e=>{e.preventDefault();const er=$('admin-error');er.textContent='';try{await request('/api/admin/users',{method:'POST',body:{username:$('new-username').value.trim(),password:$('new-password').value}});e.target.reset();er.textContent='Usuario creado.';await listUsers();}catch(ex){er.textContent=ex.message;}};d.querySelector('#publish-scan').onclick=async()=>{const er=$('admin-catalog-error');er.textContent='';const local=typeof movies!=='undefined'?movies:[];const scanned=window.noctraScanLibrary||[];const all=[...cloud,...local,...scanned];if(!all.length){er.textContent='Primero conecta Drive o importa un catálogo.';return;}if(!confirm('¿Publicar '+all.length+' entradas de catálogo compartido? Las cuentas podrán ver sus títulos.'))return;try{const r=await request('/api/admin/catalog',{method:'PUT',body:{movies:all}});await cloudApi.reloadCatalog();void window.noctraMetadataAdmin?.autoStart?.(cloudApi,request);er.textContent=r.count+' archivos publicados. ANTOO PELIS completará sus metadatos automáticamente.';}catch(ex){er.textContent=ex.message;}};d.querySelector('#refresh-cloud').onclick=()=>cloudApi.reloadCatalog().catch(e=>$('admin-catalog-error').textContent=e.message);d.querySelector('#cloud-json').onchange=async e=>{const er=$('admin-catalog-error');try{const f=e.target.files[0];if(!f)return;if(f.size>1000000)throw Error('El catálogo es demasiado grande.');const j=JSON.parse(await f.text());const a=Array.isArray(j)?j:j.movies;if(!Array.isArray(a))throw Error('JSON incorrecto.');if(!confirm('¿Sustituir el catálogo compartido por '+a.length+' películas?'))return;const r=await request('/api/admin/catalog',{method:'PUT',body:{movies:a}});await cloudApi.reloadCatalog();void window.noctraMetadataAdmin?.autoStart?.(cloudApi,request);er.textContent=r.count+' películas importadas. Se buscarán sus metadatos automáticamente.';}catch(ex){er.textContent=ex.message;}finally{e.target.value='';}};}
    window.noctraDriveAdmin?.mount(d.querySelector('#admin-drive-slot'));
    window.noctraMetadataAdmin?.mount(d.querySelector('#admin-metadata-slot'),cloudApi,request);
    const localSettings=$('settings-dialog')?.querySelector('.settings-section:first-of-type');
    const localSlot=d.querySelector('#admin-settings-slot');
    if(localSettings&&localSlot){localSlot.append(localSettings);localSettings.hidden=false;}
    d.showModal();await listUsers();d.querySelector('#refresh-activity').onclick=loadActivity;await loadActivity();}
  function setupAdminNav(d){
    const tabs=[...d.querySelectorAll('[data-admin-tab]')],panels=[...d.querySelectorAll('[data-admin-panel]')];
    for(const tab of tabs)tab.onclick=()=>{const key=tab.dataset.adminTab;for(const item of tabs)item.setAttribute('aria-pressed',String(item===tab));for(const panel of panels)panel.hidden=panel.dataset.adminPanel!==key;};
  }
  async function loadActivity(){
    const box=$('admin-activity');if(!box)return;box.textContent='Cargando actividad…';
    try{
      const data=await request('/api/admin/activity?days=30');
      const totals=Object.fromEntries((data.summary||[]).map(x=>[x.event_type,Number(x.total)||0]));
      const cards=document.createElement('div');cards.className='admin-activity-cards';
      for(const [label,value] of [['Títulos en catálogo',cloud.length],['Reproducciones',totals.play||0],['Finalizadas',totals.complete||0],['Errores',totals.error||0]]){const card=document.createElement('article');const n=document.createElement('strong');n.textContent=String(value);const t=document.createElement('span');t.textContent=label;card.append(n,t);cards.append(card);}
      const title=document.createElement('h4');title.textContent='Más vistos';const titles=document.createElement('ul');titles.className='admin-activity-list';
      for(const x of data.topTitles||[]){const li=document.createElement('li');li.textContent=x.title+' · '+x.plays+' reproducciones / '+x.viewers+' usuarios';titles.append(li);}
      if(!titles.children.length){const li=document.createElement('li');li.textContent='Aún no hay reproducciones registradas.';titles.append(li);}
      const usersTitle=document.createElement('h4');usersTitle.textContent='Actividad por usuario';const users=document.createElement('ul');users.className='admin-activity-list';
      for(const x of data.topUsers||[]){const li=document.createElement('li');li.textContent=x.username+' · '+x.plays+' reproducciones';users.append(li);}
      if(!users.children.length){const li=document.createElement('li');li.textContent='Aún no hay actividad de usuarios.';users.append(li);}
      const errorsTitle=document.createElement('h4');errorsTitle.textContent='Errores recientes';const errors=document.createElement('ul');errors.className='admin-activity-list';
      for(const x of data.recentErrors||[]){const li=document.createElement('li');const when=new Date(Number(x.createdAt)*1000).toLocaleString('es');li.textContent=when+' · '+x.username+' · '+x.title+' · '+x.errorCode;errors.append(li);}
      if(!errors.children.length){const li=document.createElement('li');li.textContent='No hay errores reportados en este periodo.';errors.append(li);}
      box.replaceChildren(cards,title,titles,usersTitle,users,errorsTitle,errors);
    }catch(e){box.textContent='No se pudo cargar la actividad: '+e.message;}
  }
  async function listUsers(){const box=$('admin-users');box.textContent='Cargando…';try{const data=await request('/api/admin/users');box.replaceChildren();for(const u of data.users){setAvatar(u.username,u.avatarUrl||'');const row=document.createElement('div');row.className='admin-row';const detail=document.createElement('div');const name=document.createElement('strong');name.textContent=u.username;const subtitle=document.createElement('small');subtitle.textContent=u.role==='admin'?'Administrador':u.disabled?'Desactivado':'Activo';detail.append(name,subtitle);row.append(detail);
    const avatarField=document.createElement('label');avatarField.className='antoo-avatar-editor';avatarField.textContent='Imagen de perfil (URL HTTPS)';
    const avatarInput=document.createElement('input');avatarInput.type='url';avatarInput.placeholder='https://ejemplo.com/foto.jpg';avatarInput.value=avatarFor(u.username);
    const saveAvatar=document.createElement('button');saveAvatar.type='button';saveAvatar.textContent='Guardar foto';saveAvatar.onclick=async()=>{const v=avatarInput.value.trim();if(v&&!/^https:\/\//i.test(v)){$('admin-error').textContent='La imagen debe usar una URL HTTPS.';return;}saveAvatar.disabled=true;try{await request('/api/admin/users/'+u.id,{method:'PATCH',body:{avatarUrl:v}});setAvatar(u.username,v);$('admin-error').textContent='Foto guardada en Cloudflare para todos los dispositivos.';if(me?.username===u.username){me.avatarUrl=v;document.querySelector('.antoo-profile-trigger')?.replaceChildren(avatarNode(u.username),document.createTextNode(u.username));}}catch(e){$('admin-error').textContent='No se pudo guardar la foto en Cloudflare: '+e.message;}finally{saveAvatar.disabled=false;}};
    avatarField.append(avatarInput,saveAvatar);row.append(avatarField);if(u.role!=='admin'){const actions=document.createElement('div');actions.className='admin-actions';const block=document.createElement('button');block.textContent=u.disabled?'Reactivar':'Desactivar';block.onclick=async()=>{try{await request('/api/admin/users/'+u.id,{method:'PATCH',body:{disabled:!u.disabled}});await listUsers();}catch(e){$('admin-error').textContent=e.message;}};const pass=document.createElement('button');pass.textContent='Cambiar contraseña';pass.onclick=async()=>{const p=prompt('Nueva contraseña para '+u.username+' (12 caracteres mínimo):');if(p===null)return;try{await request('/api/admin/users/'+u.id,{method:'PATCH',body:{password:p}});$('admin-error').textContent='Contraseña actualizada. Sesiones anteriores cerradas.';}catch(e){$('admin-error').textContent=e.message;}};actions.append(block,pass);row.append(actions);}box.append(row);}}catch(e){box.textContent=e.message;}}
  init();
})();
