// Mapa de red en Actualizar: el administrador suelta el KMZ, se lee fuera de la pantalla, sube por lotes y muestra qué cambió.
(function(){
  'use strict';
  const { $, esc, rpc, toast, fecha, plural, hoyClave } = window.Comun;
  const LOTE = 150;
  const VER = ((document.currentScript && /[?&]v=(\d+)/.exec(document.currentScript.src)) || [])[1] || '1';
  const NOMBRES = { liberado: 'Liberado', exclusiva: 'Exclusiva', diseno: 'Diseño', construccion: 'Construcción', permiso_vgt: 'Permiso VGT' };
  const num = (n) => Number(n || 0).toLocaleString('es-VE');
  let yo = null; let actual = null; let leido = null; let ocupado = false; let paso = ''; let resumen = null; let error = '';

  function reparto(r){ return Object.keys(NOMBRES).filter((k) => r && r[k]).map((k) => NOMBRES[k] + ' ' + num(r[k])).join(' · '); }
  function pintar(){
    const z = $('mapaRed'); if(!z) return;
    const info = actual ? '<p class="nota-chica" style="margin-top:0">Mapa vigente del ' + esc(fecha(actual.fecha)) + ': ' + esc(num(actual.zonas)) + ' zonas. ' + esc(reparto(actual.reparto)) + '.</p>'
      : '<p class="nota-chica" style="margin-top:0">Todavía no hay mapa de red: Factibilidad no puede consultar hasta que se suba.</p>';
    if(!yo || yo.rol !== 'admin'){ z.innerHTML = info + '<p class="nota-chica">Solo el administrador sube el mapa.</p>'; return; }
    let cuerpo = '';
    if(resumen) cuerpo = pintarResumen(resumen);
    else if(ocupado) cuerpo = '<div class="grupo abierto" role="status" aria-live="polite"><div class="fila" style="border-top:0"><span class="tx"><b>' + esc(leido ? leido.nombre : 'Mapa') + '</b><small>' + esc(paso) + '</small></span><span class="m ambar">Cargando</span></div></div><p class="nota-chica">No cierres esta pantalla hasta que termine.</p>';
    else if(leido) cuerpo = '<div class="grupo abierto"><div class="fila" style="border-top:0"><span class="tx"><b>Mapa de red · ' + esc(leido.nombre) + '</b><small>' + esc(num(leido.zonas.length)) + ' zonas y ' + esc(num(leido.puntos)) + ' puntos. ' + esc(reparto(leido.reparto)) + '.' +
        (leido.sinEstado ? ' ' + esc(plural(leido.sinEstado, 'zona queda fuera', 'zonas quedan fuera')) + ' porque no están en una carpeta de estado.' : '') + '</small></span><span class="m">Listo para cargar</span></div></div>' +
      '<label class="rotulo arriba" for="mapaFecha">Fecha del mapa</label><input class="campo" id="mapaFecha" type="date" value="' + esc(leido.fecha) + '" max="' + esc(hoyClave()) + '" style="max-width:260px"><div class="error" id="eMapa" role="alert">' + esc(error) + '</div>' +
      '<div class="acc"><button type="button" class="btn btn-2" id="mapaQuitar">Quitar</button><button type="button" class="btn" id="mapaCargar">Cargar mapa</button></div>' +
      '<p class="nota-chica">Reemplaza el mapa vigente y vuelve a revisar todas las consultas abiertas.</p>';
    else cuerpo = (error ? '<div class="error" role="alert">' + esc(error) + '</div>' : '') + '<button type="button" class="soltar" id="mapaSoltar"><svg class="i g" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M5 20h14"/></svg><b>Elige el mapa (KMZ)</b>O arrástralo aquí. También puedes soltarlo junto con los demás archivos.</button>';
    z.innerHTML = info + '<div style="margin-top:12px">' + cuerpo + '</div>';
  }
  function pintarResumen(r){
    const c = r.cambios || {}; const k = r.consultas || {};
    const lin = (t, v) => '<div class="fila"><span class="tx"><b>' + esc(t) + '</b><small>' + esc(v) + '</small></span></div>';
    let h = lin('Mapa del ' + fecha(r.fecha), num(r.zonas) + ' zonas. ' + reparto(r.reparto) + '.');
    if(!r.primero) h += lin('Frente al mapa anterior', plural(c.nuevas, 'MDT nuevo', 'MDT nuevos') + ', ' + plural(c.quitadas, 'quitado', 'quitados') + ' y ' + plural(c.cambio_estado, 'cambió de estado', 'cambiaron de estado') + (c.ahora_operativas ? ' (' + plural(c.ahora_operativas, 'ahora tiene red', 'ahora tienen red') + ')' : '') + '.') +
      ((c.ejemplos || []).length ? lin('Cambios de estado', c.ejemplos.slice(0, 8).map((x) => x.mdt + ': ' + (NOMBRES[x.de] || x.de) + ' a ' + (NOMBRES[x.a] || x.a)).join(' · ') + (c.ejemplos.length > 8 ? ' y más' : '')) : '');
    h += lin('Consultas', k.revisadas ? plural(k.revisadas, 'consulta abierta revisada', 'consultas abiertas revisadas') + '. ' + (k.cambiaron ? plural(k.cambiaron, 'cambió', 'cambiaron') + (k.con_red ? ', ' + plural(k.con_red, 'ahora con red', 'ahora con red') : '') + ': salen marcadas como NUEVO.' : 'Ninguna cambió.') : 'Todavía no hay consultas guardadas.');
    return '<div class="aviso" style="margin-top:0"><b>Mapa cargado</b><div class="grupo abierto" style="margin-top:12px">' + h.replace('<div class="fila">', '<div class="fila" style="border-top:0">') + '</div>' +
      '<p style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap"><a class="btn btn-chico" href="factibilidad.html">Ir a Factibilidad</a><button type="button" class="btn btn-chico btn-2" id="mapaOtro">Subir otro</button></p></div>';
  }
  function recibir(file){
    if(!yo || yo.rol !== 'admin'){ toast('Solo el administrador sube el mapa de red', 'error'); return; }
    if(ocupado) return;
    if(file.size > 150 * 1024 * 1024){ error = 'El mapa pesa más de 150 MB'; pintar(); return; }
    resumen = null; error = ''; leido = null; ocupado = true; paso = 'Leyendo el mapa...'; leido = { nombre: file.name }; pintar();
    let w;
    try { w = new Worker('assets/js/kmz-lector.js?v=' + VER); } catch (e) { ocupado = false; leido = null; error = 'Este navegador no puede leer el mapa. Usa Chrome o Edge actualizados'; pintar(); return; }
    w.onmessage = (e) => {
      w.terminate(); ocupado = false;
      if(e.data.error){ leido = null; error = e.data.error; pintar(); toast('El mapa no se pudo leer. ' + e.data.error, 'error'); return; }
      const d = new Date(file.lastModified || Date.now());
      leido = Object.assign(e.data, { nombre: file.name, fecha: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') });
      if(leido.fecha > hoyClave()) leido.fecha = hoyClave();
      pintar();
    };
    w.onerror = () => { w.terminate(); ocupado = false; leido = null; error = 'No se pudo leer el mapa. Intenta de nuevo'; pintar(); };
    w.postMessage({ archivo: file });
  }
  async function cargar(){
    if(!leido || ocupado) return;
    const f = $('mapaFecha').value;
    if(!f){ error = 'Escribe la fecha del mapa'; pintar(); $('mapaFecha').focus(); return; }
    leido.fecha = f; error = ''; ocupado = true; paso = 'Preparando la carga...'; pintar();
    const zonas = leido.zonas;
    try {
      const id = await rpc('mapa_iniciar', { p_fecha: f, p_archivo: leido.nombre, p_poligonos: zonas.length, p_puntos: leido.puntos });
      for(let i = 0; i < zonas.length; i += LOTE){
        await conReintento(() => rpc('mapa_zonas', { p_mapa: id, p_filas: zonas.slice(i, i + LOTE) }));
        paso = 'Subiendo zonas: ' + num(Math.min(i + LOTE, zonas.length)) + ' de ' + num(zonas.length); pintar();
      }
      paso = 'Revisando las consultas con el mapa nuevo...'; pintar();
      resumen = await rpc('mapa_cerrar', { p_mapa: id });
      leido = null; ocupado = false; toast('Mapa cargado');
      try { actual = await rpc('mapa_actual', {}); } catch (e) { /* el resumen ya lo dice */ }
      pintar();
    } catch (e) {
      ocupado = false; error = 'La carga se detuvo. ' + e.message + '. Puedes volver a intentarlo: el mapa vigente no cambió.'; pintar();
      toast('La carga del mapa se detuvo', 'error');
    }
  }
  async function conReintento(fn){
    let ultimo;
    for(let i = 0; i < 3; i++){ try { return await fn(); } catch (e) { ultimo = e; if(/no está abierta|permiso|sesión/i.test(e.message)) break; await new Promise((ok) => setTimeout(ok, 1500 * (i + 1))); } }
    throw ultimo;
  }

  document.addEventListener('click', (e) => {
    const t = e.target;
    if(t.closest('#mapaSoltar')){ if(ocupado) return; const i = $('archivoMapa'); i.value = ''; i.click(); return; }
    if(t.closest('#mapaQuitar') || t.closest('#mapaOtro')){ if(ocupado) return; leido = null; resumen = null; error = ''; pintar(); return; }
    if(t.closest('#mapaCargar')){ cargar(); }
  });
  window.addEventListener('beforeunload', (e) => { if(ocupado){ e.preventDefault(); e.returnValue = ''; } });

  window.MapaRed = {
    esMapa: (f) => /\.(kmz|kml)$/i.test(f.name || ''),
    recibir,
    async montar(usuario){
      yo = usuario; const z = $('mapaRed'); if(!z) return;
      $('archivoMapa').addEventListener('change', () => { const f = $('archivoMapa').files[0]; if(f) recibir(f); });
      z.addEventListener('dragover', (e) => { e.preventDefault(); });
      z.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if(f) recibir(f); });
      z.innerHTML = '<span class="sk" style="height:20px;border-radius:8px;display:block;width:70%"></span>';
      try { actual = await rpc('mapa_actual', {}); } catch (e) { z.innerHTML = '<p class="nota-chica" role="alert">No se pudo ver el mapa vigente. ' + esc(e.message) + '</p>'; return; }
      pintar();
    }
  };
})();
