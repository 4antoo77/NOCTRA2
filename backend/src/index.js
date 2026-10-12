// NOCTRA2 API — Cloudflare Worker + D1. Configura BOOTSTRAP_SECRET (una sola vez)
// y STREAM_SIGNING_KEY como secretos; nunca publiques tokens de Google en GitHub.
const enc = new TextEncoder();
const dec = new TextDecoder();
const now = () => Math.floor(Date.now() / 1000);
const DAY = 86400;
const makeToken = () => { const a = crypto.getRandomValues(new Uint8Array(32)); return b64url(a); };
const b64url = data => btoa(String.fromCharCode(...data)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const hex = data => [...new Uint8Array(data)].map(x=>x.toString(16).padStart(2,'0')).join('');
const sha256 = async s => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
function passValid(p){return typeof p==='string' && p.length>=12 && p.length<=128;}
function userValid(u){return typeof u==='string' && /^[a-zA-Z][a-zA-Z0-9_-]{2,31}$/.test(u);}
async function hashPassword(password, salt){
  const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:100000,hash:'SHA-256'},key,256);
  return hex(bits);
}
async function createPassword(p){const salt=makeToken();return {salt,hash:await hashPassword(p,salt)};}
async function verifyPassword(p,u){
  const computed=await hashPassword(p,u?.salt||'unmatched-password-salt');
  const actual=u?.password_hash||'0'.repeat(64);
  let diff=0; for(let i=0;i<64;i++)diff |= computed.charCodeAt(i) ^ actual.charCodeAt(i);
  return diff===0 && !!u;
}
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const fail=(s,code=400)=>json({error:s},code);
async function input(req){ const l=Number(req.headers.get('content-length')||0);if(l>1e6)throw Error('Solicitud demasiado grande');const s=await req.text();if(s.length>1e6)throw Error('Solicitud demasiado grande');return JSON.parse(s||'{}'); }
async function getUser(req,db){const header=req.headers.get('Authorization')||'';const token=header.startsWith('Bearer ')?header.slice(7):'';if(!/^[A-Za-z0-9_-]{40,50}$/.test(token))return null;const tokenHash=await sha256(token);return db.prepare('SELECT u.id,u.username,u.role,u.disabled,s.token_hash,s.expires_at FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token_hash = ? AND s.expires_at > ? AND u.disabled=0').bind(tokenHash,now()).first();}
const publicUser=u=>({id:u.id,username:u.username,role:u.role});
function checkOrigin(req,env){const o=req.headers.get('Origin');return !o || o===env.PAGES_ORIGIN;}
function cors(req,env,headers={}){const origin=req.headers.get('Origin');if(origin && origin===env.PAGES_ORIGIN){headers['Access-Control-Allow-Origin']=origin;headers['Vary']='Origin';headers['Access-Control-Allow-Methods']='GET,POST,PUT,PATCH,OPTIONS';headers['Access-Control-Allow-Headers']='Content-Type, Authorization';headers['Access-Control-Max-Age']='600';}return headers;}
async function limiter(db,key){const t=now();const x=await db.prepare('SELECT failures,window_start FROM attempts WHERE attempt_key=?').bind(key).first();if(x&&x.failures>=6 && t-x.window_start<900)return false;if(x && t-x.window_start>=900)await db.prepare('DELETE FROM attempts WHERE attempt_key=?').bind(key).run();return true;}
async function penalize(db,key){const t=now();await db.prepare('INSERT INTO attempts(attempt_key,failures,window_start) VALUES(?,1,?) ON CONFLICT(attempt_key) DO UPDATE SET failures=CASE WHEN ?-window_start>900 THEN 1 ELSE failures+1 END,window_start=CASE WHEN ?-window_start>900 THEN ? ELSE window_start END').bind(key,t,t,t,t).run();}
async function login(db,req){const {username,password}=await input(req);if(!userValid(username)||!passValid(password))return fail('Credenciales incorrectas',401);const key=await sha256((req.headers.get('CF-Connecting-IP')||'unknown')+':'+username.toLowerCase());if(!await limiter(db,key))return fail('Demasiados intentos. Vuelve a intentarlo en 15 minutos.',429);const u=await db.prepare('SELECT * FROM users WHERE username=?').bind(username).first();if(!await verifyPassword(password,u) || u.disabled){await penalize(db,key);return fail('Credenciales incorrectas',401);}await db.prepare('DELETE FROM attempts WHERE attempt_key=?').bind(key).run();const token=makeToken(), th=await sha256(token), exp=now()+12*3600;await db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(th,u.id,exp).run();return json({token,user:publicUser(u),expiresAt:exp});}
async function setup(db,req,env){const exists=await db.prepare("SELECT 1 FROM users WHERE role='admin' LIMIT 1").first();if(exists)return fail('El administrador ya está configurado.',409);const v=await input(req);if(!env.BOOTSTRAP_SECRET || v.bootstrapSecret!==env.BOOTSTRAP_SECRET)return fail('Código de inicialización incorrecto.',403);if(!userValid(v.username)||!passValid(v.password))return fail('Usuario de 3–32 caracteres y contraseña de al menos 12.',400);const p=await createPassword(v.password);await db.prepare("INSERT INTO users(username,password_hash,salt,role,created_at) VALUES(?,?,?,'admin',?)").bind(v.username,p.hash,p.salt,now()).run();return json({ok:true,message:'Administrador creado. Inicia sesión.'},201);}
async function users(db){const r=await db.prepare('SELECT id,username,role,disabled,created_at FROM users ORDER BY id').all();return json({users:r.results||[]});}
async function createUser(db,req){const v=await input(req);if(!userValid(v.username)||!passValid(v.password))return fail('Usuario inválido o contraseña de menos de 12 caracteres.',400);const p=await createPassword(v.password);try{const r=await db.prepare("INSERT INTO users(username,password_hash,salt,role,created_at) VALUES(?,?,?,'viewer',?)").bind(v.username,p.hash,p.salt,now()).run();return json({id:r.meta.last_row_id,username:v.username},201);}catch(e){return fail('El usuario ya existe o no se pudo crear.',409);}}
async function updateUser(db,req,me,id){const v=await input(req);const u=await db.prepare('SELECT * FROM users WHERE id=?').bind(id).first();if(!u)return fail('Usuario inexistente.',404);if(u.role==='admin' && v.disabled===true)return fail('No se puede desactivar el administrador.',403);if(typeof v.disabled==='boolean'){
  await db.prepare('UPDATE users SET disabled=? WHERE id=?').bind(v.disabled?1:0,id).run();if(v.disabled)await db.prepare('DELETE FROM sessions WHERE user_id=?').bind(id).run();
}
if(v.password!==undefined){if(!passValid(v.password))return fail('La contraseña debe tener 12 caracteres como mínimo.',400);const p=await createPassword(v.password);await db.prepare('UPDATE users SET password_hash=?,salt=? WHERE id=?').bind(p.hash,p.salt,id).run();await db.prepare('DELETE FROM sessions WHERE user_id=?').bind(id).run();}return json({ok:true});}
const itemId=(u)=>{const m=/\/file\/d\/([A-Za-z0-9_-]{10,})/.exec(u);const o=/[?&]id=([A-Za-z0-9_-]{10,})/.exec(u);return m?.[1]||o?.[1]||'';};
function validateMovie(x){if(!x ||typeof x.title!=='string'||x.title.length<1||x.title.length>150)return null;const f=x.fileId||x.file_id||itemId(x.drive||'');if(!/^[a-zA-Z0-9_-]{10,150}$/.test(f))return null;const obj={id:'gdrive-'+f,title:x.title.trim(),genre:String(x.genre||'Otros').slice(0,50),year:String(x.year||'').slice(0,8),description:String(x.description||'').slice(0,750),poster:String(x.poster||'').slice(0,1000),fileId:f,seriesName:String(x.seriesName||x.series_name||'').slice(0,180),path:String(x.path||'').slice(0,500),height:Number(x.height)||0,size:Number(x.size)||0};if(obj.poster&&!/^https:\/\//i.test(obj.poster))obj.poster='';return obj;}
const metadataKey=m=>m.seriesName?'tv:'+m.seriesName.toLocaleLowerCase('es').trim():'movie:'+m.fileId;
async function metadataTable(db){
  // Created automatically on first admin metadata request; no manual migration.
  await db.prepare("CREATE TABLE IF NOT EXISTS metadata_match (item_key TEXT PRIMARY KEY, status TEXT NOT NULL, tmdb_id INTEGER, payload_json TEXT NOT NULL DEFAULT '{}', checked_at INTEGER NOT NULL)").run();
}
async function metadataRows(db){
  try{return (await db.prepare('SELECT item_key,status,tmdb_id,payload_json,checked_at FROM metadata_match').all()).results||[];}catch{return [];}
}
async function getCatalog(db){
  const [r,metadata]=await Promise.all([
    db.prepare('SELECT id,title,genre,year,description,poster,file_id AS fileId,series_name AS seriesName,path,height,size FROM catalog ORDER BY updated_at DESC').all(),
    metadataRows(db)
  ]);
  const statuses=new Map(metadata.map(x=>[x.item_key,x]));
  return json({movies:(r.results||[]).map(m=>{
    const meta=statuses.get(metadataKey(m));let extra={};
    if(meta){try{const payload=JSON.parse(meta.payload_json);extra={rating:payload.rating||0,duration:payload.duration||0,tmdbId:meta.tmdb_id||null,metadataStatus:meta.status};}catch{}}
    return {...m,drive:'https://drive.google.com/file/d/'+m.fileId+'/view',variants:[],added:0,connected:true,cloud:true,...extra};
  })});
}
async function saveCatalog(db,req){
  const v=await input(req),list=Array.isArray(v)?v:v.movies;
  if(!Array.isArray(list)||list.length>1000)return fail('Se admite un máximo de 1000 películas y episodios.',400);
  const objs=list.map(validateMovie);if(objs.some(x=>!x))return fail('Hay archivos o enlaces de Drive inválidos.',400);
  const distinct=[],seen=new Set();
  for(const m of objs){if(!seen.has(m.id)){seen.add(m.id);distinct.push(m);}}
  // Re-synchronizing Drive must NEVER erase TMDB matches or manual corrections.
  const previous=(await db.prepare('SELECT id,title,genre,year,description,poster,file_id AS fileId,series_name AS seriesName,path,height,size FROM catalog').all()).results||[];
  const existing=new Map(previous.map(m=>[m.id,m]));
  const matches=new Map((await metadataRows(db)).filter(x=>x.status==='auto'||x.status==='manual').map(x=>[x.item_key,x]));
  const merged=distinct.map(m=>{
    const match=matches.get(metadataKey(m)),old=existing.get(m.id);
    if(!match)return m;
    let payload={};try{payload=JSON.parse(match.payload_json||'{}');}catch{}
    return {...m,
      title:m.seriesName?m.title:(payload.title||old?.title||m.title),
      genre:payload.genre||old?.genre||m.genre,
      year:payload.year||old?.year||m.year,
      description:payload.description||old?.description||m.description,
      poster:payload.poster||old?.poster||m.poster
    };
  });
  const stmts=[db.prepare('DELETE FROM catalog')];
  for(const m of merged)stmts.push(db.prepare('INSERT INTO catalog(id,title,genre,year,description,poster,file_id,series_name,path,height,size,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(m.id,m.title,m.genre,m.year,m.description,m.poster,m.fileId,m.seriesName,m.path,m.height,m.size,now()));
  await db.batch(stmts);
  return json({ok:true,count:merged.length});
}
// TMDB metadata lookup: admin-only, token stays in Worker secrets.
const TMDB_IMAGE='https://image.tmdb.org/t/p/w500';
const TMDB_GENRES={'Action':'Acción','Adventure':'Acción','Animation':'Animación','Comedy':'Comedia','Crime':'Suspenso','Documentary':'Documental','Drama':'Drama','Family':'Animación','Fantasy':'Ciencia ficción','History':'Drama','Horror':'Terror','Music':'Otros','Mystery':'Suspenso','Romance':'Drama','Science Fiction':'Ciencia ficción','Sci-Fi & Fantasy':'Ciencia ficción','Thriller':'Suspenso','War':'Acción','Western':'Acción','Kids':'Animación'};
// TMDB returns localized genre labels when language=es-ES.
Object.assign(TMDB_GENRES,{
 'Acción':'Acción','Aventura':'Acción','Animación':'Animación',
 'Comedia':'Comedia','Crimen':'Suspenso','Documental':'Documental',
 'Drama':'Drama','Familia':'Animación','Fantasía':'Ciencia ficción',
 'Historia':'Drama','Terror':'Terror','Música':'Otros',
 'Misterio':'Suspenso','Romance':'Drama','Ciencia ficción':'Ciencia ficción',
 'Suspense':'Suspenso','Thriller':'Suspenso','Bélica':'Acción',
 'Western':'Acción','Kids':'Animación','Sci-Fi & Fantasy':'Ciencia ficción'
});
const safeTmdbImage=p=>typeof p==='string'&&/^\/[A-Za-z0-9_.-]{4,250}$/.test(p)?TMDB_IMAGE+p:'';
async function tmdbGet(env,endpoint,params={}){
  const apiToken=env.TMDB_READ_ACCESS_TOKEN;
  if(!apiToken)return fail('Configura TMDB_READ_ACCESS_TOKEN como secreto del Worker para usar la búsqueda automática.',503);
  const url=new URL('https://api.themoviedb.org/3/'+endpoint);
  url.searchParams.set('language','es-ES');
  for(const [k,v] of Object.entries(params))url.searchParams.set(k,String(v));
  let response;try{response=await fetch(url.toString(),{headers:{Authorization:'Bearer '+apiToken,Accept:'application/json'},signal:AbortSignal.timeout(9000)});}catch{return fail('No se pudo conectar con TMDB.',502);}
  if(!response.ok)return fail('TMDB no respondió correctamente ('+response.status+').',502);
  return response.json();
}
async function searchMetadata(req,env){
  const url=new URL(req.url),query=(url.searchParams.get('q')||'').trim(),type=url.searchParams.get('type')==='tv'?'tv':'movie';
  if(query.length<2||query.length>120)return fail('Escribe un título de entre 2 y 120 caracteres.',400);
  const r=await tmdbGet(env,'search/'+type,{query,include_adult:'false',page:1});
  if(r instanceof Response)return r;
  return json({results:(r.results||[]).filter(x=>!x.adult).slice(0,12).map(x=>({
     id:x.id,title:(type==='tv'?x.name:x.title)||'',
     year:((type==='tv'?x.first_air_date:x.release_date)||'').slice(0,4),
     description:x.overview||'',poster:safeTmdbImage(x.poster_path),
     rating:Math.round(Number(x.vote_average||0)*10)/10,type
  }))});
}
async function metadataDetails(req,env){
  const url=new URL(req.url),type=url.searchParams.get('type')==='tv'?'tv':'movie';
  const id=Number(url.searchParams.get('id'));
  if(!Number.isSafeInteger(id)||id<=0)return fail('ID de TMDB inválido.',400);
  const r=await tmdbGet(env,type+'/'+id);
  if(r instanceof Response)return r;
  return json({metadata:{
    title:(type==='tv'?r.name:r.title)||'',year:((type==='tv'?r.first_air_date:r.release_date)||'').slice(0,4),
    description:String(r.overview||'').slice(0,750),poster:safeTmdbImage(r.poster_path),
    genre:TMDB_GENRES[r.genres?.[0]?.name]||'Otros',
    duration:Number(type==='tv'?r.episode_run_time?.[0]:r.runtime)||0,
    rating:Math.round(Number(r.vote_average||0)*10)/10,
    tmdbId:r.id,type
  }});
}
async function hmac(env,s){const k=await crypto.subtle.importKey('raw',enc.encode(env.STREAM_SIGNING_KEY),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);return b64url(new Uint8Array(await crypto.subtle.sign('HMAC',k,enc.encode(s))));}
async function signStream(db,env,id,url){if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET||!env.GOOGLE_REFRESH_TOKEN||!env.STREAM_SIGNING_KEY)return fail('El administrador aún no ha configurado la reproducción privada.',503);const m=await db.prepare('SELECT id FROM catalog WHERE id=?').bind(id).first();if(!m)return fail('Película no encontrada',404);const expires=now()+4*3600;const signature=await hmac(env,`${id}:${expires}`);return json({url:`${url.origin}/api/media/${encodeURIComponent(id)}?expires=${expires}&signature=${signature}`,expiresAt:expires});}
async function playMedia(req,env,db,id,url){if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET||!env.GOOGLE_REFRESH_TOKEN||!env.STREAM_SIGNING_KEY)return fail('Servidor de reproducción no configurado.',503);const exp=Number(url.searchParams.get('expires'));const sig=url.searchParams.get('signature')||'';if(!Number.isInteger(exp)||exp<now()||exp>now()+4*3600||sig.length<40)return fail('Enlace de reproducción no válido o caducado.',403);const expected=await hmac(env,`${id}:${exp}`);let diff=expected.length^sig.length;for(let i=0;i<Math.max(expected.length,sig.length);i++)diff|=(expected.charCodeAt(i)||0)^(sig.charCodeAt(i)||0);if(diff)return fail('Firma inválida.',403);const m=await db.prepare('SELECT file_id FROM catalog WHERE id=?').bind(id).first();if(!m)return fail('Película inexistente.',404);const body=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,refresh_token:env.GOOGLE_REFRESH_TOKEN,grant_type:'refresh_token'});const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});if(!r.ok)return fail('No se pudo renovar el acceso privado a Google Drive.',502);const t=await r.json();if(!t.access_token)return fail('Google no autorizó el acceso.',502);const mediaUrl=`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(m.file_id)}?alt=media`;const gh=new Headers({Authorization:'Bearer '+t.access_token});const range=req.headers.get('Range');if(range)gh.set('Range',range);const upstream=await fetch(mediaUrl,{headers:gh,method:req.method});if(!upstream.ok && upstream.status!==206)return fail(`Google Drive no pudo enviar este archivo (${upstream.status}).`,upstream.status===403?403:502);const outgoing=new Headers({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Access-Control-Allow-Origin':env.PAGES_ORIGIN});for(const h of ['content-length','content-range','content-type','accept-ranges','etag']){const v=upstream.headers.get(h);if(v)outgoing.set(h,v);}outgoing.set('Content-Disposition','inline');return new Response(req.method==='HEAD'?null:upstream.body,{status:upstream.status,headers:outgoing});}
export default {async fetch(request,env){
  const url=new URL(request.url), path=url.pathname;
  if(request.method==='OPTIONS'){if(!checkOrigin(request,env))return fail('Origen no autorizado',403);return new Response(null,{status:204,headers:cors(request,env)});}
  if(!checkOrigin(request,env))return fail('Origen no autorizado',403);
  if(!env.DB)return fail('Base de datos sin configurar.',503);
  try {
    let response;
    if(path==='/api/status' && request.method==='GET'){const a=await env.DB.prepare("SELECT 1 FROM users WHERE role='admin'").first();response=json({ready:!!a,streamingReady:!!(env.GOOGLE_REFRESH_TOKEN&&env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET&&env.STREAM_SIGNING_KEY)});}
    else if(path==='/api/setup' && request.method==='POST')response=await setup(env.DB,request,env);
    else if(path==='/api/login' && request.method==='POST')response=await login(env.DB,request);
    else if(path.startsWith('/api/media/') && ['GET','HEAD'].includes(request.method))response=await playMedia(request,env,env.DB,decodeURIComponent(path.slice('/api/media/'.length)),url);
    else {
      const me=await getUser(request,env.DB);
      if(!me)response=fail('Inicia sesión.',401);
      else if(path==='/api/me' && request.method==='GET')response=json({user:publicUser(me)});
      else if(path==='/api/logout' && request.method==='POST'){await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(me.token_hash).run();response=json({ok:true});}
      else if(path==='/api/catalog' && request.method==='GET')response=await getCatalog(env.DB);
      else if(path.startsWith('/api/play/') && request.method==='POST')response=await signStream(env.DB,env,decodeURIComponent(path.slice('/api/play/'.length)),url);
      else if(me.role!=='admin')response=fail('Solo para el administrador.',403);
      else if(path==='/api/admin/metadata/search' && request.method==='GET')response=await searchMetadata(request,env);
      else if(path==='/api/admin/metadata/details' && request.method==='GET')response=await metadataDetails(request,env);
      else if(path==='/api/admin/users' && request.method==='GET')response=await users(env.DB);
      else if(path==='/api/admin/users' && request.method==='POST')response=await createUser(env.DB,request);
      else if(/^\/api\/admin\/users\/\d+$/.test(path)&&request.method==='PATCH')response=await updateUser(env.DB,request,me,Number(path.split('/').pop()));
      else if(path==='/api/admin/catalog' && request.method==='PUT')response=await saveCatalog(env.DB,request);
      else response=fail('Ruta no encontrada',404);
    }
    const headers=new Headers(response.headers);for(const [k,v] of Object.entries(cors(request,env)))headers.set(k,v);
    return new Response(response.body,{status:response.status,headers});
  } catch(e) { console.error('NOCTRA2 request error at '+path+':',e); return json({error:'No se pudo completar la solicitud.'},500,cors(request,env)); }
}};