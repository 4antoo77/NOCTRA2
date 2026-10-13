# Metadatos automáticos para todas las películas y series — NOCTRA2

## Funcionamiento

**No es necesario buscar película por película.** Al configurar TMDB, NOCTRA2 recorrerá el catálogo publicado e intentará completar automáticamente, de forma progresiva:

- Portada, sinopsis, género, año y título de película.
- Título visible, portada, sinopsis, género y año de series (sin modificar carpetas ni nombres de episodios).
- Puntuación y duración cuando TMDB disponga de esos datos.

El proceso se inicia al abrir NOCTRA2 como administrador y después de **Publicar catálogo**. El Worker también continúa procesando hasta **5 títulos únicos cada 5 minutos** mediante un cron, incluso con el navegador cerrado. Si hay muchos archivos, completarlos todos puede llevar tiempo.

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

1. Entra en NOCTRA2 con la cuenta administradora.
2. Abre **Administrar → Metadatos de películas y series**. Verás un resumen: completados, pendientes y por revisar.
3. Puedes marcar **Mostrar solo títulos que necesitan revisión** o buscar un título concreto en la lista.
4. Si hay una coincidencia incorrecta, pulsa **Buscar y elegir** para seleccionar la ficha correcta de TMDB, o edita manualmente.
5. Pulsa **Guardar ficha**. La elección se marca como manual y el procesamiento automático no la sobrescribe.
6. Si lo deseas, **Volver a buscar este título** libera la elección para reintentar el proceso.

Al sincronizar Google Drive o republicar el catálogo, se mantienen los metadatos ya aplicados y las elecciones manuales. Las películas siguen reproduciéndose mediante Movi Player, sin alterar el contenido de Drive.

## TMDB

Metadatos de [The Movie Database](https://www.themoviedb.org). This product uses the TMDB API but is not endorsed or certified by TMDB. Respeta las condiciones y requisitos de atribución de TMDB.
