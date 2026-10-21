// Conexión central a Supabase. Todos los módulos cargan este archivo.
// La librería (assets/vendor/supabase.js) ya ocupa el nombre global "supabase":
// nunca declares otra variable con ese nombre. El cliente conectado se llama "db".
// La clave de aquí es la pública: lo que protege los datos son el PIN y los permisos por tabla.
(function(){
  var URL = 'https://tgjcwgvaybidcawkqksm.supabase.co';
  var KEY = 'sb_publishable_IUErTM0dqiaAj37LkTygcQ_KYjWY0F-';
  var guarda;
  // Lote S (21/10): la sesión queda en el dispositivo y se cierra sola tras unas horas sin uso (12 por defecto, ajuste del administrador).
  // Se revisa aquí, antes de crear el cliente, para que una sesión vencida nunca llegue a usarse.
  try { guarda = window.localStorage; guarda.setItem('ae_prueba', '1'); guarda.removeItem('ae_prueba'); } catch (e) { guarda = undefined; }
  try {
    var h = Number(guarda.getItem('ae_inactividad_h')); if (!(h >= 1 && h <= 72)) h = 12;
    var t = Number(guarda.getItem('ae_actividad'));
    if (t && Date.now() - t > h * 3600000) {
      Object.keys(guarda).filter(function (k) { return /^sb-.+-auth-token$/.test(k) || k.indexOf('ae_c_') === 0 || k === 'ae_perfil'; }).forEach(function (k) { guarda.removeItem(k); });
      guarda.removeItem('ae_actividad'); guarda.setItem('ae_vencio', '1');
    }
    // Las sesiones de antes (solo mientras la app estaba abierta) se borran: se entra una vez más con el PIN
    Object.keys(window.sessionStorage).filter(function (k) { return /^sb-.+-auth-token$/.test(k); }).forEach(function (k) { window.sessionStorage.removeItem(k); });
  } catch (e) {}
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    window.db = window.supabase.createClient(URL, KEY, {
      auth: { storage: guarda, persistSession: !!guarda, autoRefreshToken: true, detectSessionInUrl: false }
    });
  } else {
    window.db = null;
    console.error('No se pudo cargar la librería de Supabase.');
  }
})();
