// Actualizar datos: sube el TAD, lo revisa en el dispositivo y lo carga por lotes.
(function(){
  'use strict';
  const { $, esc, rpc, toast, normalizeStr, fecha, hora, plural, esqueleto, cache } = window.Comun;
  const S = window.Sesion;
  const LOTE = 400;
  const COLUMNAS = { s: 'sucursal', c: 'cliente', t: 'tipo', d: 'documento', f: 'fecha_instalacion', n: 'nombre', e: 'equipo', p: 'plan', es: 'estado', ca: 'categoria', cx: 'cxcpendiente' };
  const OBLIGATORIAS = ['s', 'c', 'd', 'n'];
  const BASURA = ['nan', '#n/a', '#ref!', '#value!', 'null', 'undefined'];
  let yo = null; let listo = null; let ocupado = false;

  // ---------- Leer el archivo ----------
  async function leerTexto(file){
    const buf = await file.arrayBuffer();
    let t = new TextDecoder('utf-8').decode(buf);
    if(t.indexOf('�') >= 0) t = new TextDecoder('windows-1252').decode(buf);   // exportado con acentos de Windows
    return t.replace(/^﻿/, '');
  }
  function partirCsv(texto){
    const primera = texto.slice(0, texto.indexOf('\n') < 0 ? texto.length : texto.indexOf('\n'));
    const sep = (primera.split(';').length > primera.split(',').length) ? ';' : (primera.split('\t').length > primera.split(',').length ? '\t' : ',');
    const filas = []; let fila = []; let campo = ''; let dentro = false;
    for(let i = 0; i < texto.length; i++){
      const ch = texto[i];
      if(dentro){
        if(ch === '"'){ if(texto[i + 1] === '"'){ campo += '"'; i++; } else dentro = false; }
        else campo += ch;
      } else if(ch === '"') dentro = true;
      else if(ch === sep){ fila.push(campo); campo = ''; }
      else if(ch === '\n' || ch === '\r'){
        if(ch === '\r' && texto[i + 1] === '\n') i++;
        fila.push(campo); campo = '';
        if(fila.length > 1 || fila[0] !== '') filas.push(fila);
        fila = [];
      } else campo += ch;
    }
    if(campo !== '' || fila.length){ fila.push(campo); if(fila.length > 1 || fila[0] !== '') filas.push(fila); }
    return filas;
  }
  const limpio = (v) => { const t = String(v === undefined || v === null ? '' : v).trim(); return BASURA.indexOf(t.toLowerCase()) >= 0 ? '' : t; };
  function fechaIso(v){
    const m = /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/.exec(v) || null;
    let a, me, d;
    if(m){ d = +m[1]; me = +m[2]; a = +m[3]; }
    else { const k = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v); if(!k) return ''; a = +k[1]; me = +k[2]; d = +k[3]; }
    const f = new Date(Date.UTC(a, me - 1, d));
    if(a < 1990 || a > 2100 || f.getUTCMonth() !== me - 1 || f.getUTCDate() !== d) return '';
    return a + '-' + String(me).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }
  function preparar(texto){
    const filas = partirCsv(texto);
    if(filas.length < 2) throw new Error('El archivo está vacío o no es un CSV');
    const cab = filas[0].map((h) => normalizeStr(h).replace(/\s+/g, '_'));
    const idx = {};
    Object.keys(COLUMNAS).forEach((k) => { idx[k] = cab.indexOf(COLUMNAS[k]); });
    const faltan = OBLIGATORIAS.filter((k) => idx[k] < 0).map((k) => COLUMNAS[k]);
    if(faltan.length) throw new Error('Este no parece el TAD. Faltan las columnas: ' + faltan.join(', '));
    const datos = []; let malas = 0; const clientes = new Set();
    for(let i = 1; i < filas.length; i++){
      const f = filas[i]; const o = {};
      Object.keys(COLUMNAS).forEach((k) => { o[k] = idx[k] >= 0 ? limpio(f[idx[k]]) : ''; });
      o.f = fechaIso(o.f);
      const doc = o.d.replace(/\D/g, '').replace(/^0+/, '');
      if(!/^[1-9][0-9]{4,9}$/.test(doc) || !o.n || !/[1-9]/.test(o.s) || !/[1-9]/.test(o.c)){ malas++; continue; }
      if(!o.t) o.t = 'J';
      clientes.add(doc); datos.push(o);
    }
    if(!datos.length) throw new Error('Ninguna fila del archivo se pudo leer');
    return { datos, malas, clientes: clientes.size, total: filas.length - 1 };
  }

  // ---------- Pantalla ----------
  function pintarInicio(){
    $('zonaTad').innerHTML = '<button type="button" class="soltar" id="soltarTad"><svg class="i g" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M5 20h14"/></svg><b>Elige el archivo del TAD</b>O arrástralo aquí. Formato CSV.</button>';
  }
  function pintarListo(){
    const l = listo;
    $('zonaTad').innerHTML = '<div class="datos" style="margin-top:0"><div class="dato-f"><span>Archivo</span><b>' + esc(l.nombre) + '</b></div>' +
      '<div class="dato-f"><span>Servicios</span><b>' + esc(l.datos.length.toLocaleString('es-VE')) + '</b></div>' +
      '<div class="dato-f"><span>Clientes</span><b>' + esc(l.clientes.toLocaleString('es-VE')) + '</b></div>' +
      (l.malas ? '<div class="dato-f"><span>No se pueden leer</span><b style="color:var(--rojo)">' + plural(l.malas, 'fila', 'filas') + ' (sin RIF, nombre o código)</b></div>' : '') + '</div>' +
      '<div class="acc" style="margin-top:14px"><button type="button" class="btn btn-2" id="cancelarTad">Elegir otro</button><button type="button" class="btn" id="cargarTad">Cargar ' + esc(l.datos.length.toLocaleString('es-VE')) + ' servicios</button></div>' +
      '<p class="nota-chica">No borra nada. Agrega lo nuevo y actualiza estado, plan y deuda de lo que ya está.</p>';
  }
  function pintarAvance(hecho, total){
    const p = total ? Math.round(hecho * 100 / total) : 0;
    $('zonaTad').innerHTML = '<div role="status" aria-live="polite"><b style="font-size:15.5px">Cargando ' + esc(hecho.toLocaleString('es-VE')) + ' de ' + esc(total.toLocaleString('es-VE')) + '</b>' +
      '<div class="bar" style="margin-top:10px"><i style="transform:scaleX(' + (p / 100).toFixed(3) + ');transition:transform 200ms var(--ease-out)"></i></div>' +
      '<p class="nota-chica">No cierres esta pantalla hasta que termine.</p></div>';
  }
  function pintarFin(r){
    $('zonaTad').innerHTML = '<div class="aviso" style="margin-top:0"><b>TAD cargado</b><p>' +
      plural(r.clientes_nuevos, 'cliente nuevo', 'clientes nuevos') + ', ' + plural(r.servicios_nuevos, 'servicio nuevo', 'servicios nuevos') + ' y ' + plural(r.servicios_actualizados, 'actualizado', 'actualizados') + '.' +
      (r.pagos_marcados ? ' ' + plural(r.pagos_marcados, 'instalación quedó pagada', 'instalaciones quedaron pagadas') + '.' : '') +
      (r.invalidas ? ' ' + plural(r.invalidas, 'fila no se pudo leer', 'filas no se pudieron leer') + '.' : '') + '</p>' +
      '<p style="margin-top:6px">Ahora hay ' + esc(Number(r.clientes_total).toLocaleString('es-VE')) + ' clientes en total.</p>' +
      '<p style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap"><a class="btn btn-chico" href="clientes.html?f=todos">Ver clientes</a><button type="button" class="btn btn-chico btn-2" id="otroTad">Subir otro</button></p></div>';
  }
  async function elegir(file){
    if(!file || ocupado) return;
    if(file.size > 25 * 1024 * 1024){ toast('El archivo pesa más de 25 MB', 'error'); return; }
    try {
      const p = preparar(await leerTexto(file));
      listo = Object.assign(p, { nombre: file.name });
      pintarListo();
    } catch (e) { listo = null; pintarInicio(); toast(e.message, 'error'); }
  }
  async function cargarTad(){
    if(!listo || ocupado) return;
    ocupado = true; const l = listo; let carga = null;
    pintarAvance(0, l.datos.length);
    try {
      carga = await rpc('tad_iniciar', { p_archivo: l.nombre, p_total: l.total });
      for(let i = 0; i < l.datos.length; i += LOTE){
        await conReintento(() => rpc('tad_filas', { p_carga: carga, p_filas: l.datos.slice(i, i + LOTE) }));
        pintarAvance(Math.min(i + LOTE, l.datos.length), l.datos.length);
      }
      const r = await rpc('tad_cerrar', { p_carga: carga });
      r.invalidas = (r.invalidas || 0) + l.malas;
      listo = null; ocupado = false; cache.borrarTodo();
      pintarFin(r); toast('TAD cargado'); cargas();
    } catch (e) {
      ocupado = false; pintarListo();
      toast('La carga se detuvo. ' + e.message + '. Puedes volver a intentarlo: no se duplica nada', 'error');
    }
  }
  // Con mala señal un lote puede fallar: se intenta dos veces más antes de detener todo
  async function conReintento(fn){
    let ultimo;
    for(let n = 0; n < 3; n++){
      try { return await fn(); }
      catch (e) { ultimo = e; if(!/conexi/i.test(e.message)) throw e; await new Promise((ok) => setTimeout(ok, 1200 * (n + 1))); }
    }
    throw ultimo;
  }
  const FUENTES = { tad: 'TAD', odoo: 'Odoo', instalaciones: 'Órdenes de instalación', dedicados: 'Dedicados' };
  async function cargas(){
    try {
      const l = await rpc('cargas_ultimas', {});
      const t = l.find((x) => x.fuente === 'tad');
      $('ultimoTad').textContent = t ? 'Último: ' + fecha(t.en) + ' a las ' + hora(t.en) + (t.por ? ', por ' + t.por : '') + '.' : 'Todavía no se ha subido ninguno.';
      $('cargas').innerHTML = l.length ? '<div class="grupo abierto">' + l.map((c, i) => '<div class="fila"' + (i === 0 ? ' style="border-top:0"' : '') + '><span class="tx"><b>' + esc(FUENTES[c.fuente] || c.fuente) + ' · ' + esc(c.archivo) + '</b><small>' + esc(fecha(c.en)) + ' ' + esc(hora(c.en)) + (c.por ? ' · ' + esc(c.por) : '') + ' · ' + esc(Number(c.filas).toLocaleString('es-VE')) + ' filas</small></span>' +
        '<span class="m ' + (c.estado === 'lista' ? 'verde' : 'ambar') + '">' + (c.estado === 'lista' ? 'Completa' : 'Con filas sin leer') + '</span></div>').join('') + '</div>'
        : '<div class="vacio"><b>Aún no hay cargas</b><p>Cuando subas el primer archivo aparecerá aquí con su fecha y quién lo subió.</p></div>';
    } catch (e) {
      $('cargas').innerHTML = '<div class="vacio" role="alert"><b>No se pudo ver el historial</b><p>' + esc(e.message) + '</p></div>';
    }
  }

  document.addEventListener('click', (e) => {
    const t = e.target;
    if(t.closest('#soltarTad') || t.closest('#cancelarTad') || t.closest('#otroTad')){ if(ocupado) return; if(t.closest('#otroTad')){ pintarInicio(); } const i = $('archivoTad'); i.value = ''; i.click(); return; }
    if(t.closest('#cargarTad')) cargarTad();
  });
  $('archivoTad').addEventListener('change', () => elegir($('archivoTad').files[0]));
  const zona = $('zonaTad');
  zona.addEventListener('dragover', (e) => { e.preventDefault(); const s = $('soltarTad'); if(s) s.classList.add('sobre'); });
  zona.addEventListener('dragleave', () => { const s = $('soltarTad'); if(s) s.classList.remove('sobre'); });
  zona.addEventListener('drop', (e) => { e.preventDefault(); const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if(f) elegir(f); });
  window.addEventListener('beforeunload', (e) => { if(ocupado){ e.preventDefault(); e.returnValue = ''; } });

  (async function(){
    yo = await S.requerir(['admin', 'analista']);
    if(!yo) return;
    window.Armazon.montar(yo, { activo: null, volver: { enlace: 'inicio.html', texto: 'Inicio' } });
    $('cargas').innerHTML = esqueleto(2);
    cargas();
  })();
})();
