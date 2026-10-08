// Conexión central a Supabase. Todos los módulos cargan este archivo.
// La librería (assets/vendor/supabase.js) ya ocupa el nombre global "supabase":
// nunca declares otra variable con ese nombre. El cliente conectado se llama "db".
// La clave de aquí es la pública: lo que protege los datos son el PIN y los permisos por tabla.
(function(){
  var URL = 'https://tgjcwgvaybidcawkqksm.supabase.co';
  var KEY = 'sb_publishable_IUErTM0dqiaAj37LkTygcQ_KYjWY0F-';
  var guarda;
  // La sesión vive solo mientras la pestaña o la app esté abierta: al cerrarla se pide el PIN otra vez.
  try { guarda = window.sessionStorage; guarda.setItem('ae_prueba', '1'); guarda.removeItem('ae_prueba'); } catch (e) { guarda = undefined; }
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    window.db = window.supabase.createClient(URL, KEY, {
      auth: { storage: guarda, persistSession: !!guarda, autoRefreshToken: true, detectSessionInUrl: false }
    });
  } else {
    window.db = null;
    console.error('No se pudo cargar la librería de Supabase.');
  }
})();
