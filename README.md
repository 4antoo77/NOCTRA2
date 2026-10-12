# NOCTRA2 — GitHub Pages + cuentas privadas

Proyecto listo para configurar y publicar (NO publicado todavía).

**¿Qué hace?**
- GitHub Pages aloja el diseño de NOCTRA2 para teléfono, tableta y PC.
- Cloudflare Worker valida el usuario y la contraseña, sin correos para tus amigos.
- D1 guarda usuarios y catálogo compartido. Las contraseñas se derivan con PBKDF2 con sal, y las sesiones se comprueban del lado del servidor.
- El administrador puede crear usuarios, desactivarlos, cambiar contraseñas y publicar un catálogo compartido.
- Para reproducir archivos PRIVADOS de Google Drive sin que cada amigo use Google, debes CONFIGURAR credenciales de Google en el Worker. No se entregan en el ZIP y no deben publicarse.

**Lo que NO hace todavía:** no se ha desplegado en tus cuentas; no hay usuario ni contraseña predeterminados; no transmite películas sin configurar Google; no garantiza 10 reproducciones simultáneas; no convierte MKV a MP4 ni transforma calidades; no protege el código público de GitHub Pages, solo el catálogo, las sesiones y el servidor de video. Los enlaces temporales de reproducción se pueden compartir hasta su caducidad (4 h), como en muchos reproductores.

## 1 — Crear GitHub Pages (gratis)

1. Crea un repositorio **público** llamado `NOCTRA2` en https://github.com/new .
2. Abre la carpeta `site` del ZIP y sube **el contenido** (no la carpeta externa `NOCTRA2_GitHub`) a la raíz del repositorio. Asegúrate de que `index.html`, `app.js`, `drive.js`, `auth.js`, `style.css`, `responsive.css`, `auth.css`, `config.js` y `assets/` queden en la raíz.
3. En GitHub → `Settings` → `Pages` → `Build and deployment` → `Deploy from a branch` → rama `main`, carpeta `/ (root)` → `Save`.
4. Tu dirección será `https://TUUSUARIO.github.io/NOCTRA2/`. **Al principio mostrará un aviso de configuración**; es normal.

## 2 — Configurar el Worker de autenticación y D1 (Cloudflare gratis con límites)

Necesitas Node.js (https://nodejs.org), una cuenta de Cloudflare (https://dash.cloudflare.com) y una terminal PowerShell en la carpeta `backend`. No publiques la carpeta `backend` en la raíz de GitHub Pages; puedes conservarla en tu computadora o en una rama/repositorio privado. El código del backend no contiene secretos.

En PowerShell, desde la carpeta `backend`:

```powershell
npm install
npx wrangler login
npx wrangler d1 create noctra2-db
```

El último comando mostrará un `database_id` UUID. Abre `backend/wrangler.toml` y sustituye:
- `REEMPLAZAR_UUID_D1` por el UUID que te dio Cloudflare.
- `https://CAMBIA-TU-USUARIO.github.io` por el **origen real** de GitHub Pages, por ejemplo `https://ana.github.io` **sin** `/NOCTRA2` y sin barra final.

Luego en PowerShell:

```powershell
npx wrangler d1 migrations apply noctra2-db --remote
npx wrangler secret put BOOTSTRAP_SECRET
npx wrangler secret put STREAM_SIGNING_KEY
npx wrangler deploy
```

Para `BOOTSTRAP_SECRET`, escribe o pega una clave aleatoria larga (mínimo 24 caracteres); el comando la guardará en Cloudflare sin publicarla. La usarás **una sola vez** en la pantalla de inicialización. Para `STREAM_SIGNING_KEY`, utiliza **otra** clave aleatoria distinta (mínimo 32 caracteres). No compartas ninguna clave aquí ni en GitHub. El comando `deploy` imprimirá una URL tipo `https://noctra2-api.usuario.workers.dev`.

**Nota:** las versiones gratuitas de Workers y D1 tienen límites diarios; si se agotan, puede dejar de funcionar el servicio hasta que se reinicien.

## 3 — Unir GitHub Pages con Cloudflare

Abre el archivo `site/config.js` y reemplaza el URL de prueba `https://TU-WORKER.workers.dev` por la URL **exacta** de tu Worker, sin barra final. Sube el cambio al repositorio de GitHub; GitHub Pages lo publicará.

Abre NOCTRA2. Si es la primera vez, aparece el formulario **Crear administrador**: escribe el código de inicialización que guardaste en Cloudflare, el usuario administrador (ej. `administrador`) y una contraseña de al menos 12 caracteres. A partir de ahí, inicia sesión.

## 4 — Crear las cuentas de tus amigos

Desde NOCTRA2, entra con el administrador y presiona **Administrar**.
- En «Crear cuenta» introduce `amigo1`, una contraseña segura y pulsa `Crear usuario`.
- Repite con tus otros amigos.
- Puedes desactivar o cambiar las contraseñas sin añadir correos.
- Para publicar películas, conecta **tu** Drive como administrador (la ventana «Configurar» requiere el **ID de cliente OAuth web** de Google, no una contraseña), espera a la exploración y pulsa **Publicar catálogo actual**, o importa el JSON exportado de NOCTRA.

Los amigos verán el **mismo catálogo** al ingresar. El catálogo contiene títulos, metadatos y enlaces de Google Drive, NO archivos de video. Nunca publiques el JSON de ese catálogo ni tokens privados en un repositorio público.

## 5 — Reproducción privada desde Google Drive (configuración adicional)

**Este paso es obligatorio para que tus amigos vean películas de Drive privadas sin conectarse a Google**. El backend incluye `/api/play` y un proxy `/api/media` que puede enviar **archivos originales** a través de una cuenta Google autorizada, sin entregar la credencial al navegador. Se debe usar solo con contenidos para los que tengas derechos/permisos de compartir.

Para activarlo, necesitas un cliente OAuth de Google con acceso válido de lectura (`drive.readonly`) al Drive que contiene tus archivos y un *refresh token* emitido para ese cliente y esa cuenta. Mantén secretos, autoriza en Google Cloud el uso del API de Drive y cumple las políticas de consentimiento OAuth (incluida verificación si aplica). En el directorio `backend`, introduce los secretos **en Cloudflare**, no en `config.js` ni GitHub:

```powershell
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put GOOGLE_REFRESH_TOKEN
npx wrangler deploy
```

**Nunca pegues esos valores en ChatGPT ni los envíes a tus amigos.** Un refresh token configurado incorrectamente, revocado o caducado hará fallar el streaming. El servidor devuelve un enlace temporal de cuatro horas para cada película. Es un enlace reutilizable durante ese tiempo, por lo que NO ofrece protección anticopia ni DRM. Se pueden activar restricciones adicionales en versiones posteriores.

Google Drive puede imponer límites de uso y solicitudes. La reproducción de archivos `MKV`, `AVI` y ciertos códecs depende del navegador; el proxy no los transcodifica. Para mayor compatibilidad, usa archivos propios en **MP4 H.264 + AAC**. No se promete capacidad para diez conexiones simultáneas.

## 6 — Problemas habituales

- «Falta configurar Cloudflare»: `site/config.js` todavía tiene `TU-WORKER`.
- «Origen no autorizado» / CORS: `PAGES_ORIGIN` en `wrangler.toml` no coincide con el dominio `https://TUUSUARIO.github.io`. Cambia y vuelve a desplegar.
- «Base de datos sin configurar»: confirma `database_id` y la migración de D1.
- «Reproducción privada no configurada»: faltan los tres secretos OAuth de Google.
- «403» al reproducir: la cuenta Google del Worker no tiene acceso, está revocada o alcanzó un límite.
- «Sin películas»: entra con administrador, conecta tu carpeta de Drive o importa un JSON, y publica el catálogo.
- Si cambias la URL de GitHub Pages, revisa `PAGES_ORIGIN`, `config.js` y el origen permitido para OAuth de Google.

## Seguridad real y límites

- GitHub Pages es un servidor de **archivos públicos**. Cualquier persona puede descargar `index.html` y JavaScript. El contenido privado debe validarse en el Worker; no pongas secretos ni el catálogo en GitHub.
- Los usuarios se autentican ante Cloudflare Worker, por HTTPS. Solo una sesión válida puede obtener el catálogo y solicitar enlaces de reproducción temporales.
- No subas credenciales, contraseñas, IDs de recuperación o secretos a GitHub, ni copies enlaces temporales de video a sitios públicos.
- GitHub advierte que Pages no está diseñado para realizar transacciones sensibles. Para un lanzamiento más robusto, aloja la **pantalla de inicio de sesión** bajo el mismo dominio que tu API en Cloudflare, de forma que las contraseñas no se introduzcan en una página estática pública. La API de este proyecto sí procesa las credenciales en Cloudflare y nunca en GitHub.

Archivos importantes:
- `site/`: interfaz NOCTRA2 para GitHub Pages.
- `backend/src/index.js`: API de usuarios, catálogo y streaming.
- `backend/migrations/0001_init.sql`: tablas D1.
- `backend/wrangler.toml`: variables públicas y configuración de D1 (los secretos se gestionan con `wrangler secret put`).