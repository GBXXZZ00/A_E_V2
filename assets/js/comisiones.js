// Comisiones: quién cumple en el corte, qué le falta a cada cliente y cómo viene el mes.
(function(){
  'use strict';
  const { $, esc, ic, rpc, toast, cache, esqueleto, vacio, fecha, mes, capital, plural, chipEstatus, docFmt, abrirHoja, cerrarHoja, hojaAbierta, casilla, MOTIVOS, primerNombre, dia } = window.Comun;
  const S = window.Sesion;
  const FILTROS = [
    { id: 'todos', t: 'Todos' }, { id: 'ultimo', t: 'Último corte' }, { id: 'legal', t: 'Falta legal' },
    { id: 'pago', t: 'Debe instalación' }, { id: 'instalar', t: 'Por instalar' }
  ];
  const TOPE = 8;   // filas por bloque antes de "Ver más"
  let yo = null; let d = null; let filtro = 'todos'; let corte = ''; let pedido = 0;
  const abiertos = {}; const completos = {};

  function leerUrl(){
    const u = new URLSearchParams(location.search);
    const f = u.get('f'); filtro = FILTROS.some((x) => x.id === f) ? f : 'todos';
    const c = u.get('c'); corte = /^\d{4}-(0[1-9]|1[0-2])/.test(c || '') ? c.slice(0, 7) + '-01' : '';
  }
  function guardarUrl(){
    const u = new URLSearchParams();
    if(filtro !== 'todos') u.set('f', filtro);
    if(d && corte && corte !== d.actual) u.set('c', corte.slice(0, 7));
    const s = u.toString();
    history.replaceState(history.state, '', location.pathname + (s ? '?' + s : ''));
  }
  const nombreCorte = (c) => capital(mes(c + 'T12:00:00Z')) + ' ' + String(c).slice(0, 4);
  function menosMeses(c, n){ let a = Number(c.slice(0, 4)); let m = Number(c.slice(5, 7)) - n; while(m < 1){ m += 12; a--; } return a + '-' + String(m).padStart(2, '0') + '-01'; }

  function pasa(f){
    if(filtro === 'ultimo') return f.origen === 'anterior';
    if(filtro === 'legal') return !f.legal_ok;
    if(filtro === 'pago') return !f.pago_ok;
    return true;
  }
  function conteo(id){
    if(!d) return '';
    if(id === 'instalar') return d.corte === d.actual ? (d.por_instalar || []).length : '';
    if(id === 'todos') return d.filas.length;
    const g = filtro; filtro = id; const n = d.filas.filter(pasa).length; filtro = g; return n;
  }

  function pintarCorte(){
    const actual = d ? d.actual : corte; if(!actual) return;
    const ops = [0, 1, 2, 3, 4, 5].map((n) => menosMeses(actual, n));
    const elegido = d ? d.corte : corte; if(elegido && ops.indexOf(elegido) < 0) ops.push(elegido);
    $('corte').innerHTML = ops.map((c, i) => '<option value="' + c + '"' + (c === (d ? d.corte : corte) ? ' selected' : '') + '>' + esc(nombreCorte(c)) + (i === 0 ? ' (en curso)' : '') + '</option>').join('');
  }
  function pintarFiltros(){
    $('filtros').innerHTML = FILTROS.filter((f) => f.id !== 'instalar' || !d || d.corte === d.actual).map((f) => {
      const n = conteo(f.id);
      return '<button type="button" role="tab" data-filtro="' + f.id + '" class="' + (f.id === filtro ? 'on' : '') + '" aria-selected="' + (f.id === filtro) + '">' + esc(f.t) + (n === '' ? '' : ' <em>' + esc(n) + '</em>') + '</button>';
    }).join('');
  }
  function pintarMets(){
    const propias = d.filas.filter((f) => f.origen === 'corte'); const ult = d.filas.filter((f) => f.origen === 'anterior');
    const cumplen = d.filas.filter((f) => f.cumple).length;
    const enCurso = d.corte === d.actual;
    $('rango').textContent = 'Del ' + fecha(d.inicio) + ' al ' + fecha(d.fin) + (enCurso ? '. ' + (d.dias > 0 ? 'Faltan ' + plural(d.dias, 'día', 'días') : 'Cierra hoy') : '. Corte cerrado');
    $('mets').innerHTML =
      '<div class="met negro"><b>' + cumplen + '</b><small>' + (enCurso ? 'Cumplen hasta hoy' : 'Cumplieron') + ' de ' + d.filas.length + '</small></div>' +
      '<div class="met"><b>' + propias.length + '</b><small>Instaladas en el corte</small></div>' +
      '<div class="met"><b' + (ult.some((f) => !f.cumple) ? ' class="alerta"' : '') + '>' + ult.filter((f) => !f.cumple).length + '</b><small>En su último corte</small></div>' +
      '<div class="met solo-pc"><b>' + d.filas.filter((f) => !f.legal_ok).length + '</b><small>Les falta legal</small></div>' +
      '<div class="met solo-pc"><b>' + d.filas.filter((f) => !f.pago_ok).length + '</b><small>Deben la instalación</small></div>';
  }
  function marca(ok, texto, revisar){
    return '<span class="m ' + (ok ? 'verde' : revisar ? 'ambar' : 'rojo') + '">' + ic(ok ? 'check' : revisar ? 'alerta' : 'x') + esc(texto) + '</span>';
  }
  function fila(f){
    return '<button type="button" class="fila" data-com="' + esc(f.instalacion_id) + '" data-cliente="' + esc(f.cliente_id) + '">' +
      '<span class="tx"><b>' + esc(f.nombre) + '</b><small>' + esc(f.codigo || '') + ' · Instalado el ' + esc(fecha(f.instalada_en)) + '</small></span>' +
      '<span class="par-m">' + marca(f.legal_ok, 'Legal') + marca(f.pago_ok, f.revisar_pago ? 'Revisar pago' : 'Pago', f.revisar_pago) + '</span></button>';
  }
  function bloque(clave, titulo, filas, tono){
    if(!filas.length) return '';
    const todo = completos[clave] || filas.length <= TOPE; const ver = todo ? filas : filas.slice(0, TOPE);
    return '<div class="sub-bloque ' + (tono || 'liso') + '">' + esc(titulo) + '<span class="n2">' + filas.filter((f) => f.cumple).length + ' de ' + filas.length + ' cumplen</span></div>' +
      ver.map(fila).join('') +
      (todo ? '' : '<button type="button" class="fila mas" data-mas="' + esc(clave) + '">Ver ' + (filas.length - TOPE) + ' más</button>');
  }
  function pintarLista(){
    if(filtro === 'instalar'){
      const p = d.por_instalar || [];
      if(!p.length){ $('lista').innerHTML = vacio('Nada por instalar', 'No hay órdenes abiertas en este momento.'); return; }
      $('lista').innerHTML = '<div class="grupo abierto"><div class="sub-bloque liso" style="border-top:0">Órdenes abiertas<span class="n2">Aún no cuentan para el corte</span></div>' +
        p.map((o) => '<button type="button" class="fila" data-exp="' + esc(o.cliente_id) + '"><span class="tx"><b>' + esc(o.nombre) + '</b><small>' + esc(o.orden || '') + ' · ' + esc(o.lider || 'Sin líder') + ' · Creada el ' + esc(fecha(o.creada_en)) + '</small></span><span class="m azul">' + esc(o.etapa || 'Sin etapa') + '</span></button>').join('') + '</div>';
      return;
    }
    const filas = d.filas.filter(pasa);
    if(!filas.length){
      $('lista').innerHTML = d.filas.length ? vacio('Nada en este filtro', 'Prueba con otro filtro o mira todos.') : vacio('Sin instalaciones en este corte', 'Cuando se instale un servicio que comisiona aparecerá aquí.');
      return;
    }
    const grupos = []; const idx = {};
    filas.forEach((f) => { const l = f.lider || 'Sin líder'; if(idx[l] === undefined){ idx[l] = grupos.length; grupos.push({ lider: l, filas: [] }); } grupos[idx[l]].filas.push(f); });
    const solo = grupos.length === 1;
    $('lista').innerHTML = grupos.map((g) => {
      const cumplen = g.filas.filter((f) => f.cumple).length; const ult = g.filas.filter((f) => f.origen === 'anterior' && !f.cumple).length;
      const abierto = solo || abiertos[g.lider];
      return '<div class="grupo' + (abierto ? ' abierto' : '') + '" data-lider="' + esc(g.lider) + '">' +
        '<button type="button" class="grupo-cab" data-grupo="' + esc(g.lider) + '" aria-expanded="' + !!abierto + '"><span class="tx"><b>' + esc(g.lider) + '</b><small>' + plural(g.filas.length, 'instalación', 'instalaciones') +
          (ult ? ' · <span class="mal">' + ult + ' en último corte</span>' : '') + '</small></span><span class="num">' + cumplen + ' de ' + g.filas.length + '</span>' + ic('abajo') + '</button>' +
        '<div class="grupo-cuerpo">' +
          bloque(g.lider + '|a', 'Último corte: si no cumplen se pierden', g.filas.filter((f) => f.origen === 'anterior'), 'rojo') +
          bloque(g.lider + '|c', 'Instaladas en este corte', g.filas.filter((f) => f.origen === 'corte')) +
        '</div></div>';
    }).join('');
  }
  function pintarLado(){
    const comp = d.comparativa || []; const max = Math.max(1, ...comp.map((c) => c.total));
    const lid = d.lideres || []; const maxL = Math.max(1, ...lid.map((l) => Math.max(l.actual, l.anterior)));
    let h = '<div class="panel"><span class="tit">Últimos 6 cortes</span><p class="nota-chica">Instalaciones que comisionan en cada corte</p>' +
      comp.map((c) => '<div class="bar-fila"><span>' + esc(capital(mes(c.corte + 'T12:00:00Z')).slice(0, 3)) + '</span><span class="bar"><i class="' + (c.corte === d.actual ? 'curso' : '') + '" style="transform:scaleX(' + (c.total / max).toFixed(3) + ')"></i></span><b>' + esc(c.total) + '</b></div>').join('') + '</div>';
    if(lid.length > 1){
      h += '<div class="panel" style="margin-top:16px"><span class="tit">Por líder</span><p class="nota-chica">' + esc(nombreCorte(d.corte)) + ' frente al corte anterior</p>' +
        lid.map((l) => '<div class="bar-fila ancha"><span>' + esc(l.lider) + '</span><span class="bar"><i style="transform:scaleX(' + (l.actual / maxL).toFixed(3) + ')"></i></span><b>' + esc(l.actual) + '</b></div>' +
          '<div class="bar-fila ancha" style="margin-top:3px"><span class="nota-chica" style="margin:0">Anterior</span><span class="bar"><i class="curso" style="transform:scaleX(' + (l.anterior / maxL).toFixed(3) + ')"></i></span><b style="color:var(--text2)">' + esc(l.anterior) + '</b></div>').join('') + '</div>';
    }
    $('lado').innerHTML = h;
  }
  function pintar(){
    if(filtro === 'instalar' && d.corte !== d.actual) filtro = 'todos';
    pintarCorte(); pintarMets(); pintarFiltros(); pintarLista(); pintarLado();
  }

  async function cargar(){
    const mio = ++pedido; const clave = 'comisiones:' + (corte || 'actual');
    const guardado = cache.leer(clave);
    if(guardado && guardado.rol === yo.rol){ d = guardado; pintar(); }
    else { $('lista').innerHTML = esqueleto(5); $('mets').innerHTML = '<span class="sk" style="height:76px;border-radius:18px"></span><span class="sk" style="height:76px;border-radius:18px"></span><span class="sk" style="height:76px;border-radius:18px"></span>'; $('lado').innerHTML = ''; }
    try {
      const r = await rpc('comisiones_corte', { p_corte: corte || null });
      if(mio !== pedido) return;
      d = r; d.filas = d.filas || []; corte = d.corte; cache.guardar(clave, d);
      pintar(); guardarUrl();
    } catch (e) {
      if(mio !== pedido) return;
      if(!d) $('lista').innerHTML = '<div class="vacio" role="alert"><b>No se pudieron cargar las comisiones</b><p>' + esc(e.message) + '</p><button type="button" class="btn btn-chico" id="reintentar">Reintentar</button></div>';
      toast(e.message, 'error');
    }
  }

  // ---------- Hoja corta de comisión: solo lo que decide la comisión, con gestión ----------
  let K = null;   // { inst, cliente, F }
  function montarHoja(){
    if($('hojaComision')) return;
    const h = document.createElement('section'); h.id = 'hojaComision'; h.className = 'hoja lado corta';
    h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true'); h.setAttribute('aria-labelledby', 'tCom'); h.setAttribute('aria-hidden', 'true');
    h.innerHTML = '<div class="asa" aria-hidden="true"></div><div class="ficha-cab" id="cabCom"></div><div class="ficha-cuerpo" id="cuerpoCom"></div>';
    document.body.appendChild(h); window.Comun.prepararHojas();
    h.addEventListener('hoja-cerrada', () => { K = null; });
  }
  function abrirComision(inst, cliente){
    montarHoja();
    const f = d.filas.find((x) => String(x.instalacion_id) === String(inst)) || {};
    K = { inst: Number(inst), cliente: Number(cliente), F: null };
    $('cabCom').innerHTML = '<div class="f-cab"><div class="tx"><h2 class="nom" id="tCom">' + esc(f.nombre || 'Cliente') + '</h2><p class="dat">' + esc([f.sucursal && f.codigo ? f.sucursal + '-' + f.codigo : f.codigo, f.instalada_en ? 'Instalado el ' + fecha(f.instalada_en) : ''].filter(Boolean).join(' · ')) + '</p></div>' +
      '<button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div>';
    $('cuerpoCom').innerHTML = '<div class="sk-bloque"><span class="sk" style="height:64px;border-radius:16px"></span><span class="sk" style="height:150px;border-radius:16px"></span><span class="sk" style="height:90px;border-radius:16px"></span></div>';
    abrirHoja('hojaComision');
    cargarComision();
  }
  async function cargarComision(){
    if(!K) return; const mia = K;
    try { const F = await rpc('cliente_ficha', { p_cliente: mia.cliente }); if(K !== mia) return; K.F = F; pintarComision(); }
    catch (e) { if(K !== mia) return; $('cuerpoCom').innerHTML = '<div class="aviso" role="alert"><b>No se pudo abrir</b><p>' + esc(e.message) + '</p><p style="margin-top:14px"><button type="button" class="btn btn-chico" id="reintentarCom">Reintentar</button></p></div>'; toast(e.message, 'error'); }
  }
  // Una línea del checklist de Legal: hecha, por revisar, devuelta o por hacer
  function itemDoc(F, cas, num, nombre){
    const x = (F.documentos || []).find((y) => y.casilla === cas && y.numero === num); const k = cas + ':' + num;
    if(x && x.estado === 'aprobado') return [1, '<div class="chk"><i class="ok">' + ic('check') + '</i><span>' + esc(nombre) + '</span></div>'];
    if(x && x.estado === 'por_revisar') return [0, '<div class="chk"><i class="rv">' + ic('reloj') + '</i><span>' + esc(nombre) + '<small>Subido. Legal lo está revisando</small></span><button type="button" class="mini" data-ir-doc="' + k + '">Ver</button></div>'];
    if(x && x.estado === 'devuelto') return [0, '<div class="chk"><i class="no"></i><span>' + esc(nombre) + '<small class="mal">Devuelto' + (x.revisado_por ? ' por ' + esc(primerNombre(x.revisado_por)) : '') + (x.revisado_en ? ' ' + esc(dia(x.revisado_en).toLowerCase()) : '') + ': ' + esc((MOTIVOS[x.motivo] || 'revisa la nota').toLowerCase()) + (x.nota ? '. "' + esc(x.nota) + '"' : '') + '</small></span><button type="button" class="mini pri" data-ir-doc="' + k + '">Subir de nuevo</button></div>'];
    return [0, '<div class="chk"><i class="no"></i><span>' + esc(nombre) + '</span><button type="button" class="mini pri" data-ir-doc="' + k + '">Subir</button></div>'];
  }
  function itemDato(nombre, valor, clave){
    const v = String(valor || '').trim();
    if(v) return [1, '<div class="chk"><i class="ok">' + ic('check') + '</i><span>' + nombre + '<small>' + esc(v) + '</small></span></div>'];
    return [0, '<div class="chk"><i class="no"></i><span>' + nombre + '</span><button type="button" class="mini pri" data-ir-campo="' + clave + '">Escribir</button></div>'];
  }
  function pintarComision(){
    const F = K.F; const c = F.cliente; const i = (F.comision || []).find((x) => Number(x.id) === K.inst) || (F.comision || [])[0];
    const legalOk = !!c.legal_ok_en; const pagoOk = !!(i && i.pago_ok_en); const ok = legalOk && pagoOk; const ultimo = i && i.estado === 'ultimo_corte'; const perdida = i && i.estado === 'perdida';
    const nReq = !c.es_natural && c.regimen_firma === 'conjunta' ? 2 : 1;
    const nReps = Math.max(nReq, (F.representantes || []).reduce((a, r) => Math.max(a, r.orden), 1));
    let hechos = 0; let total = 0; let legal = '';
    const suma = (x, cuenta) => { if(cuenta){ total++; hechos += x[0]; } return x[1]; };
    for(let n = 1; n <= nReps; n++){
      const r = (F.representantes || []).find((x) => x.orden === n) || {}; const req = n <= nReq;
      legal += '<div class="sec">' + (c.es_natural ? 'Titular' : 'Representante ' + n) + (req ? '' : '<span>Opcional</span>') + '</div>' +
        suma(itemDato('Teléfono', r.telefono, 'rep:' + n), req) + suma(itemDato('Correo', r.correo, 'rep:' + n), req) +
        suma(itemDoc(F, 'cedula', n, 'Cédula'), req) + suma(itemDoc(F, 'rif_personal', n, 'RIF personal'), req);
    }
    if(!c.es_natural){
      legal += '<div class="sec">Empresa</div>' + suma(itemDato('Correo de la empresa', c.correo_empresa, 'correo_empresa'), true) +
        suma(itemDoc(F, 'rif_empresa', 0, 'RIF de la empresa'), true) + suma(itemDoc(F, 'acta_constitutiva', 0, 'Acta constitutiva'), true) + (c.es_isp ? suma(itemDoc(F, 'conatel', 0, 'Permiso de Conatel'), true) : '');
    }
    const fal = F.faltantes || [];
    const tituloEstado = !i || !i.comisiona ? 'Esta instalación no comisiona' : ok ? 'Cumple. Comisiona en ' + mes(i.corte_pago || i.corte) : perdida ? 'No cumplió a tiempo: se perdió' : ultimo ? 'Último corte: si no cumple el ' + fecha(F.corte.fin).split(' de ')[0] + ' se pierde' : 'Todavía no cumple';
    const sub = !i || !i.comisiona ? 'Los dedicados y las instalaciones de aliado no comisionan.' : perdida ? 'Era del corte de ' + mes(i.corte) + '.' : 'Corte de ' + mes(F.corte.etiqueta) + ', cierra el ' + fecha(F.corte.fin).split(' de ')[0] + '. ' + (F.corte.dias <= 0 ? 'Cierra hoy.' : 'Faltan ' + plural(F.corte.dias, 'día', 'días') + '.');
    const ns = (F.servicios || []).length;
    let h = '<div class="estado ' + (ok ? 'verde' : ultimo || perdida ? 'rojo' : 'ambar') + '"><b>' + esc(tituloEstado) + '</b><small>' + esc(sub) + '</small></div>' +
      '<button type="button" class="exp" id="abrirExp"><span>Abrir expediente del cliente<small>' + plural(ns, 'servicio', 'servicios') + ' en este ' + (c.es_natural ? 'documento' : 'RIF') + ' · datos, documentos e hilo</small></span>' + ic('derecha', 'ch') + '</button>' +
      '<div class="req"><div class="req-t">Legal<span class="m ' + (legalOk ? 'verde' : 'rojo') + '">' + (legalOk ? 'Cumple' : 'Falta') + '</span></div>' +
        '<p>' + (legalOk ? 'Cumplió el ' + esc(fecha(c.legal_ok_en)) + '.' : hechos + ' de ' + total + ' listos. Estatus: ' + esc((window.Comun.ESTATUS[c.estatus] || {}).t || c.estatus) + '.') + '</p>' + legal +
        (fal.length ? '<div class="chk"><span>¿No los tienes?</span><button type="button" class="mini" id="pedirCom">Pedir al cliente</button></div>' : '') + '</div>';
    if(i && i.comisiona){
      h += '<div class="req"><div class="req-t">Pago de instalación<span class="m ' + (pagoOk ? 'verde' : 'rojo') + '">' + (pagoOk ? 'Pagada' : 'Debe') + '</span></div>' +
        '<p>' + (pagoOk ? (i.pago_manual ? 'Marcada a mano el ' : 'Quedó sin deuda el ') + esc(fecha(i.pago_ok_en)) + '.' : ns > 1 ? 'Tiene ' + ns + ' servicios: el TAD no distingue cuál debe. Se revisa a mano.' : 'El TAD todavía la muestra con deuda.') + '</p>' +
        (F.puedo.pago ? '<div class="chk"><span>' + (pagoOk ? '¿Fue un error?' : 'Si ya pagó') + '</span><button type="button" class="mini' + (pagoOk ? '' : ' pri') + '" id="pagoCom" data-pagada="' + (pagoOk ? '0' : '1') + '">' + (pagoOk ? 'Quitar pago' : 'Marcar pagada') + '</button></div>'
          : pagoOk ? '' : '<p class="nota-chica">Lo marca cobranza o el administrador.</p>') + '</div>';
    }
    const mov = (F.hilo || []).slice(0, 4);
    h += '<div class="req"><div class="req-t">Qué ha pasado</div>' + (mov.length ? '<div class="hilo" style="padding:10px 0 0">' + mov.map(window.Ficha.lineaHilo).join('') + '</div>' : '<p>Todavía no hay movimientos.</p>') +
      ((F.hilo || []).length > 4 ? '<button type="button" class="enlace" id="verHilo">Ver todo el hilo</button>' : '') + '</div>';
    $('cuerpoCom').innerHTML = h;
  }
  // Lo que se gestiona desde aquí abre el expediente encima; al cerrarlo se vuelve a esta hoja ya actualizada
  function alExpediente(o){ if(!K) return; window.Ficha.abrir(K.cliente, Object.assign({ yo, alCerrar: tras }, o || {})); }
  function tras(){ cache.borrarTodo(); if(K) cargarComision(); cargar(); }

  document.addEventListener('click', (e) => {
    const f = e.target.closest('#filtros [data-filtro]');
    if(f){ filtro = f.dataset.filtro; guardarUrl(); pintarFiltros(); if(d) pintarLista(); return; }
    const g = e.target.closest('#lista [data-grupo]');
    if(g){ const l = g.dataset.grupo; abiertos[l] = !g.parentNode.classList.contains('abierto'); g.parentNode.classList.toggle('abierto', abiertos[l]); g.setAttribute('aria-expanded', String(abiertos[l])); return; }
    const m = e.target.closest('[data-mas]');
    if(m){ completos[m.dataset.mas] = true; const l = m.closest('.grupo').dataset.lider; abiertos[l] = true; pintarLista(); return; }
    if(e.target.closest('#lista #reintentar')){ cargar(); return; }
    const t = e.target; let b;
    if((b = t.closest('[data-com]'))){ abrirComision(b.dataset.com, b.dataset.cliente); return; }
    if((b = t.closest('[data-exp]'))){ window.Ficha.abrir(Number(b.dataset.exp), { yo, alCerrar: tras }); return; }
    if(t.closest('#reintentarCom')){ cargarComision(); return; }
    if(t.closest('#abrirExp')){ alExpediente({ tab: 'datos' }); return; }
    if(t.closest('#verHilo')){ alExpediente({ tab: 'hilo' }); return; }
    if((b = t.closest('[data-ir-doc]'))){ alExpediente({ tab: 'documentos', casilla: b.dataset.irDoc }); return; }
    if((b = t.closest('[data-ir-campo]'))){ alExpediente({ tab: 'documentos', campo: b.dataset.irCampo }); return; }
    if(t.closest('#pedirCom') && K && K.F){ const c = K.F.cliente; window.Pedir.abrir({ id: c.id, nombre: c.nombre, es_natural: c.es_natural, estatus: c.estatus, falta: K.F.faltantes, tel: c.tel, correo: c.correo }, { yo: yo.nombre, alHacer: tras }); return; }
    if((b = t.closest('#pagoCom')) && K){ b.disabled = true; const pagada = b.dataset.pagada === '1';
      rpc('instalacion_pago', { p_instalacion: K.inst, p_pagada: pagada }).then(() => { toast(pagada ? 'Instalación marcada como pagada' : 'Pago quitado'); tras(); }).catch((err) => { toast(err.message, 'error'); if(document.contains(b)) b.disabled = false; }); }
  });
  $('corte').addEventListener('change', () => { corte = $('corte').value; d = null; cargar(); });

  (async function(){
    yo = await S.requerir(['admin', 'abogado', 'lider', 'analista']);
    if(!yo) return;
    window.Armazon.montar(yo, { activo: 'comisiones' });
    window.Ficha.montar();
    leerUrl(); pintarFiltros();
    cargar();
  })();
})();
