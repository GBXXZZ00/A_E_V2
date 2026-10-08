// Actualizar datos: recibe varios archivos, reconoce cada uno por sus columnas y los carga por lotes.
(function(){
  'use strict';
  const { $, esc, rpc, toast, normalizeStr, fecha, hora, plural, esqueleto, cache } = window.Comun;
  const S = window.Sesion;
  const LOTE = 400;
  const COLUMNAS = { s: 'sucursal', c: 'cliente', t: 'tipo', d: 'documento', f: 'fecha_instalacion', n: 'nombre', e: 'equipo', p: 'plan', es: 'estado', ca: 'categoria', cx: 'cxcpendiente' };
  const OBLIGATORIAS = ['s', 'c', 'd', 'n'];
  const BASURA = ['nan', '#n/a', '#ref!', '#value!', 'null', 'undefined'];
  let yo = null; let lista = []; let ocupado = false; let fin = null;
  const TOPE_TAD = 60000; const LOTE_CRUDO = 200;

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
    if(/^\d{5}(\.\d+)?$/.test(v)){ const x = new Date(Date.UTC(1899, 11, 30) + Math.floor(+v) * 86400000); return x.toISOString().slice(0, 10); }   // fecha de Excel
    const m = /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/.exec(v) || null;
    let a, me, d;
    if(m){ d = +m[1]; me = +m[2]; a = +m[3]; }
    else { const k = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v); if(!k) return ''; a = +k[1]; me = +k[2]; d = +k[3]; }
    const f = new Date(Date.UTC(a, me - 1, d));
    if(a < 1990 || a > 2100 || f.getUTCMonth() !== me - 1 || f.getUTCDate() !== d) return '';
    return a + '-' + String(me).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }

  // ---------- Excel (.xlsx) sin librerías: zip + XML ----------
  async function inflar(bytes){
    const st = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(st).arrayBuffer());
  }
  async function leerXlsx(file){
    if(typeof DecompressionStream === 'undefined') throw new Error('Este navegador no abre Excel. Guárdalo como CSV');
    const u = new Uint8Array(await file.arrayBuffer()); const v = new DataView(u.buffer);
    let fin = -1;
    for(let i = u.length - 22; i >= Math.max(0, u.length - 70000); i--){ if(v.getUint32(i, true) === 0x06054b50){ fin = i; break; } }
    if(fin < 0) throw new Error('El Excel está dañado o no es .xlsx');
    const n = v.getUint16(fin + 10, true); let pos = v.getUint32(fin + 16, true); const dec = new TextDecoder('utf-8'); const dentro = {};
    for(let k = 0; k < n; k++){
      if(v.getUint32(pos, true) !== 0x02014b50) break;
      const metodo = v.getUint16(pos + 10, true), tam = v.getUint32(pos + 20, true), ln = v.getUint16(pos + 28, true), le = v.getUint16(pos + 30, true), lc = v.getUint16(pos + 32, true), loc = v.getUint32(pos + 42, true);
      dentro[dec.decode(u.subarray(pos + 46, pos + 46 + ln))] = { metodo, tam, loc };
      pos += 46 + ln + le + lc;
    }
    async function texto(nombre){
      const e = dentro[nombre]; if(!e) return null;
      const ini = e.loc + 30 + v.getUint16(e.loc + 26, true) + v.getUint16(e.loc + 28, true);
      const crudo = u.subarray(ini, ini + e.tam);
      return dec.decode(e.metodo === 0 ? crudo : await inflar(crudo));
    }
    const hojas = Object.keys(dentro).filter((x) => /^xl\/worksheets\/sheet\d+\.xml$/.test(x)).sort((a, b) => parseInt(a.replace(/\D/g, ''), 10) - parseInt(b.replace(/\D/g, ''), 10));
    if(!hojas.length) throw new Error('El Excel no trae hojas');
    const xml = (t) => new DOMParser().parseFromString(t, 'application/xml');
    const sst = await texto('xl/sharedStrings.xml'); const textos = [];
    if(sst){ const si = xml(sst).getElementsByTagName('si'); for(let i = 0; i < si.length; i++){ const ts = si[i].getElementsByTagName('t'); let t = ''; for(let j = 0; j < ts.length; j++){ if(ts[j].parentNode.nodeName !== 'rPh') t += ts[j].textContent; } textos.push(t); } }
    const filas = []; const rs = xml(await texto(hojas[0])).getElementsByTagName('row');
    for(let i = 0; i < rs.length; i++){
      const cs = rs[i].getElementsByTagName('c'); const fila = []; let sig = 0;
      for(let j = 0; j < cs.length; j++){
        const c = cs[j]; const ref = (c.getAttribute('r') || '').replace(/\d/g, ''); let col = sig;
        if(ref){ col = 0; for(let q = 0; q < ref.length; q++) col = col * 26 + (ref.charCodeAt(q) - 64); col -= 1; }
        sig = col + 1; const tp = c.getAttribute('t'); let val = '';
        if(tp === 'inlineStr'){ const ts = c.getElementsByTagName('t'); for(let q = 0; q < ts.length; q++) val += ts[q].textContent; }
        else { const vv = c.getElementsByTagName('v')[0]; if(vv){ val = vv.textContent; if(tp === 's') val = textos[+val] || ''; } }
        while(fila.length < col) fila.push('');
        fila[col] = val;
      }
      if(fila.some((x) => x !== '')) filas.push(fila);
    }
    return filas;
  }
  async function leerFilas(file){
    if(/\.xlsx$/i.test(file.name)) return leerXlsx(file);
    if(/\.xls$/i.test(file.name)) throw new Error('Es un Excel antiguo (.xls). Guárdalo como .xlsx o CSV');
    return partirCsv(await leerTexto(file));
  }

  // ---------- Reconocer cada archivo por sus columnas ----------
  const TIPOS = {
    tad: { nombre: 'TAD', pide: ['sucursal', 'cliente', 'documento', 'nombre'], que: 'Agrega clientes y servicios nuevos y actualiza estado, plan y deuda.' },
    instalaciones: { nombre: 'Órdenes de instalación', pide: ['codcliente', 'feccump', 'cedula'], que: 'Queda guardado para cruzar instalaciones con clientes.' },
    odoo: { nombre: 'Órdenes de Odoo', pide: ['odt', 'etapa', 'cliente'], que: 'Queda guardado para cruzar órdenes con clientes.' },
    base_vieja: { nombre: 'Base de la app anterior', pide: ['razon_social', 'rif', 'estatus_legal'], que: 'Queda guardada para traer estatus legal, líder y contactos.' }
  };
  const ORDEN = ['tad', 'base_vieja', 'odoo', 'instalaciones'];
  const clave = (h) => normalizeStr(h).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  function reconocer(cab){
    return ORDEN.find((t) => TIPOS[t].pide.every((c) => cab.indexOf(c) >= 0)) || null;
  }
  const esB2B = (o) => o.t === 'J' || o.t === 'G' || /^(pyme|dedicado|conectividad)/.test(normalizeStr(o.ca)) || /emp/.test(normalizeStr(o.p));
  function prepararTad(filas, cab){
    const idx = {};
    Object.keys(COLUMNAS).forEach((k) => { idx[k] = cab.indexOf(COLUMNAS[k]); });
    let datos = []; let malas = 0;
    for(let i = 1; i < filas.length; i++){
      const f = filas[i]; const o = {};
      Object.keys(COLUMNAS).forEach((k) => { o[k] = idx[k] >= 0 ? limpio(f[idx[k]]) : ''; });
      o.f = fechaIso(o.f);
      const doc = o.d.replace(/\D/g, '').replace(/^0+/, '');
      if(!/^[1-9][0-9]{4,9}$/.test(doc) || !o.n || !/[1-9]/.test(o.s) || !/[1-9]/.test(o.c)){ malas++; continue; }
      if(!o.t) o.t = 'J';
      o._doc = doc; datos.push(o);
    }
    // El TAD completo trae también residenciales: se queda solo lo de empresas
    let fuera = 0;
    if(datos.length > TOPE_TAD){ const antes = datos.length; datos = datos.filter(esB2B); fuera = antes - datos.length; }
    if(datos.length > TOPE_TAD) throw new Error('Trae más de ' + TOPE_TAD.toLocaleString('es-VE') + ' servicios de empresas. Avísame para revisarlo');
    const clientes = new Set(); datos.forEach((o) => { clientes.add(o._doc); delete o._doc; });
    if(!datos.length) throw new Error('Ninguna fila se pudo leer');
    return { datos, malas, fuera, clientes: clientes.size };
  }
  function prepararCrudo(filas, cab){
    const datos = [];
    for(let i = 1; i < filas.length; i++){
      const o = {}; let hay = false;
      for(let j = 0; j < cab.length; j++){ if(!cab[j]) continue; const v = limpio(filas[i][j]); if(v !== ''){ o[cab[j]] = v.slice(0, 2000); hay = true; } }
      if(hay) datos.push(o);
    }
    if(!datos.length) throw new Error('El archivo no trae filas');
    if(datos.length > 60000) throw new Error('Trae demasiadas filas. Expórtalo con menos fechas');
    return { datos, malas: 0, fuera: 0, clientes: 0 };
  }
  async function preparar(file){
    const filas = await leerFilas(file);
    if(filas.length < 2) throw new Error('Está vacío o no se puede leer');
    const cab = filas[0].map(clave);
    const tipo = reconocer(cab);
    if(!tipo) throw new Error('No reconozco este archivo por sus columnas');
    const p = tipo === 'tad' ? prepararTad(filas, cab) : prepararCrudo(filas, cab);
    return Object.assign(p, { tipo, total: filas.length - 1 });
  }

  // ---------- Pantalla ----------
  const num = (n) => Number(n || 0).toLocaleString('es-VE');
  const ICO = '<svg class="i g" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M5 20h14"/></svg>';
  function detalle(a){
    if(a.error) return '<small style="color:var(--rojo)">' + esc(a.error) + '</small>';
    if(a.leyendo) return '<small>Leyendo...</small>';
    if(a.resultado) return '<small>' + esc(a.resultado) + '</small>';
    if(a.tipo === 'tad') return '<small>' + num(a.datos.length) + ' servicios de ' + num(a.clientes) + ' clientes' + (a.fuera ? ' · ' + num(a.fuera) + ' residenciales quedan fuera' : '') + (a.malas ? ' · ' + plural(a.malas, 'fila', 'filas') + ' sin RIF, nombre o código' : '') + '</small>';
    return '<small>' + plural(a.datos.length, 'fila', 'filas') + '</small>';
  }
  function marca(a){
    if(a.error) return '<span class="m rojo">No sirve</span>';
    if(a.leyendo) return '<span class="m">Leyendo</span>';
    if(a.estado === 'lista') return '<span class="m verde">Cargado</span>';
    if(a.estado === 'fallo') return '<span class="m rojo">Se detuvo</span>';
    if(a.estado === 'subiendo') return '<span class="m ambar">' + Math.round(a.hecho * 100 / Math.max(1, a.datos.length)) + ' %</span>';
    return '<span class="m">Listo para cargar</span>';
  }
  function pintar(){
    const z = $('zona');
    const soltar = '<button type="button" class="soltar" id="soltar">' + ICO + '<b>' + (lista.length ? 'Agregar más archivos' : 'Elige los archivos') + '</b>O arrástralos aquí, todos juntos. CSV o Excel (.xlsx).</button>';
    if(!lista.length){ z.innerHTML = soltar; return; }
    const buenos = lista.filter((a) => a.datos && a.estado !== 'lista');
    const filas = '<div class="grupo abierto" id="listaArch" role="status" aria-live="polite">' + lista.map((a, i) =>
      '<div class="fila carga-f"' + (i === 0 ? ' style="border-top:0"' : '') + ' data-i="' + i + '"><span class="tx"><b>' + esc(a.tipo ? TIPOS[a.tipo].nombre : 'Sin reconocer') + ' · ' + esc(a.nombre) + '</b>' + detalle(a) + '</span>' + marca(a) + '</div>').join('') + '</div>';
    let pie;
    if(ocupado) pie = '<p class="nota-chica">No cierres esta pantalla hasta que termine.</p>';
    else if(fin) pie = '<div class="aviso" style="margin-top:14px"><b>' + esc(fin.titulo) + '</b><p>' + esc(fin.texto) + '</p><p style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap"><a class="btn btn-chico" href="clientes.html?f=todos">Ver clientes</a><button type="button" class="btn btn-chico btn-2" id="otro">Subir otros</button></p></div>';
    else pie = '<div class="acc" style="margin-top:14px"><button type="button" class="btn btn-2" id="limpiar">Quitar todos</button>' + (buenos.length ? '<button type="button" class="btn" id="cargarTodo">Cargar ' + plural(buenos.length, 'archivo', 'archivos') + '</button>' : '') + '</div><p class="nota-chica">No borra nada. Agrega lo nuevo y actualiza lo que ya está.</p>';
    z.innerHTML = filas + (ocupado || fin ? '' : '<div style="margin-top:12px">' + soltar + '</div>') + pie;
  }
  async function elegir(files){
    if(ocupado || !files || !files.length) return;
    if(fin){ lista = []; fin = null; }
    const nuevos = Array.prototype.slice.call(files, 0, 12).map((f) => ({ nombre: f.name, file: f, leyendo: true }));
    lista = lista.concat(nuevos); pintar();
    for(const a of nuevos){
      await new Promise((ok) => setTimeout(ok, 30));   // deja pintar antes de leer un archivo pesado
      try {
        if(a.file.size > 150 * 1024 * 1024) throw new Error('Pesa más de 150 MB');
        Object.assign(a, await preparar(a.file));
        const rep = lista.find((x) => x !== a && x.tipo === a.tipo && x.datos && x.estado !== 'lista');
        if(rep){ delete a.datos; throw new Error('Ya hay otro archivo de ' + TIPOS[a.tipo].nombre + ' en la lista'); }
      } catch (e) { a.error = e.message || 'No se pudo leer'; }
      a.leyendo = false; a.file = null; pintar();
    }
    const malos = nuevos.filter((a) => a.error).length;
    if(malos) toast(plural(malos, 'archivo no se pudo usar', 'archivos no se pudieron usar') + '. Mira el motivo en la lista', 'error');
  }
  async function subir(a){
    a.estado = 'subiendo'; a.hecho = 0; pintar();
    const tad = a.tipo === 'tad'; const paso = tad ? LOTE : LOTE_CRUDO;
    const carga = tad ? await rpc('tad_iniciar', { p_archivo: a.nombre, p_total: a.datos.length + a.malas })
      : await rpc('crudo_iniciar', { p_fuente: a.tipo, p_archivo: a.nombre, p_total: a.datos.length });
    for(let i = 0; i < a.datos.length; i += paso){
      await conReintento(() => rpc(tad ? 'tad_filas' : 'crudo_filas', { p_carga: carga, p_filas: a.datos.slice(i, i + paso) }));
      a.hecho = Math.min(i + paso, a.datos.length); pintar();
    }
    const r = await rpc(tad ? 'tad_cerrar' : 'crudo_cerrar', { p_carga: carga });
    a.estado = 'lista';
    a.resultado = tad ? plural(r.clientes_nuevos, 'cliente nuevo', 'clientes nuevos') + ', ' + plural(r.servicios_nuevos, 'servicio nuevo', 'servicios nuevos') + ' y ' + plural(r.servicios_actualizados, 'actualizado', 'actualizados') +
        (r.pagos_marcados ? ' · ' + plural(r.pagos_marcados, 'instalación pagada', 'instalaciones pagadas') : '') + ((r.invalidas || 0) + a.malas ? ' · ' + plural((r.invalidas || 0) + a.malas, 'fila no se pudo leer', 'filas no se pudieron leer') : '')
      : plural(r.guardadas, 'fila guardada', 'filas guardadas');
    a.datos = null; return r;
  }
  async function cargarTodo(){
    if(ocupado) return;
    const cola = ORDEN.map((t) => lista.find((a) => a.tipo === t && a.datos && a.estado !== 'lista')).filter(Boolean);
    if(!cola.length) return;
    ocupado = true; fin = null; let total = null; let fallo = null;
    for(const a of cola){
      try { const r = await subir(a); if(a.tipo === 'tad') total = r.clientes_total; }
      catch (e) { a.estado = 'fallo'; a.resultado = null; fallo = e; break; }
    }
    ocupado = false; cache.borrarTodo();
    if(fallo){ pintar(); toast('La carga se detuvo. ' + fallo.message + '. Puedes volver a intentarlo: no se duplica nada', 'error'); }
    else {
      const crudos = cola.some((a) => a.tipo !== 'tad');
      fin = { titulo: plural(cola.length, 'archivo cargado', 'archivos cargados'), texto: (total !== null ? 'Ahora hay ' + num(total) + ' clientes en total. ' : '') + (crudos ? 'Las órdenes y la base anterior quedan guardadas: el cruce con los clientes se hace en el siguiente paso.' : '') };
      pintar(); toast('Carga completa');
    }
    cargas();
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
  const FUENTES = { tad: 'TAD', odoo: 'Órdenes de Odoo', instalaciones: 'Órdenes de instalación', dedicados: 'Dedicados', base_vieja: 'Base de la app anterior' };
  async function cargas(){
    try {
      const l = await rpc('cargas_ultimas', {});
      const t = l.find((x) => x.fuente === 'tad');
      $('ultimoTad').textContent = t ? 'Último TAD: ' + fecha(t.en) + ' a las ' + hora(t.en) + (t.por ? ', por ' + t.por : '') + '.' : 'Todavía no se ha subido ningún TAD.';
      $('cargas').innerHTML = l.length ? '<div class="grupo abierto">' + l.map((c, i) => '<div class="fila"' + (i === 0 ? ' style="border-top:0"' : '') + '><span class="tx"><b>' + esc(FUENTES[c.fuente] || c.fuente) + ' · ' + esc(c.archivo) + '</b><small>' + esc(fecha(c.en)) + ' ' + esc(hora(c.en)) + (c.por ? ' · ' + esc(c.por) : '') + ' · ' + esc(plural(c.filas, 'fila', 'filas')) + '</small></span>' +
        '<span class="m ' + (c.estado === 'lista' ? 'verde' : 'ambar') + '">' + (c.estado === 'lista' ? 'Completa' : 'Con filas sin leer') + '</span></div>').join('') + '</div>'
        : '<div class="vacio"><b>Aún no hay cargas</b><p>Cuando subas el primer archivo aparecerá aquí con su fecha y quién lo subió.</p></div>';
    } catch (e) {
      $('cargas').innerHTML = '<div class="vacio" role="alert"><b>No se pudo ver el historial</b><p>' + esc(e.message) + '</p></div>';
    }
  }

  document.addEventListener('click', (e) => {
    const t = e.target;
    if(t.closest('#soltar')){ if(ocupado) return; const i = $('archivos'); i.value = ''; i.click(); return; }
    if(t.closest('#limpiar') || t.closest('#otro')){ if(ocupado) return; lista = []; fin = null; pintar(); return; }
    if(t.closest('#cargarTodo')) cargarTodo();
  });
  $('archivos').addEventListener('change', () => elegir($('archivos').files));
  const zona = $('zona');
  zona.addEventListener('dragover', (e) => { e.preventDefault(); const s = $('soltar'); if(s) s.classList.add('sobre'); });
  zona.addEventListener('dragleave', () => { const s = $('soltar'); if(s) s.classList.remove('sobre'); });
  zona.addEventListener('drop', (e) => { e.preventDefault(); const s = $('soltar'); if(s) s.classList.remove('sobre'); if(e.dataTransfer && e.dataTransfer.files) elegir(e.dataTransfer.files); });
  window.addEventListener('beforeunload', (e) => { if(ocupado){ e.preventDefault(); e.returnValue = ''; } });

  (async function(){
    yo = await S.requerir(['admin', 'analista']);
    if(!yo) return;
    window.Armazon.montar(yo, { activo: null, volver: { enlace: 'inicio.html', texto: 'Inicio' } });
    pintar();
    $('cargas').innerHTML = esqueleto(2);
    cargas();
  })();
})();
