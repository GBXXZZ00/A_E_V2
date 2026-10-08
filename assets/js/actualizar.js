// Actualizar datos: recibe varios archivos, reconoce cada uno por sus columnas y los carga por lotes.
(function(){
  'use strict';
  const { $, esc, rpc, toast, normalizeStr, fecha, hora, plural, esqueleto, cache } = window.Comun;
  const S = window.Sesion;
  const LOTE = 400;
  const COLUMNAS = { s: 'sucursal', c: 'cliente', t: 'tipo', d: 'documento', f: 'fecha_instalacion', n: 'nombre', e: 'equipo', p: 'plan', es: 'estado', ca: 'categoria', cx: 'cxcpendiente', te: 'telefono', di: 'direccion' };
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
    const primera = texto.slice(0, 3000);   // varias líneas: algunos reportes traen un título antes del encabezado
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

  // ---------- Excel (.xlsx) sin librerías: zip + XML leído por trozos, para que aguante archivos de cientos de MB ----------
  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  const sinEnt = (t) => t.indexOf('&') < 0 ? t : t.replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e.toLowerCase()]);
  const textoDe = (x) => { let t = ''; const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g; let m; while((m = re.exec(x))) t += m[1]; return sinEnt(t); };
  async function indiceZip(file){
    const cola = new Uint8Array(await file.slice(Math.max(0, file.size - 70000)).arrayBuffer()); const v = new DataView(cola.buffer);
    let fin = -1;
    for(let i = cola.length - 22; i >= 0; i--){ if(v.getUint32(i, true) === 0x06054b50){ fin = i; break; } }
    if(fin < 0) throw new Error('El Excel está dañado o no es .xlsx');
    const n = v.getUint16(fin + 10, true), tamDir = v.getUint32(fin + 12, true), ini = v.getUint32(fin + 16, true);
    if(ini === 0xFFFFFFFF) throw new Error('El Excel es demasiado grande. Guárdalo como CSV');
    const u = new Uint8Array(await file.slice(ini, ini + tamDir).arrayBuffer()); const d = new DataView(u.buffer); const dec = new TextDecoder('utf-8'); const dentro = {}; let pos = 0;
    for(let k = 0; k < n && pos + 46 <= u.length; k++){
      if(d.getUint32(pos, true) !== 0x02014b50) break;
      const ln = d.getUint16(pos + 28, true), le = d.getUint16(pos + 30, true), lc = d.getUint16(pos + 32, true);
      dentro[dec.decode(u.subarray(pos + 46, pos + 46 + ln))] = { metodo: d.getUint16(pos + 10, true), tam: d.getUint32(pos + 20, true), real: d.getUint32(pos + 24, true), loc: d.getUint32(pos + 42, true) };
      pos += 46 + ln + le + lc;
    }
    return dentro;
  }
  // Recorre una parte del zip como texto, trozo a trozo. alTrozo devuelve false para dejar de leer.
  async function recorrer(file, e, alTrozo){
    const cab = new DataView(await file.slice(e.loc, e.loc + 30).arrayBuffer());
    const ini = e.loc + 30 + cab.getUint16(26, true) + cab.getUint16(28, true);
    let st = file.slice(ini, ini + e.tam).stream();
    if(e.metodo === 8) st = st.pipeThrough(new DecompressionStream('deflate-raw'));
    else if(e.metodo !== 0) throw new Error('El Excel usa una compresión que no conozco. Guárdalo como CSV');
    const lector = st.pipeThrough(new TextDecoderStream('utf-8')).getReader();
    try {
      for(;;){ const r = await lector.read(); if(r.done) break; if(alTrozo(r.value) === false){ await lector.cancel().catch(() => {}); break; } }
    } finally { try { lector.releaseLock(); } catch (x) { /* ya liberado */ } }
  }
  async function leerXlsx(file, alFila, alAvance){
    if(typeof DecompressionStream === 'undefined' || typeof TextDecoderStream === 'undefined') throw new Error('Este navegador no abre Excel. Guárdalo como CSV');
    const dentro = await indiceZip(file);
    const hojas = Object.keys(dentro).filter((x) => /^xl\/worksheets\/sheet\d+\.xml$/.test(x)).sort((x, y) => parseInt(x.replace(/\D/g, ''), 10) - parseInt(y.replace(/\D/g, ''), 10));
    if(!hojas.length) throw new Error('El Excel no trae hojas');
    const hoja = dentro[hojas[0]]; const sst = dentro['xl/sharedStrings.xml'];
    const total = (hoja.real || 1) + (sst ? sst.real : 0); let leido = 0; let buf = '';
    const textos = [];
    if(sst){
      const re = /<si\/>|<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g;
      await recorrer(file, sst, (t) => {
        leido += t.length; buf += t; re.lastIndex = 0; let m; let hasta = 0;
        while((m = re.exec(buf))){ textos.push(m[1] ? textoDe(m[1].replace(/<rPh[\s\S]*?<\/rPh>/g, '')) : ''); hasta = re.lastIndex; }
        buf = buf.slice(hasta); alAvance(leido / total);
      });
    }
    buf = ''; let seguir = true;
    const reFila = /<row(?:\s[^>]*)?\/>|<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g;
    const reCelda = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    await recorrer(file, hoja, (t) => {
      leido += t.length; buf += t; reFila.lastIndex = 0; let m; let hasta = 0;
      while(seguir && (m = reFila.exec(buf))){
        hasta = reFila.lastIndex; if(!m[1]) continue;
        const fila = []; let sig = 0; let c; let hay = false; reCelda.lastIndex = 0;
        while((c = reCelda.exec(m[1]))){
          const at = c[1]; const r = /\br="([A-Z]+)\d*"/.exec(at); let col = sig;
          if(r){ col = 0; for(let q = 0; q < r[1].length; q++) col = col * 26 + (r[1].charCodeAt(q) - 64); col -= 1; }
          sig = col + 1; let val = '';
          if(c[2]){
            const tp = /\bt="([a-zA-Z]+)"/.exec(at); const tipo = tp ? tp[1] : '';
            if(tipo === 'inlineStr') val = textoDe(c[2]);
            else { const vv = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(c[2]); if(vv){ val = tipo === 's' ? (textos[+vv[1]] || '') : tipo === 'b' ? (vv[1] === '1' ? 'SI' : '') : sinEnt(vv[1]); } }
          }
          if(val !== ''){ while(fila.length < col) fila.push(''); fila[col] = val; hay = true; }
        }
        if(hay && alFila(fila) === false) seguir = false;
      }
      buf = buf.slice(hasta); alAvance(leido / total);
      return seguir;
    });
  }
  async function leerFilas(file, alFila, alAvance){
    if(/\.xlsx$/i.test(file.name)) return leerXlsx(file, alFila, alAvance);
    if(/\.xls$/i.test(file.name)) throw new Error('Es un Excel antiguo (.xls). Guárdalo como .xlsx o CSV');
    const filas = partirCsv(await leerTexto(file));
    for(let i = 0; i < filas.length; i++){
      if(alFila(filas[i]) === false) break;
      if(i % 20000 === 19999){ alAvance(i / filas.length); await new Promise((ok) => setTimeout(ok, 0)); }
    }
  }

  // ---------- Reconocer cada archivo por sus columnas ----------
  const TIPOS = {
    tad: { nombre: 'TAD', pide: ['sucursal', 'cliente', 'documento', 'nombre'] },
    instalaciones: { nombre: 'Órdenes de instalación', pide: ['codcliente', 'feccump', 'cedula'] },
    odoo: { nombre: 'Órdenes de Odoo', pide: ['etapa', 'cliente'], alguna: ['odt', 'cod_orden_de_trabajo'] },
    base_vieja: { nombre: 'Base de la app anterior', pide: ['razon_social', 'rif', 'estatus_legal'] }
  };
  const ORDEN = ['tad', 'base_vieja', 'odoo', 'instalaciones'];
  const clave = (h) => normalizeStr(h).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  function reconocer(cab){
    return ORDEN.find((t) => TIPOS[t].pide.every((c) => cab.indexOf(c) >= 0) && (!TIPOS[t].alguna || TIPOS[t].alguna.some((c) => cab.indexOf(c) >= 0))) || null;
  }
  const soloDoc = (v) => String(v || '').replace(/\D/g, '').replace(/^0+/, '');
  // Empresa: por categoría o plan del servicio, o porque el RIF ya es un cliente conocido.
  // Probado con el TAD completo del 08/10: recupera todos los servicios del TAD de empresas del 07/10.
  const CAT_EMP = /^(pyme|dedicado|conectividad)/; const PLAN_EMP = /(^oro-emp$|\d\s*[mg]bps$)/;
  const esEmpresa = (cat, plan, doc, conocidos) => CAT_EMP.test(normalizeStr(cat)) || PLAN_EMP.test(normalizeStr(plan)) || conocidos.has(doc);
  function fechaHora(v){   // número de fecha de Excel a texto
    const n = +v; const x = new Date(Date.UTC(1899, 11, 30) + Math.round(n * 86400000));
    return isNaN(x) ? v : x.toISOString().slice(0, n % 1 ? 19 : 10).replace('T', ' ');
  }
  async function preparar(file, conocidos, alAvance){
    let cab = null; let tipo = null; let vistas = 0; let total = 0; let malas = 0; let fuera = 0; let idx = null;
    let datos = []; let dudosas = []; const clientes = new Set(); let filtrando = false; const rifs = [];
    await leerFilas(file, (f) => {
      if(!cab){
        const c = f.map(clave); tipo = reconocer(c);
        if(tipo){ cab = c; if(tipo === 'tad'){ idx = {}; Object.keys(COLUMNAS).forEach((k) => { idx[k] = cab.indexOf(COLUMNAS[k]); }); } }
        else if(++vistas >= 6) return false;
        return true;
      }
      total++;
      if(tipo === 'tad'){
        const o = {};
        Object.keys(COLUMNAS).forEach((k) => { o[k] = idx[k] >= 0 ? limpio(f[idx[k]]) : ''; });
        o.f = fechaIso(o.f);
        const doc = soloDoc(o.d);
        if(!/^[1-9][0-9]{4,9}$/.test(doc) || !o.n || !/[1-9]/.test(o.s) || !/[1-9]/.test(o.c)){ malas++; return true; }
        if(!o.t) o.t = 'J';
        if(esEmpresa(o.ca, o.p, doc, conocidos)){ datos.push(o); clientes.add(doc); }
        else if(filtrando) fuera++;
        else { dudosas.push(o); if(datos.length + dudosas.length > TOPE_TAD){ filtrando = true; fuera += dudosas.length; dudosas = []; } }
        return true;
      }
      const o = {}; let hay = false;
      for(let j = 0; j < cab.length; j++){
        if(!cab[j]) continue; let v = limpio(f[j]); if(v === '') continue;
        if(/^\d{5}(\.\d+)?$/.test(v) && /fec|creado/.test(cab[j])) v = fechaHora(v);
        o[cab[j]] = v.slice(0, 2000); hay = true;
      }
      if(!hay){ total--; return true; }
      if(tipo === 'instalaciones' && !esEmpresa(o.categoria, o.profile, soloDoc(o.cedula), conocidos)){ fuera++; return true; }
      if(tipo === 'base_vieja'){ const r = soloDoc(o.rif); if(r) rifs.push(r); }
      datos.push(o);
      if(datos.length > 60000) throw new Error('Trae demasiadas filas. Expórtalo con menos fechas');
      return true;
    }, alAvance);
    if(!tipo) throw new Error('No reconozco este archivo por sus columnas');
    if(tipo === 'tad' && !filtrando){ dudosas.forEach((o) => { datos.push(o); clientes.add(soloDoc(o.d)); }); }   // un TAD ya filtrado entra completo
    if(datos.length > TOPE_TAD) throw new Error('Trae más de ' + TOPE_TAD.toLocaleString('es-VE') + ' filas de empresas. Avísame para revisarlo');
    if(!datos.length) throw new Error(total ? 'Ninguna fila es de empresas o se pudo leer' : 'El archivo no trae filas');
    rifs.forEach((r) => conocidos.add(r));
    return { tipo, datos, malas, fuera, clientes: clientes.size, total };
  }

  // ---------- Pantalla ----------
  const num = (n) => Number(n || 0).toLocaleString('es-VE');
  const ICO = '<svg class="i g" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M5 20h14"/></svg>';
  function detalle(a){
    if(a.error) return '<small style="color:var(--rojo)">' + esc(a.error) + '</small>';
    if(a.leyendo) return '<small>' + (a.espera ? 'En espera' : 'Leyendo' + (a.avance ? ' ' + a.avance + ' %' : '...')) + '</small>';
    if(a.resultado) return '<small>' + esc(a.resultado) + '</small>';
    if(a.tipo === 'tad') return '<small>' + num(a.datos.length) + ' servicios de ' + num(a.clientes) + ' clientes' + (a.fuera ? ' · ' + num(a.fuera) + ' residenciales quedan fuera' : '') + (a.malas ? ' · ' + plural(a.malas, 'fila', 'filas') + ' sin RIF, nombre o código' : '') + '</small>';
    return '<small>' + plural(a.datos.length, 'fila', 'filas') + (a.fuera ? ' de empresas · ' + num(a.fuera) + ' residenciales quedan fuera' : '') + '</small>';
  }
  function marca(a){
    if(a.error) return '<span class="m rojo">No sirve</span>';
    if(a.leyendo) return '<span class="m">' + (a.espera ? 'En espera' : 'Leyendo') + '</span>';
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
    if(ocupado) pie = '<p class="nota-chica">' + (lista.some((a) => a.leyendo) ? 'Leyendo los archivos. Los más pesados pueden tardar un par de minutos.' : 'No cierres esta pantalla hasta que termine.') + '</p>';
    else if(fin) pie = '<div class="aviso" style="margin-top:14px"><b>' + esc(fin.titulo) + '</b><p>' + esc(fin.texto) + '</p><p style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap"><a class="btn btn-chico" href="clientes.html?f=todos">Ver clientes</a><button type="button" class="btn btn-chico btn-2" id="otro">Subir otros</button></p></div>';
    else pie = '<div class="acc" style="margin-top:14px"><button type="button" class="btn btn-2" id="limpiar">Quitar todos</button>' + (buenos.length ? '<button type="button" class="btn" id="cargarTodo">Cargar ' + plural(buenos.length, 'archivo', 'archivos') + '</button>' : '') + '</div><p class="nota-chica">No borra nada. Agrega lo nuevo y actualiza lo que ya está.</p>';
    z.innerHTML = filas + (ocupado || fin ? '' : '<div style="margin-top:12px">' + soltar + '</div>') + pie;
  }
  let conocidos = null;
  async function elegir(files){
    if(ocupado || !files || !files.length) return;
    if(fin){ lista = []; fin = null; }
    // Los livianos primero: la base anterior le dice al TAD cuáles RIF son de empresas
    const nuevos = Array.prototype.slice.call(files, 0, 12).sort((x, y) => x.size - y.size).map((f) => ({ nombre: f.name, file: f, leyendo: true, espera: true }));
    lista = lista.concat(nuevos); ocupado = true; pintar();
    if(!conocidos){ try { conocidos = new Set(await rpc('clientes_rifs', {})); } catch (e) { conocidos = new Set(); } }
    for(const a of nuevos){
      a.espera = false; pintar();
      await new Promise((ok) => setTimeout(ok, 30));   // deja pintar antes de leer un archivo pesado
      let ultimo = 0;
      try {
        if(a.file.size > 200 * 1024 * 1024) throw new Error('Pesa más de 200 MB');
        const p = await preparar(a.file, conocidos, (parte) => { const ahora = Date.now(); if(ahora - ultimo > 400){ ultimo = ahora; a.avance = Math.min(99, Math.round(parte * 100)); pintar(); } });
        const rep = lista.find((x) => x !== a && x.tipo === p.tipo && x.datos && x.estado !== 'lista');
        if(rep){ a.tipo = p.tipo; throw new Error('Ya hay otro archivo de ' + TIPOS[p.tipo].nombre + ' en la lista'); }
        Object.assign(a, p);
      } catch (e) { a.error = e.message || 'No se pudo leer'; }
      a.leyendo = false; a.file = null; pintar();
    }
    ocupado = false; pintar();
    const malos = nuevos.filter((a) => a.error).length;
    if(malos) toast(plural(malos, 'archivo no se pudo usar', 'archivos no se pudieron usar') + '. Mira el motivo en la lista', 'error');
  }
  async function subir(a){
    a.estado = 'subiendo'; a.hecho = 0; pintar();
    const tad = a.tipo === 'tad'; const paso = tad ? LOTE : LOTE_CRUDO;
    const carga = tad ? await rpc('tad_iniciar', { p_archivo: a.nombre, p_total: a.datos.length + a.malas })
      : await rpc('crudo_iniciar', { p_fuente: a.tipo, p_archivo: a.nombre, p_total: a.datos.length });
    for(let i = 0; i < a.datos.length; i += paso){
      const lote = a.datos.slice(i, i + paso);
      if(tad){
        // El teléfono y la dirección viajan aparte para no engordar el lote principal
        await conReintento(() => rpc('tad_filas', { p_carga: carga, p_filas: lote.map((o) => { const c = Object.assign({}, o); delete c.te; delete c.di; return c; }) }));
        const con = lote.filter((o) => o.te || o.di).map((o) => ({ s: o.s, c: o.c, te: o.te, di: o.di }));
        if(con.length) await conReintento(() => rpc('tad_contactos', { p_carga: carga, p_filas: con }));
      } else await conReintento(() => rpc('crudo_filas', { p_carga: carga, p_filas: lote }));
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
      fin = { titulo: plural(cola.length, 'archivo cargado', 'archivos cargados'), texto: (total !== null ? 'Ahora hay ' + num(total) + ' clientes en total. ' : '') + 'Sigue con Revisar cruce, aquí abajo.' };
      cruce = null; pintarCruce();
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

  // ---------- Cruce: primero se prueba (no guarda nada) y después se aplica ----------
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const mesDe = (f) => MESES[parseInt(String(f).slice(5, 7), 10) - 1] || '';
  let cruce = null; let cruzando = false;
  const lin = (t, v) => '<div class="dato-f"><span>' + esc(t) + '</span><b>' + esc(v) + '</b></div>';
  function resumenCruce(r){
    const b = r.base, o = r.odoo, i = r.inst; let h = '<div class="datos" style="margin-top:0">';
    if(b.hay) h += lin('Base anterior', num(b.lider) + ' clientes reciben su líder, ' + num(b.estatus) + ' cambian de estatus legal y entran ' + num(b.contactos) + ' contactos. ' + num(b.sin_tad) + ' de esa base no están en el TAD.');
    if(o.hay) h += lin('Órdenes de Odoo', num(o.nuevas) + ' nuevas y ' + num(o.actualizadas) + ' actualizadas. ' + num(o.por_rif + o.por_nombre) + ' con cliente identificado (' + num(o.por_rif) + ' por RIF), ' + num(o.sin_cliente) + ' sin identificar. ' + num(o.abiertas) + ' por instalar.');
    if(i.hay) h += lin('Instalaciones', num(i.nuevas) + ' nuevas y ' + num(i.completadas) + ' completadas con su serial. ' + num(i.con_orden) + ' encuentran su orden, ' + num(i.por_confirmar) + ' por confirmar y ' + num(i.sin_orden) + ' sin orden. Sin orden confirmada no comisionan.') +
      lin('No entran', num(i.reemplazos) + ' reemplazos de equipo, ' + num(i.dedicados) + ' de dedicados, ' + num(i.residenciales) + ' residenciales sin orden del equipo y ' + num(i.antes_del_inicio) + ' de antes del 21/08.');
    h += lin('Comisiones de ' + mesDe(r.corte.mes), num(r.corte.del_corte) + ' del corte y ' + num(r.corte.filas - r.corte.del_corte) + ' que vienen del anterior. ' + num(r.corte.cumplen) + ' ya cumplen y ' + num(r.corte.por_asignar || 0) + ' quedan pendientes por asignar.');
    h += lin('Comisiones de ' + mesDe(r.anterior.mes), num(r.anterior.filas) + ' filas, ' + num(r.anterior.cumplen) + ' cumplen.');
    return h + '</div>';
  }
  function pintarCruce(){
    const z = $('cruce');
    if(cruzando){ z.innerHTML = esqueleto(2); return; }
    if(!cruce){ z.innerHTML = '<button type="button" class="btn" id="revisarCruce">Revisar cruce</button>'; return; }
    z.innerHTML = '<b style="font-size:15.5px">' + (cruce.aplicado ? 'Cruce aplicado' : 'Esto es lo que va a cambiar') + '</b><div style="margin-top:10px">' + resumenCruce(cruce.r) + '</div>' +
      (cruce.aplicado ? '<p style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap"><a class="btn btn-chico" href="comisiones.html">Ver comisiones</a><a class="btn btn-chico btn-2" href="clientes.html?f=todos">Ver clientes</a></p>'
        : '<div class="acc" style="margin-top:14px"><button type="button" class="btn btn-2" id="cancelarCruce">Ahora no</button><button type="button" class="btn" id="aplicarCruce">Aplicar cruce</button></div><p class="nota-chica">Todavía no se ha guardado nada.</p>');
  }
  async function correrCruce(aplicar){
    if(cruzando || ocupado) return;
    cruzando = true; pintarCruce();
    try {
      const r = await rpc(aplicar ? 'cruce_aplicar' : 'cruce_probar', {});
      cruce = { r, aplicado: aplicar };
      if(aplicar){ cache.borrarTodo(); toast('Cruce aplicado'); }
    } catch (e) { toast('No se pudo ' + (aplicar ? 'aplicar' : 'revisar') + ' el cruce. ' + e.message, 'error'); if(aplicar) cruce = null; }
    cruzando = false; pintarCruce();
  }

  document.addEventListener('click', (e) => {
    const t = e.target;
    if(t.closest('#soltar')){ if(ocupado) return; const i = $('archivos'); i.value = ''; i.click(); return; }
    if(t.closest('#limpiar') || t.closest('#otro')){ if(ocupado) return; lista = []; fin = null; pintar(); return; }
    if(t.closest('#cargarTodo')){ cargarTodo(); return; }
    if(t.closest('#revisarCruce')){ correrCruce(false); return; }
    if(t.closest('#aplicarCruce')){ correrCruce(true); return; }
    if(t.closest('#cancelarCruce')){ cruce = null; pintarCruce(); }
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
    pintar(); pintarCruce();
    $('cargas').innerHTML = esqueleto(2);
    cargas();
  })();
})();
