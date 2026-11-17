// Migraciones (lote 22/10, rediseñada en el lote 16/11 A): cambios de categoría y de titular.
// Lista agrupada por líder con lo que encontró el reporte "Consulta Cambio de Categoría" ("sin registrar") y lo registrado.
// La solicitud va por pasos (Servicio, Titular, Documentos, Enviar). El administrador revisa los documentos en el expediente;
// al aprobarlos pasa al analista del líder, que la hace en el sistema (si ya estaba hecha, salta ese paso).
(function(){
  'use strict';
  const C = window.Comun;
  const { $, esc, ic, rpc, toast, vacio, abrirHoja, cerrarHoja, prepararHojas, fecha, plural, normalizeStr } = C;
  let yo = null; let D = null; let activo = false; let busca = ''; let pedido = 0; let V = null; let abrirId = 0; let fresco = false;
  let filtro = ''; let vista = 'lider'; const plegados = {};
  // Lote 16/11 B: fuera de migraciones.html (Comisiones) este archivo solo presta la solicitud por pasos y el detalle
  const PAGINA = /migraciones\.html$/.test(location.pathname) || /migraciones$/.test(location.pathname); let alCerrarLib = null; let alCambiarLib = null;
  let S = null;   // la solicitud por pasos abierta
  const ESTADO = {
    por_revisar: ['ambar', 'Por revisar'], por_emitir: ['azul', 'Por emitir'], por_confirmar: ['morado', 'Por confirmar'], confirmado: ['verde', 'Confirmada'],
    sin_registro: ['ambar', 'Sin registrar'], cancelado: ['', 'Cancelado'], error: ['', 'Fue un error'], revertido: ['', 'Revertido']
  };
  const TIPO = { migracion: 'Migración a PYME', titularidad: 'Cambio de titular', ambos: 'Migración y cambio de titular', residencial: 'Cambio a residencial' };
  const AYUDA_TIPO = {
    migracion: 'Pasa de residencial a empresa. Comisiona.',
    titularidad: 'El servicio pasa a otra persona o empresa. No comisiona.',
    ambos: 'Cambia de titular y pasa a PYME. Comisiona por la categoría.',
    residencial: 'Deja de ser empresa. Cuenta como indicador negativo. No comisiona.'
  };
  const AVISO = { falta_plan: 'Falta cambiar el plan', falta_categoria: 'Falta cambiar la categoría' };
  const lista = () => $('lista');
  const cerrado = (c) => ['cancelado', 'error', 'revertido'].indexOf(c.estado) >= 0;
  const diaMes = (x) => { const t = new Date(x); return isNaN(t) ? '' : String(t.getDate()).padStart(2, '0') + '/' + String(t.getMonth() + 1).padStart(2, '0'); };
  const dias = (x) => { const t = new Date(x); return isNaN(t) ? 0 : Math.max(0, Math.floor((Date.now() - t.getTime()) / 86400000)); };
  const hace = (x) => { const n = dias(x); return n === 0 ? 'hoy' : 'hace ' + plural(n, 'día', 'días'); };
  const esLider = () => !!yo && yo.rol === 'lider';
  const P = () => (D && D.puedo) || {};

  async function cargar(){
    const mio = ++pedido;
    if(!D && activo) lista().innerHTML = '<div class="mg"><div class="mg-kpis">' + '<span class="sk" style="height:96px;border-radius:14px"></span>'.repeat(4) + '</div><span class="sk" style="height:220px;border-radius:16px"></span></div>';
    try { const r = await rpc('cambios_lista', {}); if(mio !== pedido) return; D = r; fresco = true; C.cache.guardar('cambios:' + (yo && yo.rol), r); pintar(); avisarContador(); }
    catch (e) {
      if(mio !== pedido) return;
      if(!D && activo) lista().innerHTML = '<div class="vacio" role="alert"><b>No se pudieron cargar los cambios</b><p>' + esc(e.message) + '</p><button type="button" class="btn btn-chico" data-cam="reintentar">Reintentar</button></div>';
      if(activo) toast(e.message, 'error');
    }
  }

  // ---------- Qué es cada fila ----------
  const sinReg = (c) => c.estado === 'sin_registro' && c.tipo !== 'residencial';
  const aResidencial = (c) => c.estado === 'sin_registro' && c.tipo === 'residencial';
  const faltanDocs = (c) => c.estado === 'por_revisar' && (c.borrador || !!(c.docs && c.docs.faltan));
  const porRevisar = (c) => c.estado === 'por_revisar' && !faltanDocs(c);
  const porDecidir = (c) => c.estado === 'confirmado' && c.comision === 'por_decidir' && c.origen !== 'historico' && (c.tipo === 'migracion' || c.tipo === 'ambos');
  const enCurso = (c) => c.estado === 'por_emitir' || c.estado === 'por_confirmar' || (!esLider() && faltanDocs(c));
  const delCorte = (c) => c.estado === 'confirmado' && c.origen !== 'historico' && !!D && !!c.corte_cambio && c.corte_cambio === D.corte;
  const mio = (c) => !!yo && (c.dueno_id === yo.id || c.creado_por === yo.nombre);
  const esperaDecision = (c) => esLider() ? false : (P().revisar && porRevisar(c)) || ((yo.rol === 'admin' || yo.senior) && porDecidir(c)) || !!c.puedo_hecho;
  const teFalta = (c) => sinReg(c) || faltanDocs(c);
  const FILTROS_ADMIN = [['decision', 'Esperan tu decisión', esperaDecision], ['sin', 'Sin registrar', sinReg], ['curso', 'En curso', enCurso], ['confirmadas', 'Confirmadas', delCorte],
    ['residencial', 'Pasaron a residencial', aResidencial], ['todas', 'Todas', (c) => !cerrado(c) && c.origen !== 'historico']];
  const FILTROS_LIDER = [['todas', 'Todas', (c) => !cerrado(c) && c.origen !== 'historico'], ['falta', 'Te falta registrar', teFalta], ['revision', 'En revisión', porRevisar],
    ['curso', 'En curso', (c) => c.estado === 'por_emitir' || c.estado === 'por_confirmar'], ['confirmadas', 'Confirmadas', delCorte]];
  const FILTROS = () => esLider() ? FILTROS_LIDER : FILTROS_ADMIN;
  // Lo que espera a quien mira (Inicio y la barra)
  function pendientes(){ if(!D || !yo) return 0; return (D.filas || []).filter((c) => esLider() ? teFalta(c) && mio(c) : esperaDecision(c)).length; }
  function avisarContador(){ document.dispatchEvent(new CustomEvent('cambios-contador', { detail: pendientes() })); }
  function leerUrl(){ const u = new URLSearchParams(location.search); const f = u.get('f'); filtro = f || ''; abrirId = Number(u.get('c')) || 0; if(u.get('v') === 'fecha') vista = 'fecha'; }
  function guardarUrl(){ try { const u = new URLSearchParams(); if(filtro) u.set('f', filtro); if(busca) u.set('q', busca); if(vista === 'fecha') u.set('v', 'fecha'); const q = u.toString(); history.replaceState(history.state, '', location.pathname + (q ? '?' + q : '')); } catch (e) {} }

  const codigo1 = (c) => { const s = (c.servicios || [])[0] || {}; return [s.sucursal, s.codigo ? String(s.codigo).replace(/^0+/, '') : ''].filter(Boolean).join('-'); };
  const docTit = (c) => { const t = c.titular || {}; return t.doc ? C.docFmt(t.tipo || '', t.doc) : ''; };
  const cambioTxt = (c) => c.tipo === 'titularidad' ? 'A ' + ((c.nuevo && c.nuevo.nombre) || 'otro titular') : (c.categoria_anterior || '?') + ' → ' + (c.categoria_nueva || (c.tipo === 'residencial' ? 'RESIDENCIAL' : 'PYME'));
  // Estado: chip y una línea de detalle
  function estadoFila(c){
    if(aResidencial(c)) return ['rojo', 'Pasó a residencial', c.categoria_anterior ? 'Era ' + c.categoria_anterior : 'Salió de empresa'];
    if(sinReg(c)){
      const rep = c.reporte; const com = rep && rep.comentario;
      if(!c.dueno_id) return ['ambar', 'Sin registrar', c.sugerido ? 'El comentario nombra a ' + C.primerNombre(c.sugerido) : 'Cliente sin líder'];
      if(com && c.sugerido) return ['ambar', 'Sin registrar', 'Comentario: ' + com];
      return ['ambar', 'Sin registrar', (c.natural ? 'Persona natural · no amerita documentos' : c.docs && c.docs.faltan ? 'Faltan documentos' : 'Expediente completo · regístrala') + ' · ' + (rep ? 'reporte del ' + diaMes(rep.fecha + 'T12:00:00') : 'lo vio el TAD')];
    }
    if(c.estado === 'por_revisar' && c.borrador) return ['gris', 'Sin enviar', 'Guardada por ' + C.primerNombre(c.creado_por || '') + ' el ' + diaMes(c.creado_en) + (c.docs && c.docs.faltan ? ' · ' + (c.docs.faltan === 1 ? 'falta 1 documento' : 'faltan ' + c.docs.faltan + ' documentos') : '')];
    if(c.estado === 'por_revisar' && c.docs && c.docs.faltan) return ['ambar', c.docs.faltan === 1 ? 'Falta 1 documento' : 'Faltan ' + c.docs.faltan + ' documentos', 'Registrada por ' + C.primerNombre(c.creado_por || '') + ' el ' + diaMes(c.creado_en)];
    if(c.estado === 'por_revisar') return ['azul', 'Documentos por revisar', 'Registrada por ' + C.primerNombre(c.creado_por || '') + ' el ' + diaMes(c.creado_en)];
    if(c.estado === 'por_emitir') return ['gris', 'Por emitir', (c.aprobado_en ? 'Aprobada el ' + diaMes(c.aprobado_en) + ' · ' : '') + (c.puedo_hecho ? 'te toca hacerla en el sistema' : 'la emite el analista')];
    if(c.estado === 'por_confirmar') return ['gris', 'Por confirmar', c.aviso ? AVISO[c.aviso] : 'Se confirma con el reporte o el TAD'];
    if(c.estado === 'confirmado'){
      if(c.origen === 'historico') return ['gris', 'Histórico', c.pagado_fuera ? 'Pagado fuera de la app' : 'Del consolidado'];
      if(c.tipo === 'residencial') return ['rojo', 'Pasó a residencial', 'Indicador negativo'];
      const cuando = c.confirmado_como === 'archivo' ? 'Confirmada en el reporte del ' : c.confirmado_como === 'manual' ? 'Confirmada a mano el ' : 'Confirmada en el TAD del ';
      if(porDecidir(c)) return ['azul', 'Comisión por decidir', cuando + diaMes(c.confirmado_en || c.fecha_cambio)];
      if(c.comision === 'si') return ['verde', 'Confirmada · comisiona', cuando + diaMes(c.confirmado_en || c.fecha_cambio)];
      return ['gris', 'Confirmada · no comisiona', c.cierre_nota ? 'Motivo: ' + c.cierre_nota : c.tipo === 'titularidad' ? 'Un cambio de titular solo no comisiona' : cuando + diaMes(c.confirmado_en || c.fecha_cambio)];
    }
    const e = ESTADO[c.estado] || ['', c.estado]; return ['gris', e[1], c.cierre_nota || ''];
  }
  // Un solo botón con lo que toca
  function botonFila(c){
    const p = P();
    if(p.lectura) return null;
    if(aResidencial(c)) return c.cliente_id ? ['cliente', 'Ver cliente', 's'] : null;
    if(sinReg(c)){
      if(esLider()) return ['registrar', 'Registrar', 'p'];
      if(!c.dueno_id) return p.asignar ? ['asignar', 'Asignar líder', 'p'] : null;
      return puedeRecordar(c.dueno_id) ? ['recordar', 'Recordar', 's'] : null;
    }
    if(c.estado === 'por_revisar' && c.borrador) return mio(c) || yo.rol === 'admin' ? ['seguir', 'Seguir', 'p'] : null;
    if(faltanDocs(c)) return esLider() ? ['abrir', 'Subir', 'p'] : puedeRecordar(c.dueno_id) ? ['recordar', 'Recordar', 's'] : null;
    if(porRevisar(c) && p.revisar) return ['revisar', 'Revisar', 'p'];
    if(porDecidir(c) && (yo.rol === 'admin' || yo.senior)) return ['abrir', 'Decidir', 'p'];
    if(c.puedo_hecho) return ['abrir', 'Hecho', 'p'];
    return null;
  }
  const puedeRecordar = (lid) => !!lid && !P().lectura && (P().enviar_todos || (yo.rol === 'analista' && (D.lideres || []).some((l) => l.id === lid && l.analista_id === yo.id)));
  function filaHtml(c){
    const e = estadoFila(c); const b = botonFila(c); const s = codigo1(c);
    return '<div class="mg-r" data-cambio="' + esc(c.id) + '" role="button" tabindex="0" aria-label="' + esc((c.titular && c.titular.nombre) || 'Cambio') + '. Toca para abrirlo">' +
      '<div class="f"><b>' + esc(diaMes(c.fecha_cambio || c.creado_en)) + '</b><small>' + esc(hace(c.fecha_cambio || c.creado_en)) + '</small></div>' +
      '<div class="c"><b>' + esc((c.titular && c.titular.nombre) || 'Titular sin nombre') + '</b><small>' + esc([docTit(c), s].filter(Boolean).join(' · ')) + (vista === 'fecha' && !esLider() ? ' · ' + esc(c.dueno || 'Por asignar') : '') + '</small></div>' +
      '<div class="k">' + esc(cambioTxt(c)).replace('→', '<i>→</i>') + '</div>' +
      '<div class="e"><span class="mg-p ' + e[0] + '">' + esc(e[1]) + '</span><small>' + esc(e[2]) + '</small></div>' +
      '<div>' + (b ? '<button type="button" class="mg-btn ' + b[2] + '" data-mg="' + b[0] + '" data-id="' + esc(c.id) + '">' + esc(b[1]) + '</button>' : '') + '</div></div>';
  }
  function tarjetas(fs){
    const k = (on, am, t, n, s, f) => '<button type="button" class="mg-k' + (on ? ' on' : '') + (am ? ' am' : '') + '" data-mgf="' + f + '"><small>' + esc(t) + '</small><b>' + n + '</b><span>' + esc(s) + '</span></button>';
    if(esLider()){
      const tf = fs.filter(teFalta).length; const cf = fs.filter(delCorte);
      return k(filtro === 'falta' || filtro === 'todas', true, 'Te falta registrar', tf, 'ya se hicieron, faltan documentos', 'falta') + k(filtro === 'revision', false, 'En revisión', fs.filter(porRevisar).length, 'las ve el administrador', 'revision') +
        k(filtro === 'curso', false, 'En curso', fs.filter((c) => c.estado === 'por_emitir' || c.estado === 'por_confirmar').length, 'por emitir o confirmar', 'curso') +
        k(filtro === 'confirmadas', false, 'Confirmadas del corte', cf.length, plural(cf.filter((c) => c.comision === 'si').length, 'comisiona', 'comisionan'), 'confirmadas');
    }
    const de = fs.filter(esperaDecision); const nr = de.filter(porRevisar).length; const nd = de.filter(porDecidir).length; const nh = de.filter((c) => c.puedo_hecho).length;
    const sub = [nr ? nr + ' por revisar' : '', nd ? plural(nd, 'comisión por decidir', 'comisiones por decidir') : '', nh ? nh + ' por hacer en el sistema' : ''].filter(Boolean).join(' · ') || 'Nada por ahora';
    const cf = fs.filter(delCorte);
    return k(filtro === 'decision', false, 'Esperan tu decisión', de.length, sub, 'decision') + k(filtro === 'sin', true, 'Sin registrar', fs.filter(sinReg).length, 'las encontró el reporte', 'sin') +
      k(filtro === 'curso', false, 'En curso', fs.filter(enCurso).length, 'por emitir o confirmar', 'curso') +
      k(filtro === 'confirmadas', false, 'Confirmadas del corte', cf.length, plural(cf.filter((c) => c.comision === 'si').length, 'comisiona', 'comisionan'), 'confirmadas');
  }
  function aviso(fs){
    const p = P();
    if(esLider()){
      const n = fs.filter((c) => sinReg(c) && mio(c)).length;
      return n ? '<div class="mg-av" role="note"><span><b>' + (n === 1 ? '1 migración tuya ya se hizo sin registro.' : n + ' migraciones tuyas ya se hicieron sin registro.') + '</b> Regístralas para que entren a tu comisión.</span></div>' : '';
    }
    const r = D.reporte || {}; const ns = fs.filter(sinReg).length; const nr = fs.filter(aResidencial).length;
    const txt = r.hasta ? '<b>Reporte de cambios de categoría: hasta el ' + esc(diaMes(r.hasta + 'T12:00:00')) + '.</b> ' + (ns ? plural(ns, 'cambio a PYME sin registrar', 'cambios a PYME sin registrar') : 'Nada sin registrar') + (nr ? ' y ' + (nr === 1 ? '1 que pasó a residencial' : nr + ' que pasaron a residencial') : '') + '.'
      : '<b>Todavía no se ha subido el reporte de cambios de categoría.</b> Súbelo en Actualizar para ver lo que se hizo sin registro.';
    return '<div class="mg-av" role="note"><span>' + txt + '</span>' + (p.subir_reporte ? '<a href="actualizar.html">Subir reporte</a>' : '') + '</div>';
  }
  function pintar(){
    if(!D || !activo || !yo) return;
    const f0 = $('filtros'); if(f0) f0.style.display = 'none'; const a0 = $('ayuda'); if(a0) a0.style.display = 'none';
    const b = normalizeStr(busca); const dig = busca.replace(/\D/g, '');
    const ok = (c) => !b || normalizeStr(c.titular && c.titular.nombre).indexOf(b) >= 0 || normalizeStr(c.dueno).indexOf(b) >= 0 || normalizeStr(c.nuevo && c.nuevo.nombre).indexOf(b) >= 0 ||
      (dig && ((c.servicios || []).some((s) => String(s.codigo).replace(/^0+/, '').indexOf(dig.replace(/^0+/, '')) >= 0) || String((c.titular && c.titular.doc) || '').indexOf(dig) >= 0));
    const fs = (D.filas || []).filter(ok);
    const F = FILTROS();
    if(!F.some((x) => x[0] === filtro)){
      if(esLider()) filtro = 'todas';
      else filtro = ['decision', 'sin', 'curso', 'confirmadas', 'todas'].find((id) => fs.some(F.find((x) => x[0] === id)[2])) || 'todas';
    }
    const fx = F.find((x) => x[0] === filtro);
    const p = P();
    let h = '<div class="mg"><div class="mg-top">' + aviso(fs) + (p.nuevo ? '<button type="button" class="mg-nuevo" data-cam="nuevo">+ Nuevo cambio</button>' : '') + '</div>' +
      '<div class="mg-kpis">' + tarjetas(fs) + '</div>' +
      '<div class="mg-bar" role="tablist" aria-label="Filtros">' + F.map((x) => '<button type="button" role="tab" class="mg-ch' + (x[0] === filtro ? ' on' : '') + '" aria-selected="' + (x[0] === filtro) + '" data-mgf="' + x[0] + '">' + esc(x[1]) + ' <em>' + fs.filter(x[2]).length + '</em></button>').join('') +
      (p.por_lider ? '<span class="mg-seg" role="group" aria-label="Ordenar"><button type="button" class="' + (vista === 'lider' ? 'on' : '') + '" data-mgv="lider" aria-pressed="' + (vista === 'lider') + '">Por líder</button><button type="button" class="' + (vista === 'fecha' ? 'on' : '') + '" data-mgv="fecha" aria-pressed="' + (vista === 'fecha') + '">Por fecha</button></span>' : '') + '</div>';
    const l = fs.filter(fx[2]);
    if(!l.length){
      h += b ? vacio('Sin resultados', 'Nada coincide con "' + busca + '" en ' + fx[1] + '.')
        : !(D.filas || []).length ? vacio('Sin cambios todavía', p.nuevo ? 'Toca Nuevo cambio para registrar una migración, un cambio de titular o un cambio a residencial.' : 'Cuando haya migraciones aparecerán aquí.')
        : vacio('Nada en ' + fx[1], 'Mira los otros filtros.');
    } else if(vista === 'fecha'){
      h += '<section class="mg-g">' + l.slice().sort((x, y) => String(y.fecha_cambio || y.creado_en).localeCompare(String(x.fecha_cambio || x.creado_en))).map(filaHtml).join('') + '</section>';
    } else h += grupos(l);
    lista().innerHTML = h + '</div>';
    if(abrirId){ const k = abrirId; const esta = (D.filas || []).some((c) => c.id === k); if(esta || fresco) abrirId = 0; if(esta) abrirDetalle(k); }
  }
  function grupos(l){
    const g = {}; const orden = [];
    l.forEach((c) => { const k = aResidencial(c) || !c.dueno_id ? '' : c.dueno_id; if(!g[k]){ g[k] = { id: k, nombre: k ? c.dueno || 'Líder' : 'Por asignar', filas: [] }; orden.push(g[k]); } g[k].filas.push(c); });
    orden.sort((a, b) => (!a.id) - (!b.id) || b.filas.filter(esperaDecision).length - a.filas.filter(esperaDecision).length || b.filas.length - a.filas.length || a.nombre.localeCompare(b.nombre));
    return orden.map((x) => {
      const sr = x.filas.filter(sinReg); const resto = x.filas.filter((c) => !sinReg(c)); const de = x.filas.filter(esperaDecision).length; const res = x.filas.filter(aResidencial).length;
      const chips = esLider() ? '' : (sr.length ? '<span class="mg-p am">' + sr.length + ' sin registrar</span>' : '') + (de ? '<span class="mg-p az">' + de + (de === 1 ? ' espera tu decisión' : ' esperan tu decisión') + '</span>' : '') +
        (res ? '<span class="mg-p ro">' + (res === 1 ? '1 pasó a residencial' : res + ' pasaron a residencial') + '</span>' : '');
      const env = x.id && !esLider() && puedeRecordar(x.id) && (D.filas || []).some((c) => c.dueno_id === x.id && teFalta(c)) ? '<button type="button" class="mg-env" data-mg-env="' + esc(x.id) + '">Enviar pendientes</button>' : '';
      const k = x.id || '_'; const pleg = !!plegados[k];
      const cuerpo = !x.id ? x.filas.map(filaHtml).join('')
        : (sr.length ? '<div class="mg-sub am">Ya se hicieron y nadie las registró · ' + sr.length + '</div>' + sr.map(filaHtml).join('') : '') + (resto.length ? '<div class="mg-sub">Registradas · ' + resto.length + '</div>' + resto.map(filaHtml).join('') : '');
      return '<section class="mg-g' + (pleg ? ' plegado' : '') + '"><div class="mg-gh"><button type="button" class="mg-gt" data-mg-pleg="' + esc(k) + '" aria-expanded="' + !pleg + '"><span class="ini" aria-hidden="true">' + esc(x.id ? C.iniciales(x.nombre) : '?') + '</span><b>' + esc(x.nombre) + '</b></button>' + env +
        '<span class="der">' + chips + '</span></div><div class="mg-cu">' + cuerpo + '</div></section>';
    }).join('');
  }

  // ---------- Hojas ----------
  function hoja(id, idT){
    let h = $(id);
    if(!h){ h = document.createElement('section'); h.id = id; h.className = 'hoja'; h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true'); h.setAttribute('aria-labelledby', idT); h.setAttribute('aria-hidden', 'true'); document.body.appendChild(h); prepararHojas(); }
    return h;
  }
  const cab = (idT, t, sub) => '<div class="cab"><div><h2 id="' + idT + '">' + esc(t) + '</h2>' + (sub ? '<p class="sub-hoja">' + esc(sub) + '</p>' : '') + '</div><button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div>';

  // ---------- Solicitud por pasos: Servicio, Titular, Documentos, Enviar (lote 16/11 A, parte 3) ----------
  const PASOS = ['Servicio', 'Titular', 'Documentos', 'Enviar'];
  function abrirSolicitud(o){
    o = o || {};
    const c = o.desde || null;
    S = { paso: 1, desde: c, res: null, sel: {}, tipo: c ? (c.tipo === 'ambos' ? 'ambos' : 'migracion') : '', motivo: '', natural: false, err: {}, q: '', archivo: null, ocr: null, leyendo: false, busq: null,
      id: null, d: null, subiendo: {}, lider: '', ocupado: false, enviada: null, rifSubido: false };
    if(o.borrador){ S.id = o.borrador.id; S.tipo = o.borrador.tipo; S.paso = 3; S.rifSubido = true; S.seguir = true; }
    if(c){
      const cl = (c.servicios || []).filter((s) => s.clave);
      if(cl.length){
        S.res = [{ nombre: (c.titular && c.titular.nombre) || '', doc_tipo: (c.titular && c.titular.tipo) || '', doc_numero: (c.titular && c.titular.doc) || '',
          servicios: cl.map((s) => ({ clave: s.clave, sucursal: s.sucursal, codigo: s.codigo, plan: s.plan, categoria: s.categoria, estado: s.estado, direccion: s.direccion, empresa: false })) }];
        cl.forEach((s) => { S.sel[s.clave] = true; }); S.fijo = true;
      } else S.q = String(((c.servicios || [])[0] || {}).codigo || '').replace(/^0+/, '');
      S.natural = /^[VE]/i.test((c.titular && c.titular.tipo) || '');
    }
    let f = $('msFondo');
    if(!f){ f = document.createElement('div'); f.id = 'msFondo'; f.className = 'ms-fondo'; document.body.appendChild(f); }
    f.innerHTML = '<div class="ms" role="dialog" aria-modal="true" aria-labelledby="msT"><div class="ms-cab" id="msCab"></div><div class="ms-c" id="msC"></div><div class="ms-pie" id="msPie"></div></div>';
    f.hidden = false; document.body.classList.add('con-ms');
    try { history.pushState(Object.assign({}, history.state || {}, { ms: 1 }), ''); } catch (e) {}
    if(S.id) cargarSol().then(pintarSol); else pintarSol();
    if(S.q && !S.res) buscarSol();
    setTimeout(() => { const i = $('msBusca'); if(i && !S.res) i.focus(); else { const t = $('msT'); if(t) t.focus(); } }, 80);
  }
  function cerrarSolicitud(desdeAtras){
    const f = $('msFondo'); if(!f || f.hidden) return;
    const habia = S && S.id && !S.enviada;
    f.hidden = true; f.innerHTML = ''; document.body.classList.remove('con-ms'); S = null;
    if(!desdeAtras){ try { if(history.state && history.state.ms) history.back(); } catch (e) {} }
    if(habia) toast('Quedó guardada en tus pendientes. Termínala cuando tengas los documentos');
    if(PAGINA) cargar(); else if(alCerrarLib){ const fcb = alCerrarLib; alCerrarLib = null; fcb(); }
  }
  window.addEventListener('popstate', () => { if(S) cerrarSolicitud(true); });
  const titularElegido = () => { const k = Object.keys(S.sel).find((x) => S.sel[x]); if(!k || !S.res) return null; return S.res.find((t) => t.servicios.some((s) => s.clave === k)) || null; };
  const quedaANombre = () => (S.tipo === 'titularidad' || S.tipo === 'ambos') ? (S.ocr && S.ocr.datos && S.ocr.datos.razon_social) || (S.d && S.d.nuevo && S.d.nuevo.nombre) || '' : ((titularElegido() || {}).nombre || (S.d && S.d.titular && S.d.titular.nombre) || '');
  function cabSol(){
    const t = titularElegido(); const nom = (t && t.nombre) || (S.d && S.d.titular && S.d.titular.nombre) || (S.desde && S.desde.titular && S.desde.titular.nombre) || '';
    const corto = nom.replace(/,?\s*(C\.?\s?A\.?|S\.?\s?A\.?)\s*$/i, '');
    const titulo = S.enviada ? (S.tipo === 'migracion' ? 'Migración enviada' : 'Solicitud enviada') : S.desde || S.seguir ? (S.tipo === 'titularidad' ? 'Registrar cambio de titular' : 'Registrar migración') : 'Nuevo cambio';
    const sub = S.enviada ? [corto, TIPO[S.tipo]].filter(Boolean).join(' · ') : [corto, S.tipo ? TIPO[S.tipo] : '', S.paso >= 2 && quedaANombre() ? 'queda a nombre de ' + quedaANombre() : ''].filter(Boolean).join(' · ');
    const barra = S.enviada ? '' : '<div class="ms-st" aria-label="Pasos">' + PASOS.map((p, i) => { const n = i + 1; const cl = n < S.paso ? 'ok' : n === S.paso ? 'on' : '';
      return '<span class="' + cl + '"' + (n === S.paso ? ' aria-current="step"' : '') + '><i aria-hidden="true">' + (n < S.paso ? '✓' : n) + '</i>' + p + '</span>'; }).join('') + '</div>';
    return '<b id="msT" tabindex="-1">' + esc(titulo) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + barra;
  }
  const errSol = (k) => S.err[k] ? '<div class="error" role="alert">' + esc(S.err[k]) + '</div>' : '';
  function pintarSol(){
    if(!S) return; const z = $('msC'); if(!z) return;
    $('msCab').innerHTML = cabSol();
    let h = ''; let pie = '';
    if(S.enviada){ h = pasoEnviada(); pie = '<button type="button" class="p" data-ms="listo">Listo</button>'; }
    else if(S.paso === 1){ h = paso1(); pie = '<button type="button" data-ms="cerrar">Cancelar</button><button type="button" class="p" data-ms="sig1"' + (S.ocupado ? ' disabled' : '') + '>' + (S.ocupado ? 'Guardando…' : S.tipo === 'residencial' ? 'Registrar' : 'Siguiente') + '</button>'; }
    else if(S.paso === 2){ h = paso2(); pie = '<button type="button" data-ms="atras">Atrás</button><button type="button" class="p" data-ms="sig2"' + (S.ocupado || S.leyendo || !puedeSeguir2() ? ' disabled' : '') + '>' + (S.ocupado ? 'Guardando…' : 'Siguiente') + '</button>'; }
    else { const f = faltanSol(); h = paso3(); pie = '<button type="button" data-ms="atras">Atrás</button><button type="button" class="p" data-ms="enviar"' + (f || S.ocupado || !S.d || Object.keys(S.subiendo).length ? ' disabled' : '') + '>' + (S.ocupado ? 'Enviando…' : 'Siguiente') + '</button>'; }
    z.innerHTML = h; $('msPie').innerHTML = pie;
  }
  function paso1(){
    let h = '';
    const t = titularElegido();
    if(S.fijo && S.res && S.res[0]){
      const s = S.res[0].servicios;
      h += '<div class="ms-box"><small>Servicio</small><b>' + esc(s.map((x) => x.sucursal + '-' + String(x.codigo).replace(/^0+/, '')).join(', ')) + '</b>' + esc(S.res[0].nombre) + ' · ' + esc(C.docFmt(S.res[0].doc_tipo || '', S.res[0].doc_numero || '')) + '</div>';
    } else {
      h += '<div class="ms-campo"><label for="msBusca">Busca el servicio: código, nombre, cédula o RIF</label><div class="busca-linea"><input class="campo" id="msBusca" maxlength="60" autocomplete="off" enterkeyhint="search" value="' + esc(S.q || '') + '"><button type="button" class="btn btn-2 btn-chico" data-ms="buscar">Buscar</button></div>' + errSol('busca') + '</div>';
      if(S.buscando) h += '<p class="nota-chica"><span class="cargando-linea"><i></i>Buscando en el TAD…</span></p>';
      else if(S.res){
        if(!S.res.length) h += '<p class="nota-chica">No aparece en el TAD. Revisa el código o el nombre, o escribe el RIF sin guiones.</p>';
        S.res.forEach((x, i) => {
          h += '<div class="cam-tit"><b>' + esc(x.nombre || 'Sin nombre') + '</b><small>' + esc(C.docFmt(x.doc_tipo || '', x.doc_numero || '')) + ' · ' + plural(x.servicios.length, 'servicio', 'servicios') + '</small>' +
            x.servicios.map((s) => '<label class="cam-srv"><input type="checkbox" data-mssrv="' + esc(s.clave) + '" data-tit="' + i + '"' + (S.sel[s.clave] ? ' checked' : '') + '><span><b>' + esc(s.sucursal + '-' + s.codigo) + ' · ' + esc(C.sucursal(s.sucursal)) + '</b><small>' +
              esc([s.plan, s.categoria, s.estado].filter(Boolean).join(' · ')) + '</small><small>' + esc(s.direccion || 'Sin dirección') + '</small></span></label>').join('') + '</div>';
        });
      }
      h += errSol('servicios');
      if(t) h += '<div class="ms-box"><small>Titular actual</small><b>' + esc(t.nombre || 'Sin nombre') + '</b>' + esc(C.docFmt(t.doc_tipo || '', t.doc_numero || '')) + '</div>';
    }
    if(S.desde && S.desde.reporte){
      const r = S.desde.reporte;
      h += '<div class="ms-nota">El reporte vio ' + esc((S.desde.categoria_anterior || '?') + ' → ' + (S.desde.categoria_nueva || '?')) + ' el ' + esc(diaMes(r.fecha + 'T12:00:00')) + '. Si además cambió el titular, elige "Migración y cambio de titular".</div>';
    }
    const tipos = S.desde ? ['migracion', 'titularidad', 'ambos'] : ['migracion', 'titularidad', 'ambos', 'residencial'];
    h += '<div><p class="rotulo" id="msTipoR">Qué cambia</p><div class="ms-ops" role="radiogroup" aria-labelledby="msTipoR">' + tipos.map((x) => '<button type="button" role="radio" class="ms-op' + (S.tipo === x ? ' on' : '') + '" aria-checked="' + (S.tipo === x) + '" data-mstipo="' + x + '"><b>' + esc(TIPO[x]) + '</b><small>' + esc(AYUDA_TIPO[x]) + '</small></button>').join('') + '</div>' + errSol('tipo') + '</div>';
    if(S.tipo === 'residencial') h += '<div class="ms-campo"><label for="msMotivo">Motivo</label><textarea class="area corta" id="msMotivo" maxlength="500">' + esc(S.motivo || '') + '</textarea>' + errSol('motivo') + '<p class="nota-chica">Va directo al analista: no lleva documentos.</p></div>';
    if(!S.desde && P().elegir_lider) h += '<div class="ms-campo"><label for="msLider">Líder</label><select class="campo" id="msLider"><option value="">Sin líder</option>' + (D.lideres || []).map((l) => '<option value="' + esc(l.id) + '"' + (S.lider === l.id ? ' selected' : '') + '>' + esc(l.nombre) + '</option>').join('') + '</select></div>';
    return h + errSol('general');
  }
  const cambiaTitular = () => S.tipo === 'titularidad' || S.tipo === 'ambos';
  const rifLeido = () => S.ocr && S.ocr.estado === 'ok' && /^rif_/.test(S.ocr.tipo || '') && S.ocr.datos && S.ocr.datos.rif;
  const puedeSeguir2 = () => !!S.id || !cambiaTitular() || !!rifLeido();
  function paso2(){
    const t = titularElegido() || {};
    let h = '<div><p class="rotulo" id="msNatR">' + (cambiaTitular() ? 'A nombre de quién queda' : 'Queda a nombre de') + '</p><div class="ms-seg" role="radiogroup" aria-labelledby="msNatR">' +
      [[true, 'Persona natural'], [false, 'Empresa']].map((x) => '<button type="button" role="radio" class="' + (S.natural === x[0] ? 'on' : '') + '" aria-checked="' + (S.natural === x[0]) + '" data-msnat="' + x[0] + '"' + (S.id || !cambiaTitular() ? ' disabled' : '') + '>' + x[1] + '</button>').join('') + '</div></div>';
    if(S.id){
      const n = S.d && (S.d.nuevo || S.d.titular) || {};
      return h + '<div class="ms-box ve"><b>' + esc(n.nombre || '') + '</b><small>' + esc(C.docFmt(n.tipo || '', n.doc || '')) + '</small></div><p class="nota-chica">La solicitud ya se guardó con este titular. Si está mal, cancélala desde el cambio y regístrala de nuevo.</p>';
    }
    if(!cambiaTitular()) h += '<div class="ms-box"><small>Titular actual</small><b>' + esc(t.nombre || '') + '</b>' + esc(C.docFmt(t.doc_tipo || '', t.doc_numero || '')) + '</div>';
    const quien = S.natural ? 'de la persona' : 'de la empresa';
    h += '<div class="ms-drop" id="msRifZona" data-ms="rif" role="button" tabindex="0"><b>' + (S.leyendo ? 'Leyendo el RIF…' : S.archivo ? 'Cambiar el RIF' : 'Sube el RIF ' + quien) + '</b><small>' + (S.archivo ? esc(S.archivo.name) : 'Arrástralo aquí o toca para elegirlo o tomarle una foto. Se lee solo.') + '</small>' +
      (S.leyendo ? '' : '<span class="ms-b">Elegir archivo</span>') + '</div><input type="file" id="msRifArchivo" accept="application/pdf,image/jpeg,image/png" hidden>' + errSol('rif');
    if(!cambiaTitular() && !S.archivo) h += '<p class="nota-chica">Si su RIF ya está en el expediente, puedes seguir sin subirlo.</p>';
    const o = S.ocr;
    if(o && !S.leyendo){
      const d = o.datos || {};
      if(rifLeido()){
        h += '<div class="ms-box ve"><b>Leído del RIF</b><div class="ms-dat"><span><small>' + (/^[VE]/.test(d.rif) ? 'Nombre' : 'Razón social') + '</small>' + esc(d.razon_social || 'No se leyó') + '</span><span><small>RIF</small>' + esc(d.rif.charAt(0) + '-' + d.rif.slice(1)) + '</span>' +
          '<span><small>Domicilio</small>' + esc(d.domicilio || 'No se leyó') + '</span><span><small>Vencimiento</small>' + esc(d.vencimiento || 'No vence') + '</span></div></div>';
        if(o.dudosa) h += '<div class="ms-nota">Lectura dudosa: ' + esc((d.motivos || []).join(', ') || 'revisa los datos') + '. Si algo está mal, sube una foto más clara.</div>';
      } else if(o.estado === 'ok') h += '<div class="ms-nota ro">No parece un RIF' + (o.tipo === 'cedula' ? ': es una cédula' : '') + '. Sube el RIF ' + quien + '.</div>';
      else h += '<div class="ms-nota ro">No se pudo leer: ' + esc(o.error || 'sube una foto más clara') + '. Intenta con otra foto o el PDF.</div>';
    }
    const B = S.busq;
    if(B && !B.error && rifLeido()){
      if(B.estado === 'otro') h += '<div class="ms-nota ro">Ese RIF ya es cliente de otro líder. Puedes seguir: el administrador lo revisa.</div>';
      else if(B.estado === 'existe') h += '<div class="ms-nota gr">Ya es cliente: lo que ya está aprobado en su expediente no se vuelve a pedir.</div>';
      else if(S.parec && S.parec.posible) h += C.parecidoHtml(S.parec);
      else h += '<div class="ms-nota gr">No es cliente todavía: se crea al seguir.</div>';
    }
    return h + errSol('general');
  }
  const ESTADO_SOL = { aprobado: ['ve', 'Listo'], por_revisar: ['ve', 'Listo'], devuelto: ['ro', 'Devuelto'] };
  function paso3(){
    if(!S.d) return '<div class="sk-bloque"><span class="sk" style="height:110px;border-radius:14px"></span><span class="sk" style="height:180px;border-radius:14px"></span></div>' + errSol('general');
    const req = S.d.requisitos || [];
    let h = '<div class="ms-drop" id="msSoltar" data-ms="varios" role="button" tabindex="0"><b>Arrastra aquí los documentos</b><small>Todos juntos o uno por uno. También puedes tocar para elegirlos o tomar una foto.</small><span class="ms-b">Elegir archivos</span></div>' +
      '<input type="file" id="msArchivos" accept="application/pdf,image/*" multiple hidden>';
    h += '<div class="ms-box">' + (req.length ? req.map((r) => {
      const k = r.casilla + ':' + r.numero; const x = ESTADO_SOL[r.estado]; const sube = S.subiendo[k];
      const sub = sube ? 'Subiendo…' : r.estado === 'falta' ? (r.opcional ? 'Opcional: arrástralo aquí o toca Subir' : 'Arrástralo aquí o toca Subir') : r.estado === 'devuelto' ? 'Devuelto: súbelo de nuevo' : /^rif_/.test(r.casilla) && S.rifNombre ? 'El que subiste en el paso 2' : r.estado === 'aprobado' ? 'Ya está en su expediente' : 'En el expediente';
      return '<div class="ms-doc" data-msdoc="' + esc(k) + '"><span>' + esc(r.texto) + '<small>' + esc(sub) + '</small></span>' +
        (x && r.estado !== 'devuelto' ? '<i class="ms-ch ' + x[0] + '">' + x[1] + '</i>' : (r.opcional && r.estado === 'falta' ? '<i class="ms-ch gr">Opcional</i>' : '') + '<button type="button" class="ms-b" data-mssubir="' + esc(k) + '"' + (sube ? ' disabled' : '') + '>Subir</button>') + '</div>';
    }).join('') : '<p class="nota-chica">Este cambio no pide documentos.</p>') + '</div>';
    const f = faltanSol(); const n = req.filter((r) => !r.opcional).length;
    if(req.some((r) => r.opcional)) h += '<div class="ms-nota gr"><b>Persona natural · no amerita documentos.</b> Subirlos es opcional: puedes enviarla sin nada.</div>';
    else h += '<div class="ms-nota gr">' + (f ? 'Faltan ' + f + ' de ' + n + '. Puedes guardar y terminar después: queda en tus pendientes. <button type="button" class="enlace" data-ms="guardar">Guardar lo que llevo</button>' : 'Todo listo. Toca Siguiente para enviarla al administrador.') + '</div>';
    return h + errSol('general');
  }
  const faltanSol = () => S && S.d ? (S.d.requisitos || []).filter((r) => (r.estado === 'falta' || r.estado === 'devuelto') && !r.opcional).length : 0;
  function pasoEnviada(){
    const e = S.enviada; const ya = e.estado !== 'por_revisar';
    const ahora = new Date();
    return '<div class="ms-ok"><span class="ms-okc" aria-hidden="true">✓</span><b>' + (ya ? 'Aprobada' : 'En verificación') + '</b><p>' + (ya ? 'Sus documentos ya estaban aprobados: pasó directo al analista.' : 'El administrador revisa los documentos. Te avisamos apenas la apruebe o si hay que corregir algo.') + '</p></div>' +
      '<div class="ms-tl"><div class="ok"><i>✓</i><b>Enviada</b><small>' + esc(ahora.toLocaleDateString('es', { day: 'numeric', month: 'long' }) + ', ' + C.hora(ahora.toISOString())) + '</small></div>' +
      '<div class="' + (ya ? 'ok' : 'on') + '"><i>' + (ya ? '✓' : '2') + '</i><b>Verificación del administrador</b><small>Revisa los documentos</small></div>' +
      '<div class="' + (ya ? 'on' : '') + '"><i>3</i><b>Planilla y cambio en el sistema</b><small>Envías la planilla al cliente; tu analista hace el cambio</small></div>' +
      '<div><i>4</i><b>Confirmada y comisión</b><small>Entra a tu lista de Comisiones</small></div></div>' +
      '<div class="ms-box am"><b>Mientras tanto, adelanta la planilla</b>Ya está llena con el titular actual y el nuevo. Descárgala y envíasela al cliente para que la firme.' +
      '<div class="ms-acc"><button type="button" class="ms-b bl" data-ms="planilla">Descargar planilla</button><button type="button" class="ms-b bl" data-ms="planillaWa">Enviar por WhatsApp</button></div></div>';
  }
  function leerSol(){
    if(!S) return; const v = (id) => { const x = $(id); return x ? x.value : undefined; };
    [['msBusca', 'q'], ['msMotivo', 'motivo'], ['msLider', 'lider']].forEach((p) => { const x = v(p[0]); if(x !== undefined) S[p[1]] = x; });
  }
  async function buscarSol(){
    leerSol(); S.err = {}; const t = String(S.q || '').trim();
    if(t.replace(/\D/g, '').length < 2 && normalizeStr(t).length < 3){ S.err.busca = 'Escribe al menos 3 letras, el código o el RIF'; pintarSol(); return; }
    S.buscando = true; pintarSol(); const mio = S;
    try { const r = await rpc('servicios_buscar', { p_texto: t }); if(S !== mio) return; S.res = r.sin_indice ? [] : r.titulares || []; if(r.sin_indice) S.err.busca = 'Falta subir el TAD completo en Actualizar'; }
    catch (e) { if(S !== mio) return; S.err.busca = e.message; }
    S.buscando = false; pintarSol();
  }
  async function siguiente1(){
    leerSol(); S.err = {};
    const claves = Object.keys(S.sel).filter((k) => S.sel[k]);
    if(!claves.length) S.err.servicios = S.desde && !S.res ? 'Busca el servicio y márcalo' : 'Marca al menos un servicio';
    if(!S.tipo) S.err.tipo = 'Elige qué cambia';
    if(S.tipo === 'residencial' && String(S.motivo || '').trim().length < 4) S.err.motivo = 'Escribe el motivo';
    if(Object.keys(S.err).length){ pintarSol(); return; }
    if(S.tipo !== 'residencial'){ const t = titularElegido(); if(!cambiaTitular()) S.natural = /^[VE]/i.test((t && t.doc_tipo) || ''); S.paso = 2; pintarSol(); return; }
    S.ocupado = true; pintarSol();
    try {
      await rpc('cambio_crear', { p_datos: { tipo: 'residencial', servicios: claves, motivo: String(S.motivo).trim(), lider_id: S.lider || null } });
      toast('Cambio registrado. Le llega al analista'); S.id = null; cerrarSolicitud();
    } catch (e) { if(!S) return; S.ocupado = false; S.err.general = e.message; pintarSol(); }
  }
  async function leerRifSol(file){
    if(!S) return; S.err = {};
    if(!/^(application\/pdf|image\/(jpeg|png))$/i.test(file.type)){ S.err.rif = 'Sube el RIF en PDF, JPG o PNG'; pintarSol(); return; }
    if(file.size > 10 * 1024 * 1024){ S.err.rif = 'El archivo pesa más de 10 MB'; pintarSol(); return; }
    S.archivo = file; S.leyendo = true; S.ocr = null; S.busq = null; pintarSol();
    const mio = S; let o;
    try {
      const s = await window.db.auth.getSession(); const tk = (s.data && s.data.session && s.data.session.access_token) || '';
      if(!tk) throw new Error('Tu sesión venció. Entra de nuevo');
      const fd = new FormData(); fd.append('archivo', file, file.name);
      const r = await fetch(window.db.supabaseUrl + '/functions/v1/ocr_leer', { method: 'POST', headers: { Authorization: 'Bearer ' + tk, apikey: window.db.supabaseKey }, body: fd });
      o = await r.json().catch(() => ({ estado: 'sin_lectura', error: 'Respuesta inválida' }));
      if(!r.ok && !o.estado) o = { estado: 'sin_lectura', error: o.error || 'No se pudo leer' };
    } catch (e) { o = { estado: 'sin_lectura', error: navigator.onLine === false ? 'Sin conexión' : e.message }; }
    if(S !== mio) return;
    S.leyendo = false; S.ocr = o;
    if(rifLeido()){
      const d = o.datos; S.natural = /^[VE]/.test(d.rif);
      try { S.busq = await rpc('cliente_rif_buscar', { p_rif: d.rif.charAt(0) + '-' + d.rif.slice(1), p_nombre: d.razon_social || null }); } catch (e) { S.busq = { error: e.message }; }
      S.parec = S.busq && S.busq.estado !== 'existe' && S.busq.estado !== 'otro' ? await C.buscarParecido(d.razon_social, d.rif) : null;   // lote 16/11 B
      if(S !== mio) return;
    }
    pintarSol();
  }
  async function siguiente2(){
    if(S.id){ S.paso = 3; pintarSol(); return; }
    S.err = {};
    if(cambiaTitular() && !rifLeido()){ S.err.rif = 'Sube el RIF del nuevo titular: se lee solo'; pintarSol(); return; }
    const claves = Object.keys(S.sel).filter((k) => S.sel[k]); const o = S.ocr; const d = (o && o.datos) || {};
    let nuevo = null;
    if(cambiaTitular()){
      const nat = /^[VE]/.test(d.rif);
      nuevo = { tipo: d.rif.charAt(0), doc: nat ? d.rif.slice(1, -1) : d.rif.slice(1), nombre: d.razon_social || '', natural: nat, domicilio: d.domicilio || null, ocr: { estado: o.estado, tipo: o.tipo || null, dudosa: !!o.dudosa } };
    }
    S.ocupado = true; pintarSol();
    try {
      const id = await rpc('cambio_crear', { p_datos: { tipo: S.tipo, servicios: claves, borrador: true, desde: S.desde ? S.desde.id : null, lider_id: S.lider || null, nuevo } });
      if(!S) return; S.id = Number(id); S.ocupado = false; S.paso = 3;
      await cargarSol();
      // Lote 16/11 B: si el expediente ya tiene todo aprobado, no se piden documentos: pasa directo a Enviar
      const req = (S.d && S.d.requisitos) || [];
      if(req.length && req.every((r) => r.estado === 'aprobado') && !(S.archivo && rifLeido() && !S.rifSubido)){ S.paso = 4; pintarSol(); return enviarSol(); }
      pintarSol();
      if(S.archivo && rifLeido() && !S.rifSubido) subirRifSol();
    } catch (e) { if(!S) return; S.ocupado = false; S.err.general = e.message; pintarSol(); }
  }
  async function cargarSol(){
    if(!S || !S.id) return; const mio = S;
    try { const d = await rpc('cambio_detalle', { p_id: S.id }); if(S !== mio) return; S.d = d; if(!S.tipo) S.tipo = d.tipo; }
    catch (e) { if(S !== mio) return; S.err.general = e.message; }
  }
  const recargarSol = () => { if(S) cargarSol().then(pintarSol); };
  async function fichaSol(){ const F = await fichaDestino(S.d); if(!F) throw new Error('No encontré el expediente del cliente'); return F; }
  async function subirRifSol(){
    const nat = /^[VE]/.test(S.ocr.datos.rif); const cas = nat ? 'rif_personal' : 'rif_empresa'; const num = nat ? 1 : 0; const k = cas + ':' + num;
    const r = (S.d.requisitos || []).find((x) => x.casilla === cas);
    if(r && r.estado !== 'falta'){ S.rifSubido = true; return; }   // ya está en el expediente: no se pisa
    await subirCasillaSol(r ? r.casilla + ':' + r.numero : k, S.archivo); S.rifSubido = true; S.rifNombre = S.archivo.name;
  }
  async function subirCasillaSol(k, file){
    if(!S) return; const [cas, num] = k.split(':'); let F;
    try { F = await fichaSol(); } catch (e) { toast(e.message, 'error'); return; }
    const mio = S; S.subiendo[k] = true; pintarSol();
    const fin = () => { if(S !== mio) return; delete S.subiendo[k]; recargarSol(); };
    const ok = file ? window.Ficha.subirArchivoA(F, cas, Number(num), file, fin) : (window.Ficha.subirA(F, cas, Number(num), fin), true);
    if(!file) { delete S.subiendo[k]; pintarSol(); }
    if(ok === false){ delete S.subiendo[k]; pintarSol(); toast('Hay otra subida en curso. Espera a que termine e intenta de nuevo', 'error'); }
  }
  async function variosSol(files){
    let F; try { F = await fichaSol(); } catch (e) { toast(e.message, 'error'); return; }
    window.Ficha.variosA(F, recargarSol, files || []);
  }
  async function enviarSol(){
    S.err = {}; S.ocupado = true; pintarSol(); const mio = S;
    try { const r = await rpc('cambio_enviar', { p_id: S.id }); if(S !== mio) return; S.ocupado = false; S.enviada = r; pintarSol(); }
    catch (e) { if(S !== mio) return; S.ocupado = false; S.err.general = e.message; await cargarSol(); pintarSol(); }
  }

  // ---------- Recordar y Enviar pendientes (mismos permisos que Comisiones) ----------
  async function recordar(b, o){
    const t = b ? b.textContent : ''; if(b){ b.disabled = true; b.textContent = 'Abriendo…'; }
    try {
      const r = await rpc('cambio_recordar', o);
      const l = (r.items || []).map((x) => { const s = (x.servicios || [])[0] || {}; return '• ' + (x.titular || 'Cliente') + (s.codigo ? ' (' + [s.sucursal, String(s.codigo).replace(/^0+/, '')].filter(Boolean).join('-') + ')' : '') + ', ' + (x.estado === 'sin_registro' ? 'hecha el ' + diaMes(x.fecha) + ' sin registrar' : x.borrador ? 'solicitud sin enviar' : 'faltan documentos'); });
      const txt = 'Hola, ' + C.primerNombre(r.lider) + '. ' + (l.length === 1 ? 'Esta migración ya está hecha en el sistema y falta registrarla' : 'Estas migraciones ya están hechas en el sistema y falta registrarlas') +
        ' en la app con sus documentos para que entren a tu comisión:\n' + l.join('\n') + '\nEntra a Migraciones y toca Registrar. Gracias.';
      if(r.telefono) window.open(C.enlaceWa(r.telefono, txt), '_blank', 'noopener');
      else { window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank', 'noopener'); toast('El líder no tiene WhatsApp guardado en Usuarios: elige el contacto'); }
    } catch (e) { toast(e.message, 'error'); }
    if(b){ b.disabled = false; b.textContent = t; }
  }

  // Ficha del cliente donde van los documentos del cambio, con las casillas del cambio de titular
  async function fichaDestino(d){
    const cli = d.tipo === 'migracion' ? d.cliente_id : d.nuevo && d.nuevo.cliente_id; if(!cli) return null;
    const F = await rpc('cliente_ficha', { p_cliente: cli });
    if(d.tipo === 'titularidad' || d.tipo === 'ambos') F.extraCasillas = [{ k: 'otro:80', t: 'Planilla de cambio de titular firmada' }, { k: 'otro:81', t: 'Cédula o RIF del titular actual' }];
    return F;
  }
  async function subirVarios(files){
    if(!V || !V.d) return;
    try { const F = await fichaDestino(V.d); if(!F) return; window.Ficha.variosA(F, () => { cargarDetalle(); cargar(); }, files); }
    catch (e) { toast('No se pudieron preparar los documentos: ' + e.message + '. Súbelos desde el cambio', 'error'); }
  }

  // ---------- Detalle: estado, servicios, documentos, planilla, acciones y bitácora ----------
  async function abrirDetalle(id, o){
    V = { id, d: null, planilla: !!(o && o.planilla) };
    hoja('hojaCambio', 'tCam').innerHTML = cab('tCam', 'Cambio', '') + '<div class="hoja-cuerpo" id="cCam"><div class="sk-bloque"><span class="sk" style="height:64px;border-radius:16px"></span><span class="sk" style="height:64px;border-radius:16px"></span></div></div><div class="hoja-pie hidden" id="pCam"></div>';
    abrirHoja('hojaCambio'); await cargarDetalle();
  }
  async function cargarDetalle(){
    if(!V) return; const mio = V;
    try { const d = await rpc('cambio_detalle', { p_id: V.id }); if(V !== mio) return; V.d = d; pintarDetalle(); }
    catch (e) { if(V !== mio) return; const z = $('cCam'); if(z) z.innerHTML = '<div class="vacio" role="alert"><b>No se pudo abrir el cambio</b><p>' + esc(e.message) + '</p><button type="button" class="btn btn-chico" data-cam="reDetalle">Reintentar</button></div>'; }
  }
  const fila = (etq, valor) => '<div class="dato-f"><span>' + esc(etq) + '</span><b>' + valor + '</b></div>';
  const ESTADO_DOC = { aprobado: ['verde', 'Aprobado'], por_revisar: ['ambar', 'Por revisar'], devuelto: ['rojo', 'Devuelto'], falta: ['rojo', 'Falta'] };
  function siguePaso(d){
    if(d.estado === 'por_revisar') return d.docs && d.docs.faltan ? 'Faltan documentos. Súbelos aquí abajo; el administrador los revisa en el expediente.' : 'El administrador revisa los documentos. Al aprobarlos pasa solo al analista.';
    if(d.estado === 'por_emitir') return d.puedo_hecho ? 'Hazlo en Proham (plan y categoría a la vez) y toca Hecho.' : 'El analista del líder lo hace en Proham y marca Hecho.';
    if(d.estado === 'por_confirmar') return d.aviso ? AVISO[d.aviso] + ' en Proham. Se confirma con la siguiente carga del TAD.' : 'Se confirma solo con la siguiente carga del TAD completo.';
    if(porDecidir(d)) return 'Confirmada. El administrador o la Senior deciden si comisiona (Sí o No con motivo). Solo el Sí entra al corte.';
    if(d.estado === 'confirmado') return d.pagado_fuera ? 'Histórico: se pagó fuera de la app. No entra al corte.' : d.tipo === 'residencial' ? 'Cuenta como indicador negativo del líder.' : d.comision === 'si' ? 'Comisiona en el corte con la regla de siempre (Legal y pago).' : 'No comisiona.';
    if(d.estado === 'sin_registro') return d.tipo === 'residencial' ? 'Pasó a residencial sin registro. Asígnalo a un líder para contarlo como indicador negativo, o márcalo como error o revertido.' : d.dueno_id ? 'Ya se hizo en el sistema y nadie la registró. ' + (yo && yo.rol === 'lider' ? 'Toca Registrar y sube sus documentos para que entre a tu comisión.' : 'El líder la registra con sus documentos.') : 'Ya se hizo en el sistema y no tiene líder. Asígnala a un líder, o márcala como error o revertida.';
    if(d.estado === 'por_revisar' && d.borrador) return 'Solicitud guardada sin enviar. Toca Seguir para subir lo que falta y enviarla.';
    return d.cierre_nota || '';
  }
  function pintarDetalle(){
    const d = V.d; const P = (D && D.puedo) || {}; const e = ESTADO[d.estado] || ['', d.estado];
    $('tCam').textContent = TIPO[d.tipo] || 'Cambio';
    let h = '<div class="estado ' + (e[0] || 'gris') + '"><b>' + esc(e[1]) + '</b><small>' + esc(siguePaso(d)) + '</small></div>';
    if(window.Contacto) h += window.Contacto.boton('cambio', d.id || V.id, '', d.estado + ':' + (d.aviso || ''));   // Lote A: contactar a quien tiene el paso
    if(d.aviso && d.estado !== 'confirmado') h += '<div class="al-banda ambar" role="note"><b>' + esc(AVISO[d.aviso]) + '</b><p>El TAD ya muestra ' + (d.aviso === 'falta_plan' ? 'la categoría PYME, pero el plan sigue siendo residencial.' : 'el plan EMP, pero la categoría sigue siendo residencial.') + ' Pide que lo completen en Proham.</p></div>';
    if(d.tipo === 'residencial' && d.motivo) h += '<div class="al-banda rojo" role="note"><b>Cambio a residencial</b><p>' + esc(d.motivo) + '</p></div>';
    const t = d.titular || {};
    h += '<div class="datos">' + fila(d.nuevo ? 'Titular actual' : 'Titular', esc(t.nombre || 'Sin nombre') + ' <small>' + esc(C.docFmt(t.tipo || '', t.doc || '')) + '</small>') +
      (d.nuevo ? fila('Nuevo titular', esc(d.nuevo.nombre) + ' <small>' + esc(C.docFmt(d.nuevo.tipo || '', d.nuevo.doc || '')) + '</small>') +
        (d.nuevo.rep_nombre ? fila('Representante legal', esc(d.nuevo.rep_nombre) + (d.nuevo.rep_cedula ? ' <small>V-' + esc(d.nuevo.rep_cedula) + '</small>' : '')) : '') : '') +
      (d.categoria_anterior || d.categoria_nueva ? fila('Categoría', esc((d.categoria_anterior || '?') + ' a ' + (d.categoria_nueva || '?'))) : '') +
      (d.plan_anterior || d.plan_nuevo ? fila('Plan', esc((d.plan_anterior || '?') + ' a ' + (d.plan_nuevo || '?'))) : '') +
      fila('Líder', esc(d.lider || 'Sin líder')) +
      fila('Registro', esc(d.origen === 'historico' ? 'Histórico del consolidado' : d.origen === 'tad' ? 'Visto en el TAD, ' + fecha(d.creado_en) : (d.creado_por || '') + ', ' + fecha(d.creado_en))) +
      (d.fecha_cambio ? fila('Fecha del cambio', esc(fecha(d.fecha_cambio))) : '') +
      (d.emitido_en ? fila('Hecho en Proham', esc((d.emitido_por || '') + ', ' + fecha(d.emitido_en))) : '') +
      (d.nota ? fila('Nota', esc(d.nota)) : '') + '</div>';
    h += '<div class="secc">Servicios<span class="der">' + (d.servicios || []).length + '</span></div><div class="datos">' + (d.servicios || []).map((s) => fila((s.sucursal ? s.sucursal + '-' : '') + s.codigo,
      esc([s.plan, s.categoria, s.equipo ? 'Equipo ' + s.equipo : ''].filter(Boolean).join(' · ')) + '<small class="ded-gris"> ' + esc(s.direccion || '') + '</small>')).join('') + '</div>';
    // Documentos del cambio, con su estado en el expediente
    const req = d.requisitos || [];
    if(req.length){
      const falta = req.filter((r) => r.estado === 'falta' || r.estado === 'devuelto').length;
      const abierto = ['por_revisar', 'por_emitir', 'por_confirmar', 'sin_registro'].indexOf(d.estado) >= 0 || (d.origen === 'historico' && falta);
      h += '<div class="secc">Documentos<span class="der">' + (falta ? (falta === 1 ? 'Falta 1' : 'Faltan ' + falta) : req.every((r) => r.estado === 'aprobado') ? 'Aprobados' : 'Por revisar') + '</span></div>' +
        '<p class="nota-chica">Van al expediente de ' + esc(d.tipo === 'migracion' ? 'este cliente' : 'el nuevo titular') + '.</p>' +
        req.map((r) => { const x = ESTADO_DOC[r.estado] || ['', r.estado]; return '<div class="chk"><i class="' + (r.estado === 'aprobado' ? 'ok">' + ic('check') : 'no">') + '</i><span>' + esc(r.texto) + ' <span class="chip ' + x[0] + '">' + esc(x[1]) + '</span></span>' +
          ((r.estado === 'falta' || r.estado === 'devuelto') && abierto ? '<button type="button" class="mini pri" data-cam-subir="' + esc(r.casilla + ':' + r.numero) + '">Subir</button>' : '') + '</div>'; }).join('') +
        (abierto && falta ? '<button type="button" class="btn btn-chico btn-2" data-cam="varios" style="margin-top:10px">' + ic('subir') + 'Subir varios</button>' : '') +
        ((d.tipo === 'migracion' ? d.cliente_id : d.nuevo && d.nuevo.cliente_id) ? '<button type="button" class="exp" data-cam="expediente"><span>Abrir expediente<small>Documentos, contacto e hilo</small></span>' + ic('derecha', 'ch') + '</button>' : '');
    }
    if((d.tipo === 'titularidad' || d.tipo === 'ambos') && d.nuevo){
      h += '<div class="secc">Planilla de cambio de titular</div>' + (V.planilla ? '<div class="al-banda verde" role="status"><b>Planilla lista</b><p>Descárgala o envíala por WhatsApp para que la firmen los dos titulares.</p></div>' : '') +
        '<p class="nota-chica">La oficial, con los datos del cambio. Se imprime, la firman y ponen las huellas ambos titulares, y se sube en Documentos.</p>' +
        '<div class="acc-prof"><button type="button" class="mini" data-cam="planilla">' + ic('doc') + 'Descargar</button><button type="button" class="mini pri" data-cam="planillaWa">' + ic('wa') + 'Enviar por WhatsApp</button></div>';
    }
    if(d.estado === 'sin_registro' && P.sin_registro) h += '<div class="secc">¿De quién es?</div><label class="rotulo" for="camLider">Asignar a un líder</label><select class="campo" id="camLider"><option value="">Elige el líder</option>' +
      ((D && D.lideres) || []).map((l) => '<option value="' + esc(l.id) + '"' + (l.id === (d.dueno_id || d.sugerido_id) ? ' selected' : '') + '>' + esc(l.nombre) + '</option>').join('') + '</select><div class="error" id="eCamLider" role="alert"></div>' +
      (d.sugerido && !d.dueno_id ? '<p class="nota-chica">Sugerido por el comentario del reporte' + (d.reporte && d.reporte.comentario ? ' ("' + esc(d.reporte.comentario) + '")' : '') + '. Confírmalo o elige otro.</p>' : '') +
      '<p class="nota-chica">Al asignarlo, el líder la registra con sus documentos y se le recuerda. Un cambio a residencial queda confirmado como indicador negativo del líder.</p>';
    const notaAcc = (porDecidir(d) && yo && (yo.rol === 'admin' || yo.senior)) || (d.estado === 'por_revisar' && P.revisar) || d.estado === 'sin_registro' || ((d.estado === 'por_emitir' || d.estado === 'por_confirmar') && P.confirmar) || puedeCancelar(d);
    if(notaAcc) h += '<label class="rotulo arriba" for="camNotaAcc">Nota</label><textarea class="area corta" id="camNotaAcc" maxlength="500"></textarea><div class="error" id="eCamAcc" role="alert"></div>';
    h += '<div class="secc">Qué ha pasado</div>' + ((d.bitacora || []).length ? '<div class="datos">' + d.bitacora.map((x) => fila(fecha(x.en) + ' ' + C.hora(x.en), esc(TEXTO_BIT[x.accion] || x.accion) + (x.por ? ' · ' + esc(C.primerNombre(x.por)) : ''))).join('') + '</div>' : '<p class="nota-chica">Sin movimientos.</p>');
    $('cCam').innerHTML = h; if(window.Contacto) window.Contacto.llenar($('cCam'));
    // Acciones según el estado y quién mira
    const acc = [];
    if(puedeCancelar(d)) acc.push(['cancelar', 'Cancelar', 'btn-2']);
    if(d.estado === 'por_revisar' && P.revisar) acc.push(['pasar', 'Pasar al analista', 'btn-2']);
    if((d.estado === 'por_emitir' || d.estado === 'por_confirmar') && P.confirmar) acc.push(['confirmar', 'Confirmar a mano', 'btn-2']);
    if(d.puedo_hecho) acc.push(['hecho', 'Hecho', '']);
    if(d.estado === 'sin_registro' && d.tipo !== 'residencial' && yo && yo.rol === 'lider' && !P.lectura) acc.push(['registrar', 'Registrar', '']);
    if(d.estado === 'por_revisar' && d.borrador && yo && (yo.rol === 'admin' || d.creado_por === yo.nombre || d.dueno_id === yo.id) && !P.lectura) acc.push(['seguir', 'Seguir', '']);
    if(P.lectura) acc.length = 0;
    if(porDecidir(d) && yo && (yo.rol === 'admin' || yo.senior) && !P.lectura){ acc.push(['decidir_no', 'No comisiona', 'btn-2']); acc.push(['decidir_si', 'Sí comisiona', '']); }
    if(d.estado === 'sin_registro' && P.sin_registro){ acc.push(['error', 'Fue un error', 'btn-2']); acc.push(['revertido', 'Revertido', 'btn-2']); acc.push(['asignar', 'Asignar', '']); }
    const p = $('pCam'); p.classList.toggle('hidden', !acc.length);
    p.innerHTML = acc.map((a) => '<button type="button" class="btn ' + a[2] + '" data-cam-acc="' + a[0] + '">' + esc(a[1]) + '</button>').join('');
  }
  const puedeCancelar = (d) => (d.estado === 'por_revisar' || d.estado === 'por_emitir') && !!yo && (yo.rol === 'admin' || d.creado_por === yo.nombre);
  const TEXTO_BIT = { cambio_creado: 'Registró el cambio', cambio_docs_aprobados: 'Documentos aprobados: pasó al analista', cambio_pasar: 'Lo pasó al analista', cambio_hecho: 'Marcó Hecho en Proham',
    cambio_cancelar: 'Canceló', cambio_confirmar: 'Confirmó a mano', cambio_confirmado: 'Quedó confirmado', cambio_asignar: 'Lo asignó a un líder', cambio_error: 'Marcó que fue un error',
    cambio_revertido: 'Marcó revertido', cambio_sin_registro: 'El reporte o el TAD lo mostró sin registro', cambio_historico: 'Cargado del histórico',
    cambio_borrador: 'Guardó la solicitud sin enviar', cambio_enviado: 'Envió la solicitud', cambio_reporte: 'El reporte de cambios de categoría trajo la fecha', cambio_recordar: 'Se lo recordaron al líder' };
  async function accion(b, a){
    const d = V.d;
    if(a === 'registrar'){ cerrarHoja(true); abrirSolicitud({ desde: d }); return; }
    if(a === 'decidir_si' || a === 'decidir_no'){
      const mot = $('camNotaAcc') ? $('camNotaAcc').value.trim() : ''; const er = $('eCamAcc');
      if(mot.length < 4){ if(er){ er.textContent = 'Escribe el motivo'; $('camNotaAcc').focus(); } return; }
      const t0 = b.textContent; b.disabled = true; b.textContent = 'Guardando…';
      try { await rpc('cambio_comision', { p_id: d.id, p_si: a === 'decidir_si', p_motivo: mot }); toast(a === 'decidir_si' ? 'Comisiona: entra al corte' : 'Quedó sin comisión'); cargar(); cargarDetalle(); if(alCambiarLib) alCambiarLib(); }
      catch (e) { if(er) er.textContent = e.message; else toast(e.message, 'error'); b.disabled = false; b.textContent = t0; }
      return;
    }
    if(a === 'seguir'){ cerrarHoja(true); abrirSolicitud({ borrador: d }); return; }
    const nota = $('camNotaAcc') ? $('camNotaAcc').value.trim() : ''; const er = $('eCamAcc'); if(er) er.textContent = '';
    let lider = null;
    if(a === 'asignar'){ lider = $('camLider').value; if(!lider){ $('eCamLider').textContent = 'Elige el líder'; $('camLider').focus(); return; } }
    if((a === 'pasar' || a === 'confirmar') && !nota){ if(er){ er.textContent = a === 'pasar' ? 'Escribe por qué pasa sin todos los documentos aprobados' : 'Escribe por qué se confirma a mano'; $('camNotaAcc').focus(); } return; }
    const txt = b.textContent; b.disabled = true; b.textContent = 'Guardando…';
    try {
      await rpc('cambio_accion', { p_id: d.id, p_accion: a, p_nota: nota || null, p_lider: lider });
      toast({ hecho: 'Listo. Se confirma con la siguiente carga del TAD', pasar: 'Pasó al analista', cancelar: 'Cambio cancelado', confirmar: 'Confirmado',
        asignar: 'Asignado al líder. Ahora le toca registrarla', error: 'Marcado como error', revertido: 'Marcado como revertido' }[a] || 'Listo');
      cargar(); cargarDetalle();
    } catch (e) { if(er) er.textContent = e.message; else toast(e.message, 'error'); b.disabled = false; b.textContent = txt; }
  }
  // Planilla oficial con los datos del momento: titular actual del TAD (y del expediente si ya es cliente), nuevo titular de lo que escribió el líder
  function datosPlanilla(d0){
    const d = d0 || V.d; const t = d.titular || {}; const n = d.nuevo || d.titular || {}; const ka = d.actual_contacto || {}; const kn = d.nuevo_contacto || {}; const s = (d.servicios || [])[0] || {};
    const hoy = new Date(); const dd = (x) => String(x).padStart(2, '0');
    return { tipo: (t.natural ? 'natural' : 'juridico') + '_' + (n.natural ? 'natural' : 'juridico'), servicio: (d.servicios || []).map((x) => x.sucursal + '-' + x.codigo).join(', '),
      ubicacion: s.direccion || ka.direccion || '', fecha: dd(hoy.getDate()) + '/' + dd(hoy.getMonth() + 1) + '/' + hoy.getFullYear(),
      actual: { nombre: t.nombre, doc: C.docFmt(t.tipo || '', t.doc || ''), natural: t.natural === null || t.natural === undefined ? undefined : !!t.natural, direccion: ka.direccion || '', correo: ka.correo || '', telefono: ka.telefono || '' },
      nuevo: { nombre: n.nombre, doc: C.docFmt(n.tipo || '', n.doc || ''), natural: !!n.natural, direccion: kn.direccion || n.domicilio || '', correo: kn.correo || n.correo || '', telefono: kn.telefono || n.telefono || '' } };
  }
  async function archivoPlanilla(d){
    d = d || V.d;
    const blob = await window.Documentos.planillaTitular(datosPlanilla(d));
    const nom = window.Documentos.nombreArchivo('cambio-de-titular', (d.titular || {}).nombre || 'cliente');
    return new File([blob], nom, { type: 'application/pdf' });
  }
  function puedeCompartir(){ try { return window.matchMedia('(pointer: coarse)').matches && !!navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.pdf', { type: 'application/pdf' })] }); } catch (e) { return false; } }
  async function descargarPlanilla(d){
    try { const f = await archivoPlanilla(d); window.Archivos.descargar(f, f.name); toast('Planilla descargada'); }
    catch (e) { toast(navigator.onLine === false ? 'Sin conexión: no se pudo traer la plantilla' : 'No se pudo armar la planilla. Intenta de nuevo', 'error'); }
  }
  async function enviarPlanilla(d){
    let f; try { f = await archivoPlanilla(d); } catch (e) { toast(navigator.onLine === false ? 'Sin conexión: no se pudo traer la plantilla' : 'No se pudo armar la planilla. Intenta de nuevo', 'error'); return; }
    const texto = 'Hola. Te envío la planilla de cambio de titular del servicio ' + datosPlanilla(d).servicio + '. Por favor imprímela, fírmenla con sus huellas los dos titulares y envíamela con la copia de la cédula o el RIF de ambos.';
    if(puedeCompartir()){
      try { await navigator.share({ files: [f], text: texto }); } catch (e) { if(!(e && e.name === 'AbortError')) toast('No se pudo abrir Compartir. Intenta de nuevo', 'error'); }
    } else { window.Archivos.descargar(f, f.name); window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank', 'noopener'); }
  }
  // Subir un documento del cambio al expediente que le toca
  async function subir(cas, num){
    let F; try { F = await fichaDestino(V.d); } catch (e) { toast(e.message, 'error'); return; }
    if(F) window.Ficha.subirA(F, cas, num, () => { cargarDetalle(); cargar(); });
  }

  // ---------- Eventos ----------
  const filaDe = (id) => ((D && D.filas) || []).find((c) => c.id === Number(id));
  function accionFila(b){
    const a = b.dataset.mg; const c = filaDe(b.dataset.id); if(!c) return;
    if(a === 'registrar') abrirSolicitud({ desde: c });
    else if(a === 'seguir') abrirSolicitud({ borrador: c });
    else if(a === 'recordar') recordar(b, { p_id: c.id });
    else if(a === 'cliente' && c.cliente_id) window.Ficha.abrir(c.cliente_id, { yo, alCerrar: cargar });
    else if(a === 'revisar'){ const cli = c.tipo === 'migracion' ? c.cliente_id : (c.nuevo && c.nuevo.cliente_id) || c.cliente_id; if(cli) window.Ficha.abrir(cli, { yo, tab: 'documentos', revisar: true, alCerrar: cargar }); }
    else abrirDetalle(c.id);
  }
  document.addEventListener('click', (ev) => {
    const t = ev.target; let b;
    if(S && (b = t.closest('[data-ms]'))){
      const a = b.dataset.ms;
      if(a === 'cerrar' || a === 'guardar') cerrarSolicitud();
      else if(a === 'buscar') buscarSol();
      else if(a === 'sig1') siguiente1();
      else if(a === 'sig2') siguiente2();
      else if(a === 'atras'){ S.err = {}; S.paso = Math.max(1, S.paso - 1); if(S.id && S.paso === 1) S.paso = 2; pintarSol(); }
      else if(a === 'rif'){ if(!S.leyendo){ const i = $('msRifArchivo'); if(i){ i.value = ''; i.click(); } } }
      else if(a === 'varios'){ const i = $('msArchivos'); if(i){ i.value = ''; i.click(); } }
      else if(a === 'enviar') enviarSol();
      else if(a === 'listo') cerrarSolicitud();
      else if(a === 'planilla' && S.d) descargarPlanilla(S.d);
      else if(a === 'planillaWa' && S.d) enviarPlanilla(S.d);
      return;
    }
    if(S && t.id === 'msFondo'){ cerrarSolicitud(); return; }
    if(S && (b = t.closest('[data-mstipo]'))){ leerSol(); S.tipo = b.dataset.mstipo; S.err.tipo = ''; pintarSol(); return; }
    if(S && (b = t.closest('[data-msnat]'))){ S.natural = b.dataset.msnat === 'true'; pintarSol(); return; }
    if(S && (b = t.closest('[data-mssubir]'))){ subirCasillaSol(b.dataset.mssubir, null); return; }
    if((b = t.closest('[data-cam]'))){
      const a = b.dataset.cam;
      if(a === 'nuevo') abrirSolicitud(); else if(a === 'reintentar') cargar(); else if(a === 'reDetalle') cargarDetalle();
      else if(a === 'planilla') descargarPlanilla();
      else if(a === 'planillaWa') enviarPlanilla();
      else if(a === 'varios') subirVarios([]);
      else if(a === 'expediente' && V && V.d){ const cli = V.d.tipo === 'migracion' ? V.d.cliente_id : V.d.nuevo && V.d.nuevo.cliente_id; if(cli) window.Ficha.abrir(cli, { yo, tab: 'documentos', alCerrar: cargarDetalle }); }
      return;
    }
    if((b = t.closest('[data-mg]'))){ accionFila(b); return; }
    if((b = t.closest('[data-mg-env]'))){ recordar(b, { p_lider: b.dataset.mgEnv }); return; }
    if((b = t.closest('[data-mg-pleg]'))){ const k = b.dataset.mgPleg; plegados[k] = !plegados[k]; const g = b.closest('.mg-g'); if(g){ g.classList.toggle('plegado', plegados[k]); b.setAttribute('aria-expanded', String(!plegados[k])); } return; }
    if((b = t.closest('[data-mgf]'))){ filtro = b.dataset.mgf; guardarUrl(); pintar(); return; }
    if((b = t.closest('[data-mgv]'))){ vista = b.dataset.mgv; guardarUrl(); pintar(); return; }
    if((b = t.closest('[data-cambio]'))){ abrirDetalle(Number(b.dataset.cambio)); return; }
    if((b = t.closest('[data-cam-acc]'))){ accion(b, b.dataset.camAcc); return; }
    if((b = t.closest('[data-cam-subir]'))){ const p = b.dataset.camSubir.split(':'); subir(p[0], Number(p[1])); return; }
  });
  document.addEventListener('keydown', (ev) => {
    if(S && ev.key === 'Escape'){ ev.preventDefault(); cerrarSolicitud(); return; }
    if(S && ev.key === 'Enter' && ev.target && ev.target.id === 'msBusca'){ ev.preventDefault(); buscarSol(); return; }
    if(S && (ev.key === 'Enter' || ev.key === ' ') && ev.target && ev.target.classList && ev.target.classList.contains('ms-drop')){ ev.preventDefault(); ev.target.click(); return; }
    if((ev.key === 'Enter' || ev.key === ' ') && ev.target && ev.target.classList && ev.target.classList.contains('mg-r') && ev.target === document.activeElement){ ev.preventDefault(); abrirDetalle(Number(ev.target.dataset.cambio)); }
  });
  document.addEventListener('change', (ev) => {
    if(!S || !ev.target) return;
    if(ev.target.id === 'msRifArchivo'){ const f = ev.target.files && ev.target.files[0]; if(f) leerRifSol(f); return; }
    if(ev.target.id === 'msArchivos'){ const fs = Array.from(ev.target.files || []); if(fs.length) variosSol(fs); return; }
    const x = ev.target.closest('[data-mssrv]'); if(!x) return;
    // Los servicios de un cambio son de un solo titular
    const tit = x.dataset.tit;
    if(x.checked) Object.keys(S.sel).forEach((k) => { const o = document.querySelector('[data-mssrv="' + k + '"]'); if(o && o.dataset.tit !== tit){ S.sel[k] = false; o.checked = false; } });
    S.sel[x.dataset.mssrv] = x.checked; S.err.servicios = ''; leerSol(); pintarSol();
  });
  // Soltar archivos: el RIF en el paso 2; varios juntos en la zona del paso 3 o uno en su casilla
  const zonaSol = (t) => t && t.closest && (t.closest('#msRifZona') || t.closest('#msSoltar') || t.closest('[data-msdoc]'));
  document.addEventListener('dragover', (ev) => { const z = S && zonaSol(ev.target); if(z){ ev.preventDefault(); z.classList.add('sobre'); } });
  document.addEventListener('dragleave', (ev) => { const z = S && zonaSol(ev.target); if(z) z.classList.remove('sobre'); });
  document.addEventListener('drop', (ev) => {
    const z = S && zonaSol(ev.target); if(!z) return; ev.preventDefault(); z.classList.remove('sobre');
    const fs = Array.from((ev.dataTransfer && ev.dataTransfer.files) || []); if(!fs.length) return;
    if(z.id === 'msRifZona') leerRifSol(fs[0]);
    else if(z.id === 'msSoltar') variosSol(fs);
    else if(S.d){ const r = (S.d.requisitos || []).find((x) => x.casilla + ':' + x.numero === z.dataset.msdoc); if(r && r.estado !== 'aprobado') subirCasillaSol(z.dataset.msdoc, fs[0]); }
  });

  // Página Migraciones
  window.Migracion = {
    usar(p){ yo = p; },
    // c: la migración como la trae Comisiones (bloques); o.alCerrar se llama al cerrar la solicitud
    registrar(c, o){ alCerrarLib = (o && o.alCerrar) || null; abrirSolicitud({ desde: c }); },
    seguir(c, o){ alCerrarLib = (o && o.alCerrar) || null; abrirSolicitud({ borrador: c }); },
    detalle(id, o){ alCambiarLib = (o && o.alCambiar) || null; abrirDetalle(Number(id)); }
  };
  if(!PAGINA) return;
  let tBusca = null;
  const bq = $('busca');
  const fb = $('formBusca'); if(fb) fb.addEventListener('submit', (e) => { e.preventDefault(); if(bq) bq.blur(); });
  if(bq) bq.addEventListener('input', () => { clearTimeout(tBusca); tBusca = setTimeout(() => { busca = bq.value.trim(); guardarUrl(); pintar(); }, 140); });
  window.Armazon.arrancar(['admin', 'analista', 'lider', 'gerencia'], { activo: 'migraciones' }, (p) => {
    yo = p; activo = true; window.Ficha.montar(); leerUrl();
    if(window.Resumen) window.Resumen.enModulo({ modulo: 'migraciones', yo: p });   // lote 27/10
    busca = (new URLSearchParams(location.search).get('q') || '').slice(0, 60); if(bq) bq.value = busca;
    if(!D){ const g = C.cache.leer('cambios:' + p.rol); if(g) D = g; }
    if(D) pintar(); cargar();
  }, (p) => { yo = p; });
})();
