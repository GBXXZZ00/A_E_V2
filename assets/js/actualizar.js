// Actualizar datos: recibe varios archivos, reconoce cada uno por sus columnas y los carga por lotes.
(function(){
  'use strict';
  const { $, esc, ic, rpc, toast, normalizeStr, fecha, fechaDia, hora, plural, capital, esqueleto, cache } = window.Comun;
  const S = window.Sesion;
  const LOTE = 400;
  const COLUMNAS = { s: 'sucursal', c: 'cliente', t: 'tipo', d: 'documento', f: 'fecha_instalacion', n: 'nombre', e: 'equipo', p: 'plan', es: 'estado', ca: 'categoria', cx: 'cxcpendiente', te: 'telefono', di: 'direccion' };
  const LOTE_INDICE = 1500;   // lote 27/10: lotes más chicos del índice del TAD completo (solo las filas que cambiaron)
  const LOTE_COMPARAR = 10000; // claves y huellas que se comparan por llamada
  const OBLIGATORIAS = ['s', 'c', 'd', 'n'];
  const BASURA = ['nan', '#n/a', '#ref!', '#value!', 'null', 'undefined'];
  let yo = null; let lista = []; let ocupado = false; let fin = null; let corto = null;
  // Lote 05/11 G: el índice de residenciales corre aparte (fondo) y no bloquea la pantalla
  let fondo = null; let idxEstado = null;
  if(window.AE_ocupado) window.AE_ocupado(() => ocupado || !!fondo); // Lote S: no cerrar la sesión con una carga (o el índice) en curso
  const LOTE_BLOQUE = 1000; const LOTE_MARCAR = 100;
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
    const m = /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/.exec(v) || null;
    let a, me, d;
    // Lote 05/11 B1: también 2026/10/01, 2026.10.01 y 01-oct-2026 (así vienen algunas columnas de fechas del TAD)
    const n = /^(\d{1,2})[-\/. ]([a-záéíóú]{3,})[-\/. ,]+(\d{4})/i.exec(v);
    if(m){ d = +m[1]; me = +m[2]; a = +m[3]; }
    else if(n){ d = +n[1]; me = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'].indexOf(normalizeStr(n[2]).slice(0, 3)) + 1; if(!me) me = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(normalizeStr(n[2]).slice(0, 3)) + 1; if(!me) return ''; a = +n[3]; }
    else { const k = /^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/.exec(v); if(!k) return ''; a = +k[1]; me = +k[2]; d = +k[3]; }
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
  async function textoParte(file, e){ let t = ''; await recorrer(file, e, (x) => { t += x; }); return t; }
  // Nombres de las hojas y la parte del zip de cada una
  async function hojasXlsx(file){
    const dentro = await indiceZip(file); const wb = dentro['xl/workbook.xml']; const rel = dentro['xl/_rels/workbook.xml.rels'];
    if(!wb || !rel) return [];
    const tw = await textoParte(file, wb); const tr = await textoParte(file, rel); const destino = {};
    tr.replace(/<Relationship\b([^>]*)\/?>/g, (m, at) => { const id = /\bId="([^"]+)"/.exec(at); const t = /\bTarget="([^"]+)"/.exec(at); if(id && t) destino[id[1]] = t[1].replace(/^\/?(xl\/)?/, 'xl/'); return m; });
    const r = [];
    tw.replace(/<sheet\b([^>]*)\/?>/g, (m, at) => { const n = /\bname="([^"]*)"/.exec(at); const id = /\br:id="([^"]+)"/.exec(at); if(n && id && dentro[destino[id[1]]]) r.push({ nombre: sinEnt(n[1]), parte: dentro[destino[id[1]]] }); return m; });
    return r;
  }
  async function leerXlsx(file, alFila, alAvance, parteHoja){
    if(typeof DecompressionStream === 'undefined' || typeof TextDecoderStream === 'undefined') throw new Error('Este navegador no abre Excel. Guárdalo como CSV');
    const dentro = await indiceZip(file);
    const hojas = Object.keys(dentro).filter((x) => /^xl\/worksheets\/sheet\d+\.xml$/.test(x)).sort((x, y) => parseInt(x.replace(/\D/g, ''), 10) - parseInt(y.replace(/\D/g, ''), 10));
    if(!hojas.length) throw new Error('El Excel no trae hojas');
    const hoja = parteHoja || dentro[hojas[0]]; const sst = dentro['xl/sharedStrings.xml'];
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
    cambios: { nombre: 'Cambios de categoría', pide: ['codigo', 'categoria_anterior', 'categoria_actual'] },
    ip: { nombre: 'IP (Clientes Empresariales)', pide: ['sucursal', 'cliente', 'ont', 'ipv4'] },
    instalaciones: { nombre: 'Órdenes de instalación', pide: ['codcliente', 'feccump', 'cedula'] },
    odoo: { nombre: 'Órdenes de Odoo', pide: ['etapa', 'cliente'], alguna: ['odt', 'cod_orden_de_trabajo'] },
    base_vieja: { nombre: 'Base de la app anterior', pide: ['razon_social', 'rif', 'estatus_legal'] },
    dedicados: { nombre: 'Dedicados (archivo de la analista)', pide: ['__por_hojas__'] }
  };
  const ORDEN = ['tad', 'cambios', 'ip', 'base_vieja', 'odoo', 'instalaciones', 'dedicados'];
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
  // Archivo de dedicados de la analista: tres hojas, se suben tal cual (encabezado y filas) y el servidor las cruza
  const HOJAS_DED = [['RESUMEN (enlaces)', /enlace/], ['RESUMEN (clientes y contactos)', /client/], ['base de contacto', /base.*contact|contacto$/]];
  async function prepararDedicados(file, hojas, alAvance){
    if(!yo || yo.rol !== 'admin') throw new Error('Solo el administrador sube el archivo de dedicados');
    const out = {}; let total = 0; let k = 0;
    for(const [canon, re] of HOJAS_DED){
      const h = hojas.find((x) => re.test(normalizeStr(x.nombre))); if(!h) continue;
      let cols = null; const filas = [];
      await leerXlsx(file, (f) => {
        const v = f.map((x) => limpio(x));
        if(!cols){ if(v.filter(Boolean).length >= 3 && v.some((x) => /^(rif|cod)/i.test(normalizeStr(x)))) cols = v.map((x, j) => x || 'col' + j); return true; }
        if(!v.some(Boolean)) return true;
        filas.push(v.map((x, j) => (x && /^\d{5}(\.\d+)?$/.test(x) && /fecha/i.test(cols[j] || '') ? fechaHora(x) : x || null)));
        return filas.length < 5000;
      }, (p) => alAvance((k + p) / HOJAS_DED.length), h.parte);
      k++;
      if(cols && filas.length){ out[canon] = { cols, filas }; total += filas.length; }
    }
    if(!out['RESUMEN (enlaces)'] || !out['RESUMEN (clientes y contactos)']) throw new Error('No encuentro las hojas de enlaces y de clientes de la analista');
    return { tipo: 'dedicados', hojas: out, datos: [].concat(out['RESUMEN (clientes y contactos)'].filas), enlaces: out['RESUMEN (enlaces)'].filas.length, malas: 0, fuera: 0, clientes: out['RESUMEN (clientes y contactos)'].filas.length, total };
  }
  async function preparar(file, conocidos, alAvance){
    if(/\.xlsx$/i.test(file.name)){
      const hojas = await hojasXlsx(file).catch(() => []);
      if(hojas.some((h) => /enlace/.test(normalizeStr(h.nombre))) && hojas.some((h) => /client/.test(normalizeStr(h.nombre)))) return prepararDedicados(file, hojas, alAvance);
    }
    let cab = null; let tipo = null; let vistas = 0; let total = 0; let malas = 0; let fuera = 0; let idx = null;
    let datos = []; let dudosas = []; const clientes = new Set(); let filtrando = false; const rifs = []; let desde = ''; const indice = []; let iPon = -1; let colsFechas = null;
    await leerFilas(file, (f) => {
      if(!cab){
        const c = f.map(clave); tipo = reconocer(c);
        if(tipo){ cab = c; if(tipo === 'tad'){ idx = {}; Object.keys(COLUMNAS).forEach((k) => { idx[k] = cab.indexOf(COLUMNAS[k]); }); iPon = cab.indexOf('pon') >= 0 ? cab.indexOf('pon') : cab.findIndex((h) => /(^|_)pon(_|$)/.test(h));
          // Lote 28/10: última suspensión, última habilitación y estatus actual, si el TAD los trae (los nombres cambian: se buscan por palabra)
          // Lote 05/11 B1: más nombres posibles (suspensión también se llama "corte"; habilitación, "reconexión" o "activación")
          const libre = (h) => h !== COLUMNAS.es && h !== COLUMNAS.f;
          // Lote 10/11 A1: el TAD real trae ULTSUPENSION (sin la primera "s") y ULTACTIVACION (pegada); 01-01-1900 = nunca (fechaIso lo deja vacío)
          const SUSP = /sus?pen|susp/;
          idx.us = cab.findIndex((h) => SUSP.test(h) && /fec|ult|^sus?pension$/.test(h)); if(idx.us < 0) idx.us = cab.findIndex((h) => SUSP.test(h) && libre(h));
          if(idx.us < 0) idx.us = cab.findIndex((h) => /(^|_)(fec\w*|ult\w*)_corte|corte_(fec|ult)/.test(h) && libre(h));
          idx.uh = cab.findIndex((h) => /habilit|reactiv|reconex/.test(h) && libre(h));
          if(idx.uh < 0) idx.uh = cab.findIndex((h) => /(fec\w*|ult\w*)_activ|^ult_?activ/.test(h) && libre(h));
          idx.ea = cab.findIndex((h) => /(status|estatus|estado)_actual/.test(h)); if(idx.ea < 0) idx.ea = cab.findIndex((h) => h === 'status' || h === 'estatus');
          colsFechas = { suspension: idx.us >= 0 ? cab[idx.us] : null, habilitacion: idx.uh >= 0 ? cab[idx.uh] : null, estatus_actual: idx.ea >= 0 ? cab[idx.ea] : null }; } }
        else if(++vistas >= 6) return false;
        return true;
      }
      total++;
      if(tipo === 'tad'){
        const o = {};
        Object.keys(COLUMNAS).forEach((k) => { o[k] = idx[k] >= 0 ? limpio(f[idx[k]]) : ''; });
        o.f = fechaIso(o.f);
        if(idx.us >= 0){ const v = fechaIso(limpio(f[idx.us])); if(v) o.us = v; }
        if(idx.uh >= 0){ const v = fechaIso(limpio(f[idx.uh])); if(v) o.uh = v; }
        if(idx.ea >= 0){ const v = limpio(f[idx.ea]); if(v) o.ea = v.slice(0, 60); }
        const doc = soloDoc(o.d);
        if(/[1-9]/.test(o.s) && /[1-9]/.test(o.c)) indice.push({ s: o.s, c: o.c, e: o.e, t: o.t, d: o.d, n: o.n, p: o.p, ca: o.ca, es: o.es, di: o.di, pon: iPon >= 0 ? limpio(f[iPon]) : '' });
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
      if(tipo === 'cambios' && !o.codigo){ total--; return true; }
      // Lote 10/11 A3: las IP libres (sin cliente) también se mandan, solo con su IP, para proponer la siguiente del pool
      if(tipo === 'ip' && /^disponible$/i.test(o.estado || '')){ fuera++; datos.push({ estado: 'DISPONIBLE', ipv4: o.ipv4 || '', ipv6: o.ipv6 || '' }); return true; }
      if(tipo === 'instalaciones' && !esEmpresa(o.categoria, o.profile, soloDoc(o.cedula), conocidos)){ fuera++; return true; }
      if(tipo === 'instalaciones' && /^\d{4}-\d\d-\d\d/.test(o.feccump || '') && (!desde || o.feccump < desde)) desde = o.feccump.slice(0, 10);
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
    // Órdenes de instalación con fechas de antes del período de comisiones: es el histórico para aliados (no entra al cruce)
    const soloAliados = tipo === 'instalaciones' && !!desde && desde < INICIO_COMISIONES;
    return { tipo, datos, malas, fuera, clientes: clientes.size, total, desde, soloAliados, indice: tipo === 'tad' ? indice : null, colsFechas };
  }
  const INICIO_COMISIONES = '2026-08-21';

  // ---------- Pantalla ----------
  const num = (n) => Number(n || 0).toLocaleString('es-VE');
  const ICO = '<svg class="i g" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M5 20h14"/></svg>';
  // ---------- Lote 10/11 B: "Subir lo del día". Una fila por archivo: Leído → Cruzado → Listo, sin botones de cargar ni de cruzar ----------
  const FILAS_DIA = [['tad', 'TAD'], ['indice', 'Índice de residenciales'], ['ip', 'IP (Clientes Empresariales)'], ['odoo', 'Odoo'], ['instalaciones', 'Órdenes de instalación'], ['dedicados', 'Dedicados']];
  const CRUDOS = ['odoo', 'instalaciones', 'base_vieja'];
  let estadoAct = null;   // última respuesta de actualizar_estado
  const hoyIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });
  const pill = (t, c) => '<span class="chip ' + (c || '') + '">' + esc(t) + '</span>';
  const pasos = (l, c, k) => '<span class="sd-pasos">' + pill('Leído', l) + pill('Cruzado', c) + pill('Listo', k) + '</span>';
  // Lote 12/11 B (maqueta 8a): cada archivo con su barra: se llena con el %, corre de lado mientras lee sin % y queda verde al terminar
  const barra = (pct, cls, txt, giro) => '<span class="sd-barra2' + (cls || '') + '"><span class="sd-pista"><i style="transform:scaleX(' + Math.max(0, Math.min(1, pct || 0)).toFixed(3) + ')"></i></span><small>' + (giro ? '<i class="sd-giro" aria-hidden="true"></i>' : '') + esc(txt) + '</small></span>';
  function cargaHoy(fuente){
    const g = ((estadoAct && estadoAct.historial) || []).find((x) => x.fecha === hoyIso());
    return g ? g.cargas.find((c) => c.fuente === fuente && !(c.resumen || {}).solo_aliados) || null : null;
  }
  const fuenteDe = (k) => ((estadoAct && estadoAct.fuentes) || []).find((x) => x.k === k) || null;
  // Números de una carga ya guardada (historial)
  function numerosCarga(c){
    const r = c.resumen || {};
    if(c.fuente === 'tad') return [num(c.filas) + ' servicios' + (r.servicios_nuevos ? ' · ' + num(r.servicios_nuevos) + ' nuevos' : ''), 'Fechas de suspensión y activación: ' + num(r.con_fechas || 0) + ' leídas' + (r.columnas_fechas && (r.columnas_fechas.suspension || r.columnas_fechas.habilitacion) ? ' (' + [r.columnas_fechas.suspension, r.columnas_fechas.habilitacion].filter(Boolean).join(' y ').toUpperCase() + ')' : '')];
    if(c.fuente === 'ip') return [num(r.cuadran || 0) + ' en su servicio' + (r.llenadas ? ' · ' + num(r.llenadas) + ' IP nuevas' : ''), r.disponibles ? num(r.disponibles) + ' IP del pool sin cliente guardadas para proponerlas a mano' : 'Llena la IP de los servicios que cuadran'];
    if(c.fuente === 'dedicados') return [plural(c.filas || 0, 'fila', 'filas'), 'Aplicado al subir'];
    return [plural(c.filas || 0, 'fila', 'filas'), estadoAct && estadoAct.cruce_pendiente ? 'Falta cruzar: se cruza solo' : (r.solo_aliados ? 'Solo para aliados, no toca comisiones' : 'Cruzado')];
  }
  // Una fila de la tabla: { k, nombre, archivo, avance, titulo, detalle, clase, acciones }
  function filaHtml(f){
    return '<div class="sd-f' + (f.clase ? ' ' + f.clase : '') + '" data-k="' + esc(f.k) + '"><span class="sd-a"><b>' + esc(f.nombre) + '</b><small>' + esc(f.archivo || '') + '</small></span>' +
      '<span class="sd-av">' + f.avance + '</span><span class="sd-r"><b>' + esc(f.titulo || '') + '</b>' + (f.detalle ? '<small>' + f.detalle + '</small>' : '') + '</span>' +
      (f.acciones ? '<span class="sd-acc">' + f.acciones + '</span>' : '') + '</div>';
  }
  function filaArchivo(a, k, nombre){
    const i = lista.indexOf(a); const base = { k, nombre: nombre || (a.tipo ? TIPOS[a.tipo].nombre : 'Sin reconocer'), archivo: a.nombre };
    if(a.error) return Object.assign(base, { clase: 'rojo', avance: pill(a.tipo ? 'Leído' : 'No se reconoce', a.tipo ? 'verde' : 'rojo') + (a.tipo ? pill('No se cruzó', 'rojo') : ''), titulo: a.error,
      detalle: esc(a.tipo ? 'Descárgalo otra vez del sistema con todas las columnas y suéltalo aquí.' : 'Revisa que sea el archivo correcto (TAD, IP, Odoo, Instalaciones o Dedicados) y suéltalo otra vez.'), acciones: '<button type="button" class="btn btn-chico btn-2" data-quitar="' + i + '">Quitar</button>' });
    if(a.leyendo) return Object.assign(base, { avance: barra((a.avance || 0) / 100, a.avance || a.espera ? '' : ' ind', a.espera ? 'En espera' : 'Leyendo el archivo' + (a.avance ? ' · ' + a.avance + ' %' : ''), !a.espera), titulo: a.espera ? 'Va después del anterior' : 'Leyendo el archivo', detalle: esc('Los más pesados pueden tardar un par de minutos.') });
    if(a.pregunta) return Object.assign(base, { clase: 'ambar', avance: barra(1, ' ok', 'Leído'), titulo: 'Va solo a Aliados (fechas de antes del 21/08)',
      detalle: esc('Es el histórico de instalaciones por mes. No entra al cruce ni toca comisiones.'), acciones: '<button type="button" class="btn btn-chico" data-ok-para="' + i + '">Así está bien</button><button type="button" class="btn btn-chico btn-2" data-para="' + i + '">Usarlo para comisiones</button>' });
    if(a.estado === 'fallo') return Object.assign(base, { clase: 'rojo', avance: pasos('verde', 'rojo', '').replace('>Cruzado<', '>Se detuvo<'), titulo: 'La carga se detuvo', detalle: esc((a.falla || '') + ' Vuelve a intentarlo: no se duplica nada.'), acciones: '<button type="button" class="btn btn-chico" data-reintentar="1">Reintentar</button>' });
    if(a.estado === 'subiendo'){ const pc = Math.round((a.hecho || 0) * 100 / Math.max(1, a.fase ? (a.totalIdx || (a.indice || []).length) : (a.datos || []).length));
      return Object.assign(base, { avance: barra(pc / 100, '', (a.fase || 'Subiendo') + ' · ' + pc + ' %', true), titulo: 'Subiendo', detalle: esc('No cierres esta pantalla hasta que termine.') }); }
    if(a.estado === 'lista'){
      const crudo = CRUDOS.indexOf(a.tipo) >= 0 && !a.soloAliados; const t = String(a.resultado || '').split(' · ');
      if(crudo && cruzando) return Object.assign(base, { avance: barra(1, ' ind', 'Cruzando', true), titulo: t[0], detalle: esc('Uniendo órdenes, instalaciones y líderes.') });
      if(crudo && cruceFallo) return Object.assign(base, { clase: 'rojo', avance: pill('Leído', 'verde') + pill('No se cruzó', 'rojo'), titulo: 'No se pudo cruzar', detalle: esc(cruceFallo + '. Vuelve a intentarlo.'), acciones: '<button type="button" class="btn btn-chico" data-recruzar="1">Cruzar otra vez</button>' });
      if(a.tipo === 'tad' && a.sinFechas) return Object.assign(base, { clase: 'rojo', avance: pill('Leído', 'verde') + pill('Cruzado', 'verde') + pill('Sin fechas', 'rojo'), titulo: t[0], detalle: (t.length > 1 ? esc(t.slice(1).join(' · ')) + '. ' : '') + avisoSinFechas(a.colsFechas).replace(/^<small[^>]*>|<\/small>$/g, '') });
      return Object.assign(base, { listo: true, avance: barra(1, ' ok', a.soloAliados ? 'Listo · solo aliados' : crudo ? 'Listo · cruzado' : 'Listo'), titulo: t[0], detalle: esc(t.slice(1).join(' · ') || (a.soloAliados ? 'Solo para aliados, no toca comisiones' : '')) });
    }
    // Leído, esperando su turno
    return Object.assign(base, { avance: barra(0, '', 'Leído · en espera'), titulo: detalleTexto(a), detalle: esc('Se sube y se cruza solo.') });
  }
  function detalleTexto(a){
    if(a.tipo === 'tad') return num(a.datos.length) + ' servicios de ' + num(a.clientes) + ' clientes' + (a.fuera ? ' · ' + num(a.fuera) + ' residenciales quedan fuera' : '');
    if(a.tipo === 'ip') return plural(a.datos.length - (a.fuera || 0), 'IP asignada', 'IP asignadas') + (a.fuera ? ' · ' + num(a.fuera) + ' disponibles' : '');
    if(a.tipo === 'dedicados') return plural(a.clientes, 'cliente', 'clientes') + ' y ' + plural(a.enlaces, 'enlace', 'enlaces');
    if(a.tipo === 'cambios') return plural(a.datos.length, 'cambio', 'cambios');
    return plural(a.datos.length, 'fila', 'filas') + (a.desde ? ' · desde el ' + fecha(a.desde) : '');
  }
  function filaIndiceDia(){
    const base = { k: 'indice', nombre: 'Índice de residenciales', archivo: 'Del mismo TAD' };
    const conTad = lista.find((a) => a.tipo === 'tad' && a.indice);
    if(fondo) return Object.assign(base, { avance: '<span class="sd-barra"><span class="idx-pista"><i style="transform:scaleX(' + (pctIdx(fondo.a) / 100) + ')"></i></span><small>' + pctIdx(fondo.a) + ' % · en segundo plano</small></span>',
      titulo: 'No tienes que hacer nada', detalle: esc('Sirve para saber si un RIF ya es cliente residencial. Puedes seguir usando la app y subir otros archivos. Si cierras esta pestaña se pausa.'),
      acciones: '<button type="button" class="btn btn-chico btn-2" data-saltar-indice="1">Saltar el índice hoy</button>' });
    if(conTad && conTad.indiceFallo) return Object.assign(base, { clase: 'ambar', avance: pill('Índice a medias', 'ambar'), titulo: 'Quedó a medias (' + pctIdx(conTad) + ' %)', detalle: esc('Comisiones y clientes ya usan este TAD; falta el índice para Migraciones y la búsqueda de servicios.'),
      acciones: '<button type="button" class="btn btn-chico" data-seguir="' + lista.indexOf(conTad) + '">Seguir con el índice</button>' });
    // Hoy no tocaba: se puede forzar (antes era la casilla "Actualizar también el índice")
    if(conTad && !conTad.conIndice && !conTad.indiceFallo) return Object.assign(base, { avance: pill('Hoy no toca', ''), titulo: 'Hoy no se actualiza', detalle: esc(textoToca()),
      acciones: '<button type="button" class="btn btn-chico btn-2" data-forzar-indice="' + lista.indexOf(conTad) + '">Actualizar el índice igual</button>' });
    if(conTad && conTad.conIndice && conTad.estado !== 'lista') return Object.assign(base, { avance: pill('Después del TAD', ''), titulo: 'Se actualiza solo después del TAD', detalle: esc(textoToca()), acciones: '<button type="button" class="btn btn-chico btn-2" data-saltar-indice="1">Saltar el índice hoy</button>' });
    const ab = idxEstado && idxEstado.abierta;
    if(ab){
      const t = lista.find((a) => a.tipo === 'tad' && a.indice && ab.archivo === a.nombre.slice(0, 200) && ab.total === a.indice.length);
      return Object.assign(base, { clase: 'ambar', avance: pill('A medias', 'ambar'), titulo: 'Quedó en ' + Math.round(ab.filas * 100 / Math.max(1, ab.total)) + ' %', detalle: esc(t ? 'Es el mismo TAD: puedes seguir solo con el índice.' : 'Suelta el mismo TAD para seguir donde quedó.'),
        acciones: t ? '<button type="button" class="btn btn-chico" data-solo-indice="' + lista.indexOf(t) + '">Seguir solo con el índice</button>' : '' });
    }
    if(!idxEstado) return Object.assign(base, { avance: pill('Sin datos', ''), titulo: 'Una vez por semana', detalle: '' });
    return Object.assign(base, { avance: idxEstado.toca ? pill('Toca hoy', 'ambar') : barra(1, ' ok', 'Al día'), titulo: idxEstado.toca ? 'Toca hoy: se actualiza solo al subir el TAD' : 'Al día',
      detalle: esc(idxEstado.ultima ? 'Último: ' + fecha(idxEstado.ultima) + '. Sirve para saber si un RIF ya es cliente residencial.' : 'Nunca se ha cargado.') });
  }
  function filaSinArchivo(k, nombre){
    const c = cargaHoy(k); const f = fuenteDe(k); const base = { k, nombre };
    if(c && c.estado === 'fallo') return Object.assign(base, { clase: 'rojo', archivo: c.archivo, avance: pill('No terminó', 'rojo'), titulo: 'La carga de hoy no terminó', detalle: esc('Suelta el archivo otra vez: no se duplica nada.') });
    if(c){
      const n = numerosCarga(c); const pend = CRUDOS.indexOf(k) >= 0 && !!(estadoAct && estadoAct.cruce_pendiente);
      if(k === 'tad' && (c.resumen || {}).con_fechas === 0) return Object.assign(base, { clase: 'rojo', archivo: c.archivo, avance: pill('Leído', 'verde') + pill('Cruzado', 'verde') + pill('Sin fechas', 'rojo'), titulo: n[0], detalle: esc('No trajo fechas de suspensión ni de activación. Pide el TAD con esas columnas.') });
      return Object.assign(base, { listo: !pend, archivo: c.archivo, avance: pend ? barra(1, cruzando ? ' ind' : '', cruzando ? 'Cruzando' : 'Leído · falta cruzar', cruzando) : barra(1, ' ok', CRUDOS.indexOf(k) >= 0 ? 'Listo · cruzado' : 'Listo'), titulo: n[0], detalle: esc(pend && cruzando ? 'Cruzando…' : n[1]) });
    }
    const diaria = f && f.frecuencia === 'diaria';
    if(diaria && !f.al_dia) return Object.assign(base, { clase: 'falta', archivo: f.ultima ? 'Último: ' + fecha(f.ultima).replace(/ de \d{4}$/, '') : 'Nunca se ha subido', avance: pill('Sin subir', ''), titulo: 'Falta el de hoy', detalle: esc(FREC.diaria) });
    return Object.assign(base, { archivo: f && f.ultima ? 'Último: ' + fecha(f.ultima).replace(/ de \d{4}$/, '') : 'Sin cargas', avance: pill(diaria ? 'Al día' : 'Sin subir', diaria ? 'verde' : ''), titulo: diaria ? 'Al día' : 'Opcional', detalle: esc(diaria ? FREC.diaria : 'Solo cuando haya archivo nuevo') });
  }
  function pintar(){
    const z = $('zona');
    const act = lista.filter((a) => a.leyendo || a.estado === 'subiendo').length;
    z.innerHTML = (act ? '<button type="button" class="soltar sd-soltar sd-subiendo" id="soltar"><i class="sd-giro g" aria-hidden="true"></i><span><b>' + esc(act === 1 ? 'Subiendo 1 archivo' : 'Subiendo ' + act + ' archivos') + '</b>Puedes seguir usando la app. Si cierras la pestaña, se pausa.</span></button>'
      : '<button type="button" class="soltar sd-soltar" id="soltar">' + ICO + '<span><b>Suelta aquí el TAD, Clientes Empresariales (IP), Odoo, Órdenes de instalación y Dedicados</b>Puedes soltarlos todos a la vez. No importa el orden. También el mapa de red (KMZ).</span><span class="btn btn-2 btn-chico sd-elegir">Elegir archivos</span></button>') +
      (corto ? '<div class="al-banda ambar" role="alert" style="margin-top:14px"><b>El TAD parece incompleto</b><p>' + esc(corto.texto) + '. Si estás seguro de que está completo, cárgalo igual.</p>' +
        '<p style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="btn btn-chico btn-2" id="limpiar">Quitar todos</button><button type="button" class="btn btn-chico" id="cargarCorto">Cargar igual</button></p></div>' : '');
    const usados = new Set(); const filas = [];
    FILAS_DIA.forEach(([k, nombre]) => {
      if(k === 'indice'){ filas.push(filaIndiceDia()); return; }
      const a = lista.slice().reverse().find((x) => x.tipo === k && !x.soloAliados && !usados.has(x));
      if(a){ usados.add(a); filas.push(filaArchivo(a, k, nombre)); }
      else filas.push(filaSinArchivo(k, nombre));
    });
    // Lo demás que se soltó (cambios de categoría, base anterior, instalaciones para aliados, archivos que no se reconocen)
    lista.filter((a) => !usados.has(a)).forEach((a) => filas.push(filaArchivo(a, a.tipo || 'otro')));
    const req = filas.filter((f) => ['tad', 'odoo', 'instalaciones'].indexOf(f.k) >= 0 || (f.k === 'ip' && cargaHoy('ip')));
    const listos = req.filter((f) => f.listo).length;
    const chip = $('hoyChip'); if(chip){ chip.textContent = 'Hoy, ' + hoyIso().slice(8, 10) + '/' + hoyIso().slice(5, 7) + ' · ' + listos + ' de ' + req.length + ' listos'; chip.className = 'chip ' + (listos === req.length ? 'verde' : 'ambar'); }
    const d = $('dia');
    d.innerHTML = '<div class="sd-cab" aria-hidden="true"><span>Archivo</span><span>Avance</span><span>Resultado</span></div>' + filas.map(filaHtml).join('');
    d.dataset.estado = ocupado || cruzando || lista.some((a) => a.leyendo || a.estado === 'subiendo') ? 'ocupado' : 'listo';
  }
  // Lote 05/11 B1: un TAD sin fechas de suspensión ni habilitación no se da por bueno (churn y calidad dependen de ellas)
  function avisoSinFechas(cf){
    const c = cf || {}; const vistas = [c.suspension, c.habilitacion].filter(Boolean);
    return '<small class="para-que" style="color:var(--rojo)"><b>Este TAD no trajo fechas de suspensión ni de habilitación.</b> ' + esc(vistas.length ? 'Se leyeron las columnas ' + vistas.join(' y ') + ', pero vinieron vacías o con un formato que no se entiende.' : 'No se encontró ninguna columna con esos nombres.') + ' Pide el TAD con esas columnas; mientras tanto churn y calidad siguen escondidos.</small>';
  }
  const pctIdx = (a) => Math.min(100, Math.round((a.hecho || 0) * 100 / Math.max(1, a.totalIdx || (a.indice || []).length)));
  function textoToca(){
    const x = idxEstado; if(!x) return 'Una vez por semana o cuando haya migraciones esperando el TAD.';
    const ult = x.ultima ? 'Último índice: ' + fecha(x.ultima) + '. ' : 'Nunca se ha cargado. ';
    return ult + (x.esperan ? plural(x.esperan, 'migración espera', 'migraciones esperan') + ' la confirmación del TAD.' : x.toca ? 'Ya pasó una semana.' : 'Hoy no hace falta: toca una vez por semana.');
  }
  let conocidos = null;
  async function elegir(files){
    if(!files || !files.length) return;
    // El mapa de red (KMZ) va a su propio panel
    const todos = Array.prototype.slice.call(files); const M = window.MapaRed;
    if(M){ const mapas = todos.filter(M.esMapa); if(mapas.length){ M.recibir(mapas[0]); files = todos.filter((f) => !M.esMapa(f)); if(!files.length) return; } }
    if(ocupado) return;
    // Lote 10/11 B: lo ya terminado sale de la lista (su fila se ve con la carga de hoy); se queda lo pendiente, lo que falló y el índice en curso
    lista = lista.filter((x) => (fondo && x === fondo.a) || x.pregunta || x.estado === 'fallo' || x.leyendo || (x.datos && x.estado !== 'lista') || (x.tipo === 'tad' && x.indiceFallo && x.indice)); fin = null;
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
        const rep = lista.find((x) => x !== a && x.tipo === p.tipo && !!x.soloAliados === !!p.soloAliados && x.datos && x.estado !== 'lista');
        if(rep){ a.tipo = p.tipo; throw new Error('Ya hay otro archivo de ' + TIPOS[p.tipo].nombre + ' en la lista'); }
        Object.assign(a, p);
        if(a.tipo === 'tad') a.conIndice = !idxEstado || !!idxEstado.toca;
        if(a.soloAliados) a.pregunta = true;   // Lote 10/11 B: se confirma en su fila antes de subirlo
      } catch (e) { a.error = e.message || 'No se pudo leer'; }
      a.leyendo = false; a.file = null; pintar();
    }
    ocupado = false; pintar();
    const malos = nuevos.filter((a) => a.error).length;
    if(malos) toast(plural(malos, 'archivo no se pudo usar', 'archivos no se pudieron usar') + '. Mira el motivo en su fila', 'error');
    // Lote 10/11 B: sin botón de cargar: lo leído se sube y se cruza solo
    if(!corto) cargarTodo();
  }
  async function subirDedicados(a){
    a.estado = 'subiendo'; a.hecho = 0; pintar();
    const carga = await rpc('dedicados_iniciar', { p_archivo: a.nombre }); const tot = Object.keys(a.hojas).reduce((s, h) => s + a.hojas[h].filas.length, 0); let hecho = 0;
    for(const h of Object.keys(a.hojas)){
      const x = a.hojas[h];
      for(let i = 0, parte = 1; i < x.filas.length; i += LOTE_CRUDO, parte++){
        await conReintento(() => rpc('dedicados_parte', { p_carga: carga, p_hoja: h, p_parte: parte, p_cols: x.cols, p_filas: x.filas.slice(i, i + LOTE_CRUDO) }));
        hecho += Math.min(LOTE_CRUDO, x.filas.length - i); a.hecho = Math.round(hecho * a.datos.length / Math.max(1, tot)); pintar();
      }
    }
    const r = await rpc('dedicados_cerrar', { p_carga: carga });
    a.estado = 'lista'; a.hojas = null; a.datos = null;
    a.resultado = plural(r.dedicados, 'dedicado', 'dedicados') + ' · ' + plural(r.nuevos, 'cliente nuevo', 'clientes nuevos') + ' · ' + plural(r.enlaces, 'enlace', 'enlaces') + (r.verificar ? ' · ' + r.verificar + ' por verificar' : '');
    return r;
  }
  // Índice del TAD completo (lote 27/10): se comparan clave y huella y solo suben las filas que cambiaron.
  // Si se corta, la misma carga retoma donde quedó (lo ya subido tiene la huella al día y no se repite).
  function huella(o){
    const t = [o.s, o.c, o.e, o.t, o.d, o.n, o.p, o.ca, o.es, o.di, o.pon].map((v) => v == null ? '' : String(v)).join('\u0001');
    let h1 = 0x811c9dc5, h2 = 5381;
    for(let i = 0; i < t.length; i++){ const c = t.charCodeAt(i); h1 = Math.imul(h1 ^ c, 0x01000193); h2 = (Math.imul(h2, 33) + c) | 0; }
    return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36) + t.length.toString(36);
  }
  // Lote 05/11 G: la misma clave que arma el servidor (privado.tad_claves_u + equipo_norm)
  const bt = (v) => String(v == null ? '' : v).replace(/^ +| +$/g, '');
  const claveIdx = (o) => bt(o.s) + '-' + bt(o.c).replace(/^0+/, '') + '-' + bt(o.e).toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^HWTC/, '48575443');
  async function sha256(t){ const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)); return Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join(''); }
  // Comparación por bloques: se ordena por clave y se manda la huella de cada bloque de 1.000 filas en UNA llamada.
  // Los bloques iguales solo se marcan como vistos; los distintos se comparan fila por fila como antes.
  async function subirIndice(a){
    if(!a.indice || !a.indice.length) return null;
    a.fase = 'Índice'; a.hecho = 0; a.indiceFallo = null; const t0 = Date.now(); pintar();
    const k = await rpc('tad_indice_iniciar', { p_archivo: a.nombre, p_total: a.indice.length });
    const primera = new Map();
    a.indice.forEach((o, i) => { if(!o.h) o.h = huella(o); const c = claveIdx(o); if(!primera.has(c)) primera.set(c, i); });
    const claves = Array.from(primera.keys()).sort((x, y) => x < y ? -1 : x > y ? 1 : 0);
    a.totalIdx = claves.length;
    let distintas = []; let bloques = null;
    if(window.crypto && crypto.subtle){
      bloques = [];
      for(let i = 0; i < claves.length; i += LOTE_BLOQUE){
        const parte = claves.slice(i, i + LOTE_BLOQUE);
        bloques.push({ a: parte[0], z: parte[parte.length - 1], h: await sha256(parte.map((c) => c + ':' + a.indice[primera.get(c)].h).join('\n')), filas: parte.map((c) => primera.get(c)) });
      }
      const dif = new Set(await conReintento(() => rpc('tad_indice_bloques', { p_carga: k, p_bloques: bloques.map((b) => ({ a: b.a, z: b.z, h: b.h })) })) || []);
      const iguales = bloques.filter((b, i) => !dif.has(i));
      for(let i = 0; i < iguales.length; i += LOTE_MARCAR){
        const tr = iguales.slice(i, i + LOTE_MARCAR);
        if(a.saltar) throw new Error('SALTADO');
        await conReintento(() => rpc('tad_indice_marcar', { p_carga: k, p_bloques: tr.map((b) => ({ a: b.a, z: b.z })) }));
        a.hecho += tr.reduce((s, b) => s + b.filas.length, 0); pintar();
      }
      bloques.forEach((b, i) => { if(dif.has(i)) distintas = distintas.concat(b.filas); });
    } else distintas = claves.map((c) => primera.get(c));
    let subidas = 0;
    for(let i = 0; i < distintas.length; i += LOTE_COMPARAR){
      if(a.saltar) throw new Error('SALTADO');
      const trozo = distintas.slice(i, i + LOTE_COMPARAR).map((j) => a.indice[j]);
      const faltan = await conReintento(() => rpc('tad_indice_comparar', { p_carga: k, p_filas: trozo.map((o) => ({ s: o.s, c: o.c, e: o.e, h: o.h })) }));
      const cambiaron = (faltan || []).map((j) => trozo[j]).filter(Boolean);
      for(let j = 0; j < cambiaron.length; j += LOTE_INDICE){
        await conReintento(() => rpc('tad_indice_parte', { p_carga: k, p_filas: cambiaron.slice(j, j + LOTE_INDICE) }));
        await new Promise((ok) => setTimeout(ok, 0));   // no bloquea la pantalla
      }
      subidas += cambiaron.length;
      a.hecho += trozo.length; pintar();
    }
    const r = await rpc('tad_indice_cerrar', { p_carga: k }); a.fase = null; a.indice = null; r.subidas = subidas;
    r.bloques = bloques ? bloques.length : 0; r.segundos = Math.round((Date.now() - t0) / 1000); return r;
  }
  function textoIndice(ri){
    return ' · índice de ' + num(ri.filas) + ' servicios (' + plural(ri.subidas || 0, 'cambió', 'cambiaron') + ')' + (ri.confirmados ? ' · ' + plural(ri.confirmados, 'cambio confirmado', 'cambios confirmados') : '') + (ri.sin_registro ? ' · ' + plural(ri.sin_registro, 'cambio sin registro', 'cambios sin registro') : '') + (ri.avisos ? ' · ' + plural(ri.avisos, 'cambio a medias', 'cambios a medias') : '') +
      (ri.segundos != null ? ' · tardó ' + (ri.segundos < 60 ? ri.segundos + ' s' : Math.round(ri.segundos / 60) + ' min') : '');
  }
  // Lote 05/11 G: el índice corre en segundo plano, separado de "ocupado"; si falla, las empresas ya quedaron
  async function indiceFondo(a){
    if(fondo || !a.indice) return;
    fondo = { a }; a.estado = 'lista'; a.indiceFallo = null; a.hecho = 0; pintar();
    try { const ri = await subirIndice(a); a.resultado = (a.resultadoBase || '') + textoIndice(ri); fondo = null; toast('Índice de residenciales al día'); }
    catch (e) {
      fondo = null; a.fase = null;
      if(/SALTADO/.test(e.message)){ a.indice = null; a.saltar = false; a.resultado = (a.resultadoBase || '') + ' · índice de residenciales saltado hoy'; toast('Índice saltado. Se retoma con el próximo TAD'); }
      else if(/TAD_CORTO/.test(e.message)){ a.indiceFallo = 'corto'; corto = { tipo: 'indice', texto: e.message.replace(/^.*TAD_CORTO:\s*/, ''), a }; }
      else { a.indiceFallo = e.message; toast('El índice de residenciales se detuvo. ' + e.message + '. Toca Seguir con el índice: retoma donde quedó', 'error'); }
    }
    pintar(); cargas();
  }
  function seguirIndice(a){ if(ocupado || fondo || !a.indice) return; indiceFondo(a); }
  async function subirCambios(a){
    a.estado = 'subiendo'; a.hecho = 0; pintar();
    const filas = a.datos.map((o) => ({ codigo: o.codigo, nombre: o.nombre, fecha: o.fecha, anterior: o.categoria_anterior, actual: o.categoria_actual, operador: o.operador, comentario: o.comentario }));
    const r = await rpc('cambios_archivo_cargar', { p_archivo: a.nombre, p_filas: filas });
    a.estado = 'lista'; a.datos = null;
    a.resultado = plural(r.filas, 'cambio', 'cambios') + ' · ' + plural(r.con_fecha, 'cambio con fecha exacta', 'cambios con fecha exacta') + (r.ignoradas ? ' · ' + r.ignoradas + ' ignorados (RADIUS o repetidos)' : '');
    return r;
  }
  // Lote 22/10: reporte "Clientes Empresariales" de Proham (sucursal + código + ONT)
  async function subirIp(a){
    a.estado = 'subiendo'; a.hecho = 0; pintar();
    // Lote 05/11 E4: también el nombre (para proponer "Lo más parecido" cuando no cuadra por sucursal, código y ONT)
    const filas = a.datos.map((o) => ({ s: o.sucursal, c: o.cliente, e: o.ont, ip: o.ipv4, ip6: o.ipv6, est: o.estado, n: o.nombre || o.razon_social || o.nombre_cliente || o.cliente_nombre || o.descripcion || '' }));
    const r = await rpc('ip_reporte_cargar', { p_archivo: a.nombre, p_filas: filas });
    a.estado = 'lista'; a.datos = null;
    a.resultado = plural(r.cuadran, 'servicio cuadra', 'servicios cuadran') + (r.llenadas ? ' · ' + plural(r.llenadas, 'IP llenada', 'IP llenadas') : '') +
      (r.por_confirmar ? ' · ' + plural(r.por_confirmar, 'IP por confirmar', 'IP por confirmar') : '') + (r.sin_servicio_pyme ? ' · ' + plural(r.sin_servicio_pyme, 'no está', 'no están') + ' como PYME en el TAD' : '');
    return r;
  }
  async function subir(a){
    if(a.tipo === 'dedicados') return subirDedicados(a);
    if(a.tipo === 'ip') return subirIp(a);
    if(a.tipo === 'cambios') return subirCambios(a);
    a.estado = 'subiendo'; a.hecho = 0; pintar();
    const tad = a.tipo === 'tad'; const paso = tad ? LOTE : LOTE_CRUDO;
    if(tad && !a.indiceElegido) a.conIndice = !idxEstado || !!idxEstado.toca;   // con lo último que se sabe del índice
    const carga = tad ? await rpc('tad_iniciar', { p_archivo: a.nombre, p_total: a.datos.length + a.malas })
      : await rpc('crudo_iniciar', { p_fuente: a.tipo, p_archivo: a.nombre, p_total: a.datos.length });
    if(a.soloAliados) await rpc('carga_solo_aliados', { p_carga: carga });
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
    if(tad){ rpc('tad_columnas', { p_carga: carga, p_cols: a.colsFechas || {} }).catch(() => {}); a.sinFechas = !Number(r.con_fechas); }
    a.resultado = tad ? plural(r.clientes_nuevos, 'cliente nuevo', 'clientes nuevos') + ', ' + plural(r.servicios_nuevos, 'servicio nuevo', 'servicios nuevos') + ' y ' + plural(r.servicios_actualizados, 'actualizado', 'actualizados') +
        (r.pagos_marcados ? ' · ' + plural(r.pagos_marcados, 'instalación pagada', 'instalaciones pagadas') : '') + ((r.invalidas || 0) + a.malas ? ' · ' + plural((r.invalidas || 0) + a.malas, 'fila no se pudo leer', 'filas no se pudieron leer') : '')
      : plural(r.guardadas, 'fila guardada', 'filas guardadas') + (a.soloAliados ? ' · solo para aliados, no toca comisiones' : '');
    a.resultadoBase = a.resultado;
    a.datos = null;
    if(tad && a.indice && !a.conIndice){ a.indiceOmitido = true; a.resultadoBase = a.resultado; a.resultado += ' · sin índice de residenciales (hoy no tocaba)'; }
    if(tad && a.indice && a.conIndice) setTimeout(() => indiceFondo(a), 0);   // sigue solo; la cola no lo espera
    return r;
  }
  async function cargarTodo(){
    if(ocupado) return;
    let cola = [].concat.apply([], ORDEN.map((t) => lista.filter((a) => a.tipo === t && a.datos && !a.pregunta && a.estado !== 'lista' && a.estado !== 'fallo')));
    if(fondo && cola.some((a) => a.tipo === 'tad')){ cola = cola.filter((a) => a.tipo !== 'tad'); toast('Otro TAD tiene que esperar a que termine el índice de residenciales', 'error'); }
    if(!cola.length) return;
    ocupado = true; fin = null; let total = null; let fallo = null;
    for(const a of cola){
      try { const r = await subir(a); if(a.tipo === 'tad') total = r.clientes_total; }
      catch (e) { a.estado = 'fallo'; a.resultado = null; a.falla = e.message; fallo = e; break; }
    }
    ocupado = false; cache.borrarTodo();
    // Lote 22/10: un TAD con menos del 95 % de las filas de la carga anterior no se aplica sin confirmar
    if(fallo && /TAD_CORTO/.test(fallo.message)){ corto = { tipo: /TAD completo/.test(fallo.message) ? 'indice' : 'tad', texto: fallo.message.replace(/^.*TAD_CORTO:\s*/, '') }; pintar(); }
    else if(fallo){ pintar(); toast('La carga se detuvo. ' + fallo.message + '. Puedes volver a intentarlo: no se duplica nada', 'error'); }
    else {
      const crudos = cola.some((a) => a.tipo !== 'tad' && a.tipo !== 'dedicados' && a.tipo !== 'cambios' && a.tipo !== 'ip' && !a.soloAliados);
      // Lote 10/11 B: el cruce corre solo al terminar (ya no hay "Cruzar ahora")
      if(total !== null) totalClientes = total;
      cruce = null; pintar();
      if(crudos) await correrCruce(true);
      else toast(fondo ? 'Archivos cargados. El índice de residenciales sigue en segundo plano' : 'Listo: ya quedó aplicado');
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
  const FUENTES = { ip: 'IP (Clientes Empresariales)', tad: 'TAD', odoo: 'Órdenes de Odoo', instalaciones: 'Órdenes de instalación', dedicados: 'Dedicados', base_vieja: 'Base de la app anterior' };
  const marcaCruce = (c) => c.cruce === 'aliados' ? '<span class="m azul">Solo aliados</span>' : c.cruce === 'aplicado' ? '<span class="m verde">Cruce aplicado</span>' : c.cruce === 'pendiente' ? '<span class="m ambar">Falta el cruce</span>' : '<span class="m verde">Aplicada al subir</span>';
  // Última subida de cada archivo: se suben dos veces al día (mañana y tarde)
  // Lote 28/10 (A11): qué toca actualizar (cada archivo, su última carga y si está al día) e historial agrupado por fecha
  const FREC = { diaria: 'Cada mañana; a las 5 p. m. si quieres', mapa: 'Cuando cambie el mapa', cuando: 'Cuando haya archivo nuevo' };
  function filaIndice(x){
    if(!x) return '';
    const ab = x.abierta && !fondo; const est = fondo ? ['ambar', 'Cargando ' + pctIdx(fondo.a) + ' %'] : ab ? ['ambar', 'A medias'] : x.toca ? ['ambar', 'Toca hoy'] : ['verde', 'Al día'];
    return '<div class="act-f"><span class="tx"><b>Índice de residenciales</b><small>' + esc('Una vez por semana o con migraciones esperando · ' + (x.ultima ? 'último: ' + fecha(x.ultima).replace(/ de \d{4}$/, '') + ', ' + hora(x.ultima) : 'sin cargas')) +
      (ab ? esc(' · quedó en ' + Math.round(x.abierta.filas * 100 / Math.max(1, x.abierta.total)) + ' %: suelta el mismo TAD y toca Seguir solo con el índice') : '') + '</small></span><span class="chip ' + est[0] + '">' + esc(est[1]) + '</span></div>';
  }
  let verTodoHist = false;
  async function cargas(){
    try {
      const d = await rpc('actualizar_estado', {});
      estadoAct = d; idxEstado = d.indice || null;
      pintar();
      // Lote 10/11 B: historial como tabla (fecha, archivo, estado, números); las últimas 15 y "Ver más"
      const todas = [].concat.apply([], (d.historial || []).map((g) => g.cargas));
      const estadoH = (c) => c.estado === 'fallo' ? ['rojo', 'No terminó'] : c.fuente === 'tad' && c.resumen && c.resumen.con_fechas === 0 ? ['ambar', 'Sin fechas'] : (c.resumen || {}).solo_aliados ? ['azul', 'Solo aliados'] : c.estado === 'con_errores' ? ['ambar', 'Con filas sin leer'] : ['verde', 'Listo'];
      const fila = (c) => { const e = estadoH(c); const n = numerosCarga(c);
        return '<div class="sd-h"><span class="sd-hf">' + esc(fecha(c.en).replace(/ de \d{4}$/, '') + ' ' + hora(c.en)) + '</span><span class="sd-ha"><b>' + esc(FUENTES[c.fuente] || c.fuente) + '</b><small>' + esc((c.archivo || '') + (c.por ? ' · ' + c.por : '')) + '</small></span>' +
          '<span class="sd-he"><span class="chip ' + e[0] + '">' + esc(e[1]) + '</span></span><span class="sd-hn">' + esc(n[0]) + '</span></div>'; };
      // Lote 12/11 B (maqueta 8b): Hoy y Ayer abiertos por día; el resto de la semana plegado por día; semanas anteriores plegadas por semana con aviso si una carga no terminó
      const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']; const MC = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      const loc = (x) => { const t = new Date(x); return isNaN(t) ? null : new Date(t.getFullYear(), t.getMonth(), t.getDate()); };
      const clave = (t) => t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
      const hoyD = loc(new Date()); const ayerD = new Date(hoyD); ayerD.setDate(ayerD.getDate() - 1);
      const lunes = (t) => { const x = new Date(t); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
      const lunHoy = lunes(hoyD);
      const nCargas = (l) => plural(l.length, 'carga', 'cargas'); const fallas = (l) => l.filter((c) => c.estado === 'fallo').length;
      const filaH = (c) => { const e = estadoH(c); const n = numerosCarga(c);
        return '<div class="sd-h"><span class="sd-hf">' + esc(hora(c.en)) + '</span><span class="sd-ha"><b>' + esc(FUENTES[c.fuente] || c.fuente) + '</b><small>' + esc((c.archivo || '') + (c.por ? ' · ' + c.por : '')) + '</small></span>' +
          '<span class="sd-he"><span class="chip ' + e[0] + '">' + esc(e[1]) + '</span></span><span class="sd-hn">' + esc(n[0]) + '</span></div>'; };
      const porDia = {}; todas.forEach((c) => { const t = loc(c.en); if(!t) return; const k = clave(t); (porDia[k] = porDia[k] || { t, l: [] }).l.push(c); });
      const dias = Object.keys(porDia).sort().reverse().map((k) => porDia[k]);
      const nomDia = (t) => DIAS[t.getDay()] + ' ' + t.getDate() + ' ' + MC[t.getMonth()];
      const avisoF = (l) => fallas(l) ? '<span class="chip rojo">' + plural(fallas(l), 'no terminó', 'no terminaron') + '</span>' : '';
      let hh = '';
      dias.filter((g) => g.t >= ayerD).forEach((g) => { const hoyEs = g.t.getTime() === hoyD.getTime();
        hh += '<div class="sd-hgr"><div class="sd-dia"><b>' + (hoyEs ? 'Hoy' : 'Ayer') + '</b><small>' + esc(nomDia(g.t)) + '</small>' + (fallas(g.l) ? avisoF(g.l) : '<span class="' + (hoyEs ? 'chip verde' : 'sd-n') + '">' + nCargas(g.l) + '</span>') + '</div>' + g.l.map(filaH).join('') + '</div>'; });
      dias.filter((g) => g.t < ayerD && g.t >= lunHoy).forEach((g) => {
        hh += '<details class="sd-pl"><summary><b>' + esc(capital(nomDia(g.t))) + '</b><small>· ' + nCargas(g.l) + '</small>' + avisoF(g.l) + ic('abajo') + '</summary>' + g.l.map(filaH).join('') + '</details>'; });
      const sem = {}; dias.filter((g) => g.t < lunHoy && g.t < ayerD).forEach((g) => { const L = lunes(g.t); const k = clave(L); (sem[k] = sem[k] || { L, l: [] }).l = sem[k].l.concat(g.l); });
      Object.keys(sem).sort().reverse().forEach((k) => { const w = sem[k]; const D = new Date(w.L); D.setDate(D.getDate() + 6);
        const tit = 'Semana del ' + w.L.getDate() + (w.L.getMonth() !== D.getMonth() ? ' ' + MC[w.L.getMonth()] : '') + ' al ' + D.getDate() + ' ' + MC[D.getMonth()];
        hh += '<details class="sd-pl"><summary><b>' + esc(tit) + '</b><small>· ' + nCargas(w.l) + (fallas(w.l) ? ', ' + plural(fallas(w.l), 'no terminó', 'no terminaron') : '') + '</small>' + avisoF(w.l) + ic('abajo') + '</summary>' + w.l.map(filaH).join('') + '</details>'; });
      $('cargas').innerHTML = todas.length ? '<div class="sd-hist sd-hist2">' + hh + '</div>'
        : '<div class="vacio"><b>Aún no hay cargas</b><p>Cuando subas el primer archivo aparecerá aquí con su fecha y quién lo subió.</p></div>';
    } catch (e) {
      $('cargas').innerHTML = '<div class="vacio" role="alert"><b>No se pudo ver el historial</b><p>' + esc(e.message) + '</p><button type="button" class="btn btn-chico" id="reintentarCargas">Reintentar</button></div>';
      toast(e.message, 'error');
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
  let estado = null;   // { ultimo_en, ultimo_por, pendientes }
  let cruceFallo = null; let totalClientes = null;
  async function estadoCruce(){
    try { estado = await rpc('cruce_estado', {}); } catch (e) { estado = { error: e.message }; }
    // Lote 10/11 B: si quedó algo sin cruzar (por ejemplo una carga de ayer), se cruza solo al abrir
    if(estado && !estado.error && estado.pendientes > 0 && !ocupado && !cruzando) { await correrCruce(true); return; }
    pintarCruce();
  }
  // Detalle del último cruce (plegado): lo mismo que antes mostraba "Esto cambia al guardar el cruce"
  function pintarCruce(){
    const z = $('cruce'); if(!z) return;
    const ult = estado && estado.ultimo_en ? 'Último cruce el ' + fecha(estado.ultimo_en) + ' a las ' + hora(estado.ultimo_en) + (estado.ultimo_por ? ', por ' + estado.ultimo_por : '') + '.' : 'Todavía no se ha guardado ningún cruce.';
    if(cruzando){ z.innerHTML = '<p class="nota-chica">Cruzando órdenes, instalaciones y líderes…</p>'; return; }
    if(estado && estado.error){ z.innerHTML = '<div class="vacio" role="alert"><b>No se pudo ver el cruce</b><p>' + esc(estado.error) + '</p><button type="button" class="btn btn-chico" id="reintentarCruce">Reintentar</button></div>'; return; }
    z.innerHTML = cruce ? '<details class="sd-det" id="detCruce"><summary><b>Ver detalle del cruce</b><small>' + esc(ult) + (totalClientes !== null ? ' Ahora hay ' + num(totalClientes) + ' clientes en total.' : '') + '</small></summary>' + resumenCruce(cruce.r) + '<p class="nota-chica">Comisiones, Clientes y Por instalar ya tienen lo nuevo.</p></details>'
      : '<p class="nota-chica">' + esc(ult) + ' Cuando subas órdenes de Odoo, instalaciones o la base anterior, se cruza solo.</p>';
  }
  async function correrCruce(aplicar){
    if(cruzando || ocupado) return;
    cruzando = true; cruceFallo = null; pintarCruce(); pintar();
    try {
      const r = await rpc(aplicar ? 'cruce_aplicar' : 'cruce_probar', {});
      cruce = { r, aplicado: aplicar };
      if(aplicar){ cache.borrarTodo(); toast('Listo: archivos cargados y cruzados'); estado = Object.assign({}, estado || {}, { pendientes: 0, ultimo_en: new Date().toISOString() }); }
    } catch (e) { cruceFallo = e.message; toast('No se pudo cruzar. ' + e.message, 'error'); }
    cruzando = false; pintarCruce(); pintar(); cargas();
  }

  document.addEventListener('click', (e) => {
    const t = e.target;
    if(t.closest('#soltar')){ if(ocupado) return; const i = $('archivos'); i.value = ''; i.click(); return; }
    if(t.closest('#limpiar') || t.closest('#otro')){ if(ocupado) return; lista = lista.filter((x) => fondo && x === fondo.a); fin = null; corto = null; pintar(); return; }
    if(t.closest('#cargarTodo')){ corto = null; cargarTodo(); return; }
    if(t.closest('#cargarCorto') && corto){ const k = corto; const b = t.closest('#cargarCorto'); b.disabled = true;
      rpc('tad_permitir_corto', { p_tipo: k.tipo }).then(() => { corto = null; if(k.a){ indiceFondo(k.a); return; } lista.forEach((x) => { if(x.estado === 'fallo') x.estado = null; }); cargarTodo(); })
        .catch((e) => { b.disabled = false; toast(e.message, 'error'); }); return; }
    // Lote 10/11 B: acciones dentro de cada fila
    const qu = t.closest('[data-quitar]'); if(qu){ const a = lista[Number(qu.dataset.quitar)]; if(a && !a.leyendo){ lista = lista.filter((x) => x !== a); pintar(); } return; }
    const okp = t.closest('[data-ok-para]'); if(okp){ const a = lista[Number(okp.dataset.okPara)]; if(a){ a.pregunta = false; pintar(); cargarTodo(); } return; }
    if(t.closest('[data-reintentar]')){ lista.forEach((x) => { if(x.estado === 'fallo'){ x.estado = null; x.falla = null; } }); cargarTodo(); return; }
    if(t.closest('[data-recruzar]')){ correrCruce(true); return; }
    const fz = t.closest('[data-forzar-indice]'); if(fz){ const a = lista[Number(fz.dataset.forzarIndice)]; if(a && a.indice){ a.conIndice = true; a.indiceElegido = true; a.indiceOmitido = false; if(a.estado === 'lista'){ a.resultado = a.resultadoBase || a.resultado; indiceFondo(a); } else pintar(); } return; }
    if(t.closest('[data-saltar-indice]')){ const a = fondo ? fondo.a : lista.find((x) => x.tipo === 'tad' && x.conIndice && x.estado !== 'lista'); if(a){ if(fondo) a.saltar = true; else { a.conIndice = false; a.indiceElegido = true; } toast(fondo ? 'Se detiene el índice en un momento' : 'Hoy no se actualiza el índice'); pintar(); } return; }
    if(t.closest('#reintentarCargas')){ cargas(); return; }
    if(t.closest('#verMasHist')){ verTodoHist = true; cargas(); return; }
    const sg = t.closest('[data-seguir]'); if(sg){ const a = lista[Number(sg.dataset.seguir)]; if(a) seguirIndice(a); return; }
    const si = t.closest('[data-solo-indice]'); if(si){ const a = lista[Number(si.dataset.soloIndice)]; if(a && !ocupado && !fondo){ a.datos = null; a.resultadoBase = 'Solo el índice (las empresas ya estaban cargadas)'; a.resultado = a.resultadoBase; indiceFondo(a); } return; }
    const pq = t.closest('[data-para]'); if(pq){ const a = lista[Number(pq.dataset.para)]; if(a && !a.estado){ a.soloAliados = !a.soloAliados; a.pregunta = false; pintar(); cargarTodo(); } return; }
    if(t.closest('#reintentarCruce')){ estadoCruce(); }
  });
  document.addEventListener('change', (e) => { const c = e.target.closest && e.target.closest('[data-con-indice]'); if(c){ const a = lista[Number(c.dataset.conIndice)]; if(a) a.conIndice = c.checked; } });
  $('archivos').addEventListener('change', () => elegir($('archivos').files));
  const zona = $('zona');
  zona.addEventListener('dragover', (e) => { e.preventDefault(); const s = $('soltar'); if(s) s.classList.add('sobre'); });
  zona.addEventListener('dragleave', () => { const s = $('soltar'); if(s) s.classList.remove('sobre'); });
  zona.addEventListener('drop', (e) => { e.preventDefault(); const s = $('soltar'); if(s) s.classList.remove('sobre'); if(e.dataTransfer && e.dataTransfer.files) elegir(e.dataTransfer.files); });
  // Con el índice corriendo, cerrar la pestaña lo pausa (el aviso lo dice en la fila); se retoma con el mismo archivo
  window.addEventListener('beforeunload', (e) => { if(ocupado || fondo){ e.preventDefault(); e.returnValue = ''; } });

  window.Armazon.arrancar(['admin', 'analista'], { activo: null, volver: { enlace: 'inicio.html', texto: 'Inicio' } }, (p) => {
    yo = p;
    // Lote 28/10: Actualizar es solo del administrador y la Analista Senior
    if(p.rol !== 'admin' && !p.senior){ document.querySelector('main.pagina').innerHTML = '<div class="vacio" role="alert" style="margin-top:40px"><b>Actualizar es del administrador y la Analista Senior</b><p>Si hace falta subir un archivo, pídeselo a ellos.</p><a class="btn btn-chico" href="inicio.html">Volver al inicio</a></div>'; return; }
    pintar(); estadoCruce();
    if(window.MapaRed) window.MapaRed.montar(yo);
    $('cargas').innerHTML = esqueleto(2);
    cargas();
  }, (p) => { yo = p; });
})();
