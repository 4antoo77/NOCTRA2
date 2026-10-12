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
    if(activePlayer){try{activePlayer.pause();activePlayer.src=null;}catch{}activePlayer.remove();activePlayer=null;}
    document.getElementById('frame-container').replaceChildren();
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
    async reloadCatalog(){const d=await request('/api/catalog');let fav;try{fav=new Set(JSON.parse(localStorage.getItem('noctra2.favorites')||'[]'));}catch{fav=new Set();}cloud=(d.movies||[]).map(m=>({...m,saved:fav.has(m.fileId)}));if(typeof showLibrary==='function')showLibrary();else {window.serverMovies=[...cloud];if(typeof render==='function')render();}return cloud;},
    async play(m){
      const fileId=m.fileId || (typeof driveId==='function'?driveId(m.drive):null) ||
        (typeof m.id==='string'&&m.id.startsWith('gdrive-')?m.id.slice(7):null);
      if(!fileId){if(typeof toast==='function')toast('No se encontró el archivo de Google Drive.');return;}
      const playId=++playRequest;
      const dialog=$('player'),hint=dialog.querySelector('.hint');
      $('player-title').textContent=m.title;
      $('drive-open').href=m.drive || 'https://drive.google.com/file/d/'+encodeURIComponent(fileId)+'/view';
      $('quality').innerHTML='<option>Original · Movi Player</option>';
      $('quality').disabled=true;
      hint.textContent='Preparando Movi Player…';
      $('frame-container').textContent='Cargando reproductor…';
      if(!dialog.open)dialog.showModal();
      $('retry').onclick=()=>cloudApi.play(m);
      try {
        const signed=await request('/api/play/'+encodeURIComponent('gdrive-'+fileId),{method:'POST'});
        await loadMovi();
        if(playId!==playRequest)return;
        if(activePlayer){try{activePlayer.pause();}catch{}activePlayer.remove();activePlayer=null;}
        const el=document.createElement('movi-player');
        el.setAttribute('controls','');
        el.setAttribute('autoplay','');
        el.setAttribute('playsinline','');
        el.setAttribute('resume','');
        el.setAttribute('fastseek','');
        el.setAttribute('subtitlepicker','');
        el.setAttribute('fallback','native');
        el.setAttribute('theme','dark');
        // Conserva ajustes útiles sin restaurar compresión de volumen ni una pista distinta.
        el.setAttribute('persist','volume speed subtitlelang');
        el.setAttribute('persistkey','noctra2-cine');
        el.setAttribute('resumekey','noctra2-'+fileId);
        el.setAttribute('title',m.title||'NOCTRA2');
        el.style.cssText='display:block;width:100%;height:100%;min-height:230px;background:#000';
        el.addEventListener('loadedmetadata',()=>{
          // Audio original: sin compresor de volumen estable aplicado automáticamente.
          try{el.player?.setStableAudio?.(false);}catch{}
        });
        el.addEventListener('error',()=>{
          if(playId===playRequest)hint.textContent='Movi Player no pudo cargar este video. Comprueba que Cloudflare devuelve rangos de bytes (206) y que el formato sea compatible.';
        });
        activePlayer=el;
        $('frame-container').replaceChildren(el);
        el.src=signed.url;
        hint.textContent='Reproductor Movi · Archivo original de tu catálogo privado. Audio y subtítulos en los controles.';
        if(typeof el.play==='function')Promise.resolve(el.play()).catch(()=>{});
      } catch(e){
        if(playId!==playRequest)return;
        const message=/Película no encontrada/i.test(e.message)
          ? 'Este archivo todavía no está publicado. Usa Administrar → Publicar catálogo actual y vuelve a probar.'
          : e.message;
        hint.textContent='No se pudo cargar Movi Player: '+message;
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
  async function activate(user){me=user;form.reset();$('noctra-login').hidden=true;document.body.classList.remove('auth-locked');if(!loaded){await script('app.js');await script('drive.js');await script('responsive.js');loaded=true;userbar();if(me.role!=='admin'){
      document.querySelectorAll('.hero-actions .primary, .banner .primary, .empty .text-button, header .add-top').forEach(b=>{b.textContent='Ver películas';b.onclick=()=>{document.querySelector('#catalog').scrollIntoView({behavior:'smooth'});};});document.querySelector('.showcase')?.setAttribute('hidden','');
      const panel=document.querySelector('.drive-panel');if(panel)panel.hidden=true;
    }
    await cloudApi.reloadCatalog();}}
  async function init(){if(!validApi){msg('Configura primero Cloudflare: abre config.js y reemplaza TU-WORKER.');return;}try{const s=await request('/api/status');setup.hidden=!!s.ready;form.hidden=!s.ready;if(token && s.ready){const v=await request('/api/me');await activate(v.user);}}catch(e){msg(e.message);}}
  form.addEventListener('submit',async e=>{e.preventDefault();msg('');$('login-submit').disabled=true;try{const d=await request('/api/login',{method:'POST',body:{username:$('login-username').value.trim(),password:$('login-password').value}});token=d.token;sessionStorage.setItem('noctra2.token',token);await activate(d.user);}catch(e){msg(e.message);}finally{$('login-submit').disabled=false;}});
  setup.addEventListener('submit',async e=>{e.preventDefault();msg('');$('setup-submit').disabled=true;try{await request('/api/setup',{method:'POST',body:{bootstrapSecret:$('setup-secret').value,username:$('setup-username').value.trim(),password:$('setup-password').value}});$('setup-secret').value='';$('setup-password').value='';setup.hidden=true;form.hidden=false;msg('Administrador creado. Inicia sesión.');}catch(e){msg(e.message);}finally{$('setup-submit').disabled=false;}});
  async function openAdmin(){let d=$('noctra-admin-dialog');if(!d){d=document.createElement('dialog');d.id='noctra-admin-dialog';d.innerHTML=`<div class="dialog-top"><div><p class="eyebrow purple">NOCTRA2 · ADMINISTRACIÓN</p><h2>Usuarios y catálogo</h2></div><button class="close" type="button" aria-label="Cerrar">×</button></div><section><h3 class="admin-subtitle">Crear cuenta para un amigo</h3><form id="new-user-form"><label>Usuario (sin correo)<input id="new-username" required minlength="3" maxlength="32" autocomplete="off" placeholder="amigo1"></label><label>Contraseña (12 caracteres mínimo)<input id="new-password" type="password" required minlength="12" autocomplete="new-password"></label><button class="primary" type="submit">Crear usuario</button></form><p class="admin-error" id="admin-error" role="alert"></p></section><section><h3 class="admin-subtitle">Cuentas</h3><div id="admin-users"></div></section><section><h3 class="admin-subtitle">Películas para todos</h3><p class="admin-note">Conecta tu Drive como administrador, espera a que se analice la carpeta y pulsa «Publicar catálogo». Se guardan títulos y enlaces, NO videos. Solo usuarios autorizados pueden consultar estos datos.</p><div class="button-row"><button class="secondary" id="publish-scan" type="button">Publicar catálogo actual</button><button class="secondary" id="refresh-cloud" type="button">Actualizar catálogo</button></div><label>O importar el JSON exportado de NOCTRA<input type="file" id="cloud-json" accept=".json,application/json"></label><p class="admin-note">Importar sustituye el catálogo compartido. Revisa que todos los archivos sean tuyos y que sus permisos sean adecuados.</p></section><p class="admin-error" id="admin-catalog-error" role="alert"></p>`;document.body.append(d);d.querySelector('.close').onclick=()=>d.close();d.querySelector('#new-user-form').onsubmit=async e=>{e.preventDefault();const er=$('admin-error');er.textContent='';try{await request('/api/admin/users',{method:'POST',body:{username:$('new-username').value.trim(),password:$('new-password').value}});e.target.reset();er.textContent='Usuario creado.';await listUsers();}catch(ex){er.textContent=ex.message;}};d.querySelector('#publish-scan').onclick=async()=>{const er=$('admin-catalog-error');er.textContent='';const local=typeof movies!=='undefined'?movies:[];const scanned=window.noctraScanLibrary||[];const all=[...cloud,...local,...scanned];if(!all.length){er.textContent='Primero conecta Drive o importa un catálogo.';return;}if(!confirm('¿Publicar '+all.length+' entradas de catálogo compartido? Las cuentas podrán ver sus títulos.'))return;try{const r=await request('/api/admin/catalog',{method:'PUT',body:{movies:all}});await cloudApi.reloadCatalog();er.textContent=r.count+' archivos publicados.';}catch(ex){er.textContent=ex.message;}};d.querySelector('#refresh-cloud').onclick=()=>cloudApi.reloadCatalog().catch(e=>$('admin-catalog-error').textContent=e.message);d.querySelector('#cloud-json').onchange=async e=>{const er=$('admin-catalog-error');try{const f=e.target.files[0];if(!f)return;if(f.size>1000000)throw Error('El catálogo es demasiado grande.');const j=JSON.parse(await f.text());const a=Array.isArray(j)?j:j.movies;if(!Array.isArray(a))throw Error('JSON incorrecto.');if(!confirm('¿Sustituir el catálogo compartido por '+a.length+' películas?'))return;const r=await request('/api/admin/catalog',{method:'PUT',body:{movies:a}});await cloudApi.reloadCatalog();er.textContent=r.count+' películas importadas.';}catch(ex){er.textContent=ex.message;}finally{e.target.value='';}};}
    d.showModal();await listUsers();}
  async function listUsers(){const box=$('admin-users');box.textContent='Cargando…';try{const data=await request('/api/admin/users');box.replaceChildren();for(const u of data.users){const row=document.createElement('div');row.className='admin-row';const detail=document.createElement('div');const name=document.createElement('strong');name.textContent=u.username;const subtitle=document.createElement('small');subtitle.textContent=u.role==='admin'?'Administrador':u.disabled?'Desactivado':'Activo';detail.append(name,subtitle);row.append(detail);if(u.role!=='admin'){const actions=document.createElement('div');actions.className='admin-actions';const block=document.createElement('button');block.textContent=u.disabled?'Reactivar':'Desactivar';block.onclick=async()=>{try{await request('/api/admin/users/'+u.id,{method:'PATCH',body:{disabled:!u.disabled}});await listUsers();}catch(e){$('admin-error').textContent=e.message;}};const pass=document.createElement('button');pass.textContent='Cambiar contraseña';pass.onclick=async()=>{const p=prompt('Nueva contraseña para '+u.username+' (12 caracteres mínimo):');if(p===null)return;try{await request('/api/admin/users/'+u.id,{method:'PATCH',body:{password:p}});$('admin-error').textContent='Contraseña actualizada. Sesiones anteriores cerradas.';}catch(e){$('admin-error').textContent=e.message;}};actions.append(block,pass);row.append(actions);}box.append(row);}}catch(e){box.textContent=e.message;}}
  init();
})();