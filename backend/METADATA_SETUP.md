# Metadatos TMDB en NOCTRA2

La edición **manual** de portadas, títulos, sinopsis, géneros y año funciona desde **Administrar → Metadatos** con la API de catálogo existente. No requiere migrar D1 ni editar archivos de Google Drive.

La búsqueda **automática** utiliza los endpoints `/api/admin/metadata/search` y `/api/admin/metadata/details` del Worker; solo las cuentas con rol administrador pueden consultarlos.

## Activar la búsqueda automática

1. Crea o abre tu cuenta de [TMDB](https://www.themoviedb.org/settings/api) y obtén el **API Read Access Token** (Bearer Token), no una contraseña de usuario.
2. Abre una terminal en la carpeta `backend` del repositorio y ejecuta:

   ```bash
   npm install
   npx wrangler login
   npx wrangler secret put TMDB_READ_ACCESS_TOKEN
   npx wrangler deploy
   ```

   El comando `secret put` pide el token de manera interactiva. **No pegues el token en GitHub, en código ni en mensajes.**

3. Inicia sesión como administrador en NOCTRA2, abre **Administrar → Metadatos**, selecciona una película o serie y pulsa **Autocompletar** (coincidencia exacta) o **Buscar y elegir** (resultados disponibles).
4. Revisa y pulsa **Guardar ficha**. Los cambios se publican para todos, sin mover ni modificar los videos de Drive.

**Importante:** Si no has desplegado el Worker actualizado o falta el secreto de TMDB, la búsqueda automática indicará que no está disponible. La edición manual continuará funcionando.

En NOCTRA2 se usan los siguientes datos persistentes del catálogo: título de película, sinopsis, portada, año y género. En series se conserva el título de cada episodio y se aplica portada/sinopsis/género/año a sus entradas.

Los datos e imágenes provienen de [The Movie Database (TMDB)](https://www.themoviedb.org). This product uses the TMDB API but is not endorsed or certified by TMDB. Consulta sus [normas de atribución](https://www.themoviedb.org/about/logos-attribution).
