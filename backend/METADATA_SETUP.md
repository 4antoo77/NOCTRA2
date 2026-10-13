# Metadatos automáticos para todas las películas y series — ANTOO PELIS

## Funcionamiento

**No es necesario buscar película por película.** Al configurar TMDB, ANTOO PELIS recorrerá el catálogo publicado e intentará completar automáticamente, de forma progresiva:

- Portada, sinopsis, género, año y título de película.
- Título visible, portada, sinopsis, género y año de series (sin modificar carpetas ni nombres de episodios).
- Puntuación y duración cuando TMDB disponga de esos datos.

El proceso se inicia al abrir ANTOO PELIS como administrador y después de **Publicar catálogo**. El Worker también continúa procesando hasta **5 títulos únicos cada 5 minutos** mediante un cron, incluso con el navegador cerrado. Si hay muchos archivos, completarlos todos puede llevar tiempo.

**Seguridad y coincidencias:** Se usan títulos limpiados de los nombres de archivo, el año (si está presente), los títulos originales y las coincidencias exactas. Si hay varias versiones posibles o no se encuentra una coincidencia segura, la ficha queda marcada como **Por revisar**. Nunca se asignan metadatos arbitrarios para completar el 100 %.

## Única configuración necesaria

1. Obtén el **API Read Access Token** de [TMDB](https://www.themoviedb.org/settings/api).
2. Ve al panel Cloudflare → Workers & Pages → **noctra2-api** → Settings → Variables and Secrets.
3. Crea un secreto, no una variable de texto ordinaria, con nombre exacto `TMDB_READ_ACCESS_TOKEN` y valor igual al token. No publiques ni compartas este valor.
4. **Despliega una vez el Worker actualizado del repositorio**, para que se activen los endpoints automáticos y el cron. Desde la carpeta `backend`:

```powershell
npm install
npx wrangler login
npx wrangler deploy
```

*Si ya habías desplegado el código actualizado, no necesitas repetir el despliegue al cambiar únicamente el secreto.*

No hay que ejecutar migraciones D1 separadas: el Worker crea automáticamente la tabla de seguimiento `metadata_match` al iniciar el proceso.

## Cómo revisar un resultado incorrecto o ausente

1. Entra en ANTOO PELIS con la cuenta administradora.
2. Abre **Administrar → Metadatos de películas y series**. Verás un resumen: completados, pendientes y por revisar.
3. Puedes marcar **Mostrar solo títulos que necesitan revisión** o buscar un título concreto en la lista.
4. Si hay una coincidencia incorrecta, pulsa **Buscar y elegir** para seleccionar la ficha correcta de TMDB, o edita manualmente.
5. Pulsa **Guardar ficha**. La elección se marca como manual y el procesamiento automático no la sobrescribe.
6. Si lo deseas, **Volver a buscar este título** libera la elección para reintentar el proceso.

Al sincronizar Google Drive o republicar el catálogo, se mantienen los metadatos ya aplicados y las elecciones manuales. Las películas siguen reproduciéndose mediante Movi Player, sin alterar el contenido de Drive.

## TMDB

Metadatos de [The Movie Database](https://www.themoviedb.org). This product uses the TMDB API but is not endorsed or certified by TMDB. Respeta las condiciones y requisitos de atribución de TMDB.

## Imágenes nítidas y episodios

La pantalla principal utiliza los fondos panorámicos de TMDB en tamaño original cuando están disponibles y selecciona imágenes de menor tamaño para móviles mediante `srcset`. Las imágenes verticales de las miniaturas del carrusel utilizan mayor resolución, pero **no se amplía una portada de 500 píxeles para llenar la pantalla**. Las películas sin imagen panorámica utilizan su portada como imagen vertical proporcionada, sin estirarla sobre toda la pantalla.

En las series, ANTOO PELIS detecta el número de temporada y capítulo a partir de formatos habituales como `S01E02`, `T1E2`, `1x02` y `Temporada 1 / Capítulo 2`. Cuando encuentra una ficha de la serie y un número de episodio válido, consulta TMDB para completar nombre, sinopsis y fotograma. Si TMDB no tiene la traducción española, intenta la información en inglés. Si no puede determinar el episodio de forma fiable, conserva el nombre del archivo. Un administrador puede abrir una serie y pulsar **Editar** junto a cualquier episodio publicado; el ajuste queda protegido ante futuras sincronizaciones.

## Cómo corregir un título ahora

Abre **Administrar → Metadatos** y selecciona el título por nombre. Introduce un nombre que TMDB reconozca (puede ser el original en inglés) o pega una URL de su ficha, por ejemplo `https://www.themoviedb.org/movie/603`. Pulsa **Buscar en TMDB**. Al pulsar un resultado, ANTOO PELIS guarda la selección directamente. Para cambios particulares, expande **Editar campos manualmente**.

La búsqueda manual combina nombres en español e inglés. El proceso automático y las opciones de revisión continúan disponibles.

**Después de actualizar el Worker en GitHub, es necesario publicarlo nuevamente** desde la carpeta `backend` con `npx wrangler deploy --keep-vars`. Así se conservan las variables y secretos configurados desde Cloudflare. Los cambios solo del sitio web se publican a través del hosting web habitual.
