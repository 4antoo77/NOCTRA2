/* ANTOO PELIS | Traducción española para la interfaz de libmedia AVPlayerUI.
 * La API del motor MKV no se modifica: solo se actualiza la interfaz Yox.
 */
(()=>{
 'use strict';
 const ES=Object.freeze({
  TIP_PLAY:'Reproducir',
  TIP_PAUSE:'Pausar',
  TIP_SETTING:'Configuración',
  TIP_FULLSCREEN:'Pantalla completa',
  TIP_LOOP_START:'Activar repetición',
  TIP_LOOP_STOP:'Desactivar repetición',
  TIP_PIP:'Imagen en imagen',
  TIP_PIP_START:'Activar imagen en imagen',
  TIP_PIP_STOP:'Desactivar imagen en imagen',
  TIP_FOLD:'Contraer',
  TIP_UNFOLD:'Expandir',
  TIP_DELETE:'Eliminar',
  CONTROL_PLAYRATE:'Velocidad',
  CONTROL_AUDIO_TRACK:'Audio',
  CONTROL_VIDEO_TRACK:'Video',
  CONTROL_SUBTITLE_TRACK:'Subtítulos',
  CONTROL_SUBTITLE_TRACK_ADD:'Añadir subtítulos',
  FOLDER_OPEN_DIR:'Abrir carpeta',
  FOLDER_OPEN_FILE:'Abrir archivo',
  FOLDER_OPEN_URL_PLACEHOLDER:'Introduce una dirección web',
  BUTTON_ADD:'Añadir',
  CHECKBOX_LIVE:'En directo',
  LOADING_MESSAGE_OPEN_FILE:'Abriendo el archivo…',
  LOADING_MESSAGE_ANALYZE_FILE:'Analizando el archivo (${mux})…',
  LOADING_MESSAGE_LOAD_AUDIO_DECODER:'Cargando decodificador de audio (${decoder})…',
  LOADING_MESSAGE_LOAD_VIDEO_DECODER:'Cargando decodificador de video (${decoder})…',
  LOADING_MESSAGE_LOAD_END:'Preparado para reproducir',
  LOADING_MESSAGE_LOAD_FAILED:'No se pudo cargar el archivo',
  LOADING_MESSAGE_RESUME:'Toca la pantalla o el control de volumen para activar el audio',
  INFO_TITLE:'Información técnica',
  MENU_STATS:'Información del archivo',
  SETTINGS_TITLE:'Configuración',
  SETTING_TAB_DECODER:'Decodificador',
  SETTING_TAB_PLAY:'Reproducción',
  SETTING_TAB_SUBTITLE:'Subtítulos',
  SETTING_TAB_VIDEO:'Imagen',
  SETTING_TAB_AUDIO:'Sonido',
  SETTING_TAB_FILTER:'Filtros',
  SETTING_TAB_KEYBOARD:'Atajos de teclado',
  SETTING_TAB_LANGUAGE:'Idioma',
  SETTING_TAB_SKIN:'Apariencia'
 });
 function apply(player){
   if(!player?.ui||typeof player.ui.set!=='function')return false;
   try{
     player.ui.set('language',ES);
     // El menú contextual se forma una sola vez en el constructor de AVPlayerUI.
     player.ui.set('menu',[{name:ES.MENU_STATS,action:0}]);
     return true;
   }catch(error){
     console.warn('ANTOO PELIS: No se pudo traducir AVPlayerUI.',error);
     return false;
   }
 }
 window.antooAvplayerSpanish={apply,language:ES};
})();
