// Mi trabajo (lote 28/10, maqueta claude/maquetas/mi-trabajo-28oct): buzón por rol sobre la RPC mi_trabajo.
// A la izquierda el índice (tarjetas compactas por grupo, Mis notas y El equipo); a la derecha "Lo más urgente" y la checklist del grupo.
// Cada ítem tiene su Ir, que abre la hoja encima en la pestaña o casilla exacta; al cerrar, lo resuelto queda tachado.
// Los ítems se resuelven solos cuando se hace la acción; las notas personales se marcan a mano. Revisión en lote: revision-lote.js.
(function(){
  'use strict';
  const C = window.Comun; const B = window.Buzon;
  const { $, esc, rpc, toast, cache, vacio, fecha, plural } = C;
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  let yo = null; let D = null; let sel = ''; let persona = ''; let pedido = 0; let cuantos = 40; let cola = null; let vista = 'buzon';
  let abierto = null;        // el ítem que se abrió con Ir: al volver se mira si se resolvió
  const tachados = {};       // resueltos en esta visita: se ven tachados hasta recargar la página
  let avisoT = null; let filtroC = '';
  // Lote 11/11 H2/H3: datos de Canales (teléfono, descargadas, IP del pool, equipo) y modos de la coordinadora
  let CN = null; let modoC = 'equipo'; let cartasPor = 'persona'; let verEq = false;

  function leerUrl(){ const u = new URLSearchParams(location.search); sel = (u.get('g') || '').slice(0, 10); persona = (u.get('p') || '').slice(0, 40); vista = u.get('v') === 'lote' ? 'lote' : 'buzon'; }
  function guardarUrl(){ const u = new URLSearchParams(); if(vista === 'lote') u.set('v', 'lote'); else { if(sel) u.set('g', sel); if(persona) u.set('p', persona); } const s = u.toString(); history.replaceState(history.state, '', location.pathname + (s ? '?' + s : '')); }

  async function cargar(){
    const mio = ++pedido; const clave = 'mitrabajo:' + (yo && yo.id) + ':' + persona;
    if(!D){ const g = cache.leer(clave); if(g){ D = g; pintar(); } else esqueleto(); }
    try {
      const r = await rpc('mi_trabajo', { p_persona: persona || null }); if(mio !== pedido) return;
      D = r; cache.guardar(clave, r); revisarAbierto(); pintar(); if(cola) seguirCola();
      if((r.vista === 'analista' || r.vista === 'coord') && !r.persona) rpc('trabajo_canales').then((x) => { if(mio !== pedido) return; CN = x; pintar(); }).catch((e) => { if(mio !== pedido) return; CN = { error: e.message }; pintar(); });
    } catch (e) {
      if(mio !== pedido) return;
      if(!D) $('cuerpo').innerHTML = '<div class="vacio" role="alert"><b>No se pudo cargar tu trabajo</b><p>' + esc(e.message) + '</p><button type="button" class="btn btn-chico" data-tr="reintentar">Reintentar</button></div>';
      toast(e.message, 'error');
    }
  }
  function esqueleto(){
    $('tarjetas').innerHTML = '<span class="sk bz-sk"></span><span class="sk bz-sk"></span><span class="sk bz-sk"></span><span class="sk bz-sk"></span>';
    $('cuerpo').innerHTML = '<div class="sk-bloque"><span class="sk" style="height:64px;border-radius:16px"></span><span class="sk" style="height:64px;border-radius:16px"></span><span class="sk" style="height:64px;border-radius:16px"></span></div>';
  }
  const kDe = (f) => f.tipo + '|' + f.clave;
  const color = (f) => B.color(f, D.hoy);
  const solo = () => !!(D && D.solo_consulta);
  // Al volver de la hoja: si el ítem ya no está, queda tachado y se avisa en la misma pantalla
  function revisarAbierto(){
    if(!abierto) return; const k = abierto.k; const f = abierto.f; abierto = null;
    if((D.items || []).some((x) => kDe(x) === k)) return;
    tachados[k] = f; aviso('Se quitó de tus pendientes · ' + (D.items.length === 1 ? 'queda 1' : 'quedan ' + D.items.length), null, true);
  }
  function aviso(texto, deshacer, bien){
    const z = $('bzAviso'); clearTimeout(avisoT);
    z.className = 'bz-aviso' + (bien ? ' ok' : ''); z.innerHTML = '<span>' + esc(texto) + '</span>' + (deshacer ? '<button type="button" class="enlace" data-tr="deshacer">Deshacer</button>' : '');
    z._deshacer = deshacer || null; avisoT = setTimeout(() => z.classList.add('hidden'), 7000);
  }

  function saludo(){
    const h = Number(new Intl.DateTimeFormat('es-VE', { hour: 'numeric', hour12: false, timeZone: 'America/Caracas' }).format(new Date()));
    return (h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches') + ', ' + C.primerNombre(D.nombre || (yo && yo.nombre) || '');
  }
  function frase(gs){
    if(D.persona) return 'Así ve su buzón ' + D.persona.nombre + '. Solo consulta.';
    const mes = MESES[Number(String(D.corte).slice(5, 7)) - 1] || ''; const lim = D.limite ? fecha(D.limite).replace(/ de \d{4}$/, '') : '';
    const n = (D.items || []).length; const g = (id) => (gs.find((x) => x.id === id) || { items: [] }).items.length;
    if(D.vista === 'abogado') return saludo() + '. ' + plural(g('con'), 'contrato en curso', 'contratos en curso') + (g('ven') ? ' y ' + plural(g('ven'), 'vencimiento', 'vencimientos') : '') + '.';
    if(D.vista === 'analista' || D.vista === 'coord') return saludo() + '. ' + (g('carta') ? 'Hay ' + plural(g('carta'), 'carta por enviar', 'cartas por enviar') + ' del corte de ' + mes + '.' : 'Corte de ' + mes + ', límite el ' + lim + '.');
    if(D.vista === 'lider'){ const b = g('dev') + g('falta'); return saludo() + '. Tienes ' + plural(n, 'cosa por hacer', 'cosas por hacer') + (b ? '; ' + (b === 1 ? '1 bloquea' : b + ' bloquean') + ' tu comisión' : '') + '.'; }
    return 'Corte de ' + mes + ' abierto · día límite ' + lim + '. Se van tachando solos cuando los haces.';
  }

  // Lote 05/11 D7: buscador por RIF o nombre (sobre lo que ya llegó, sin ir al servidor)
  let busca = '';
  const conBusca = () => { if(!busca) return D; const q = C.normalizeStr(busca); const qd = busca.replace(/\D/g, '');
    return Object.assign({}, D, { items: (D.items || []).filter((f) => C.normalizeStr((f.titulo || '') + ' ' + (f.detalle || '')).indexOf(q) >= 0 || (qd.length >= 4 && String(f.doc || '').replace(/\D/g, '').indexOf(qd) >= 0)) }); };
  // D7: "Qué cambió" por rol, una vez por persona
  const CAMBIO = { admin: 'la revisión de documentos se hace aquí mismo con "Revisar aquí"; lo demás te lleva a su módulo y vuelves a la misma línea.',
    senior: 'ya no ves la revisión de documentos; lo tuyo es asignar dueños, unir provisionales y las cargas.',
    abogado: 'tus contratos por elaborar salen por tipo de cliente (ISP, corporativo, VGT, PYME); cada uno abre el expediente.',
    lider: 'cada tarea abre el cliente o la comisión; lo devuelto o pedido va primero.', analista: 'cartas, IP y cambios te llevan a su módulo; las tareas sueltas son tus notas y se marcan hechas aquí.' };
  function queCambio(){
    const z = $('queCambio'); if(z) z.classList.add('hidden'); if(z) return;   // Lote 12/11: sin el aviso "Qué cambió" (maqueta)
    if(!z || !yo || D.persona) { if(z) z.classList.add('hidden'); return; }
    const r = D.senior && D.rol !== 'admin' ? 'senior' : D.vista === 'coord' ? 'analista' : D.vista; const k = 'ae_quecambio_0511:' + yo.id;
    let visto = false; try { visto = localStorage.getItem(k) === '1'; } catch (e) {}
    if(visto || !CAMBIO[r]){ z.classList.add('hidden'); return; }
    z.innerHTML = '<b>Qué cambió</b><p>' + esc(capitalizar(CAMBIO[r])) + ' <button type="button" class="enlace" data-tr="entendido">Entendido</button></p>'; z.classList.remove('hidden');
  }
  const capitalizar = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  function pintar(){
    if(!D) return;
    if(window.Gestiones) window.Gestiones.puedeCrear = !!D.puedo_crear_gestion;
    queCambio();
    const D0 = D; D = conBusca();
    try { pintarConDatos(D0); } finally { D = D0; }
  }
  function pintarConDatos(D0){
    const gs = B.grupos(D); const notas = (D.notas || []).filter((x) => !x.hecha);
    const validos = gs.map((g) => g.id).concat(['notas', D.equipo && D.equipo.length && !D.persona ? 'equipo' : '', D.vista === 'coord' ? 'sindueno' : '']).filter(Boolean);
    if(sel && validos.indexOf(sel) < 0) sel = '';
    const it = D.items || []; const venc = it.filter((f) => color(f) === 'venc').length; const hoy = it.filter((f) => color(f) === 'hoy').length;
    const pn = String((D.persona ? D.persona.nombre : (yo && yo.nombre) || D.nombre || '')).trim().split(/\s+/)[0];
    $('saludo').textContent = D.persona ? 'Trabajo de ' + D.persona.nombre : canales() && D.vista === 'coord' && modoC === 'equipo' && sel === '' ? 'Mi equipo · Canales de atención' : (pn ? 'Hola, ' + pn : 'Mi trabajo');
    $('frase').textContent = canales() && D.vista === 'coord' && modoC === 'equipo' && sel === '' ? 'Coordinadora: ves lo de todos y puedes pasar una tarea a otra persona.' : D.vista === 'abogado' ? 'Primero los contratos ISP. Cada tarea abre el expediente donde se hace.' : canales() ? 'Lo más urgente arriba. Las cartas se envían desde aquí mismo.' : frase(gs);
    $('pildoras').innerHTML = '<span class="mt-pill r">' + plural(venc, 'vencido', 'vencidos') + '</span><span class="mt-pill a">' + (hoy === 1 ? '1 vence hoy' : hoy + ' vencen hoy') + '</span><span class="mt-pill g">' + it.length + ' en total</span>';
    const bp = $('bandaPersona'); bp.classList.toggle('hidden', !D.persona);
    if(D.persona) bp.innerHTML = '<b>Estás viendo el buzón de ' + esc(D.persona.nombre) + ' tal como lo ve</b><p>Solo consulta: no puedes hacer nada desde aquí. <button type="button" class="enlace" data-tr="volver">Volver a mi trabajo</button></p>';
    const zp = $('zonaPersona'); const ps = D.personas || []; zp.classList.toggle('hidden', !ps.length || canales());
    if(ps.length) $('persona').innerHTML = '<option value="">' + (D.rol === 'admin' || D.senior ? 'Mi trabajo' : 'Todos los analistas') + '</option>' +
      ps.map((p) => '<option value="' + esc(p.id) + '"' + (p.id === persona ? ' selected' : '') + '>' + esc(p.nombre + ' (' + ({ lider: 'líder', abogado: 'Legal', analista: 'analista' }[p.rol] || p.rol) + ')') + '</option>').join('');
    $('btnLote').classList.toggle('hidden', D.rol !== 'admin' || !!D.persona);
    pintarNums(B.grupos(D0)); pintarIndice(gs, notas); pintarCuerpo(gs, notas);
    if(busca && !(D.items || []).length) $('cuerpo').innerHTML = vacio('Nada con "' + busca + '"', 'Prueba con otra parte del nombre o con el RIF sin letras.');
  }
  // Números de arriba (líder y Canales): cada uno abre su grupo
  function pintarNums(gs){
    const n = (id) => (gs.find((x) => x.id === id) || { items: [] }).items.length; const z = $('nums');
    const dias = D.limite ? Math.max(0, C.diasEntre(D.hoy, D.limite)) : null;
    let l = null;
    if(D.vista === 'lider') l = [[(D.items || []).filter((f) => f.tipo === 'devuelto').length, 'Documentos devueltos', 'r', D.vende ? 'dev' : 'doc'], [(D.items || []).filter((f) => f.tipo === 'orden_atrasada').length, 'Órdenes de más de 24 horas', 'a', D.vende ? 'inst' : 'ins'],
      [dias === null ? 'Sin fecha' : plural(dias, 'día', 'días'), 'Para el cierre del corte' + (D.limite ? ' (' + fecha(D.limite).replace(/ de \d{4}$/, '') + ')' : ''), '', ''], [n('falta'), 'Faltan para comisionar', 'b', D.vende ? 'falta' : '']];
    else if(canales() && sel === '') l = null;
    else if(D.vista === 'analista' || D.vista === 'coord') l = [[n('carta'), 'Cartas y proformas por enviar', 'a', 'carta'], [n('ip'), 'IP por escribir', '', 'ip'], [n('pago'), 'Del corte sin pago', 'r', 'pago'], [n('emi'), 'Cambios por emitir', 'b', 'emi']];
    // Lote 05/11 D8: los mismos números que Inicio (salen de la misma lista)
    else if(D.vista === 'abogado'){ const t = (x) => (D.items || []).filter((f) => f.tipo === x).length; l = [[t('elaborar_contrato') + t('elaborar_vgt'), 'Por elaborar contrato', 'r', ''], [t('seguir_firma'), 'Enviados a firmar', '', ''], [t('contrato_archivo'), 'Firmados, falta subir', 'a', ''], [t('contrato_vence'), 'Vencen pronto', 'a', 'ven']]; }
    else if(D.senior && D.rol !== 'admin') l = [[n('sin'), 'Sin dueño', 'r', 'sin'], [n('prov'), 'Provisionales y verificar', 'a', 'prov'], [n('car'), 'Cargas del día', 'a', 'car'], [(D.items || []).length, 'En total', '', '']];
    else if(D.vista === 'admin') l = [[n('rev'), 'Documentos por revisar', 'b', 'rev'], [n('dec'), 'Por decidir', 'r', 'dec'], [n('ale'), 'Alertas y cargas', 'a', 'ale'], [n('ali'), 'De aliados', '', 'ali']];
    z.classList.toggle('hidden', !l);
    if(l) z.innerHTML = l.map((x) => (x[3] ? '<button type="button" class="bz-num ' + x[2] + '" data-grupo="' + x[3] + '">' : '<div class="bz-num ' + x[2] + '">') + '<b>' + esc(x[0]) + '</b><small>' + esc(x[1]) + '</small>' + (x[3] ? '</button>' : '</div>')).join('');
  }
  // Lote 12/11 (maqueta mi-trabajo): menú simple a la izquierda con su número; en teléfono pasa a chips
  function pintarIndice(gs, notas){
    const partes = new Set(gs.map((g) => g.parte)); const dos = partes.size > 1; let ult = '';
    const it = (attr, on, t, n, rojo) => '<button type="button" class="bz-mi' + (on ? ' on' : '') + '" ' + attr + ' aria-pressed="' + on + '"><span>' + esc(t) + '</span><b' + (rojo ? ' class="r"' : '') + '>' + esc(n) + '</b></button>';
    const parte = (t) => '<span class="bz-parte">' + esc(t) + '</span>';
    const coordEq = canales() && D.vista === 'coord';
    let h = parte(canales() ? 'Mi trabajo' : dos ? '' : 'Mi trabajo');
    if(coordEq){
      h += it('data-cn-modo="mio"', modoC === 'mio' && sel === '', 'Lo mío', CN && CN.equipo ? CN.equipo.filter((f) => f.analista_id === yo.id).length : '…') + parte('Mi equipo · Canales');
      h += it('data-cn-modo="equipo"', modoC === 'equipo' && sel === '', 'Mi equipo', (D.items || []).length);
    } else h += it('data-grupo=""', sel === '' && !verEq, 'Todo', (D.items || []).length);
    gs.forEach((g) => {
      if(dos && g.parte !== ult){ h += parte(g.parte === 'ventas' ? 'Mis ventas' : 'Mi rol'); ult = g.parte; }
      h += it('data-grupo="' + g.id + '"', sel === g.id, g.titulo, g.items.length, g.venc > 0);
    });
    if(coordEq && CN && CN.sin_dueno) h += it('data-grupo="sindueno"', sel === 'sindueno', 'Órdenes sin dueño', CN.sin_dueno.length, CN.sin_dueno.length > 0);
    if(!D.persona) h += it('data-grupo="notas"', sel === 'notas', 'Mis notas', notas.length);
    if(canales() && D.vista === 'analista' && CN && CN.equipo) h += parte('Mi equipo · Canales') + it('data-cn-eq="1"', verEq && sel === '', 'Todo el equipo', CN.equipo.length);
    if(D.equipo && D.equipo.length && !D.persona) h += parte('El equipo') + it('data-grupo="equipo"', sel === 'equipo', 'Ver el trabajo de…', D.equipo.length);
    $('tarjetas').innerHTML = h;
  }


  // Lote 05/11 D1: el botón dice adónde lleva (la revisión de documentos se hace aquí mismo)
  function destino(f){
    const ref = f.ref || {};
    if(f.tipo === 'revisar_docs') return 'Revisar aquí';
    if(f.tipo === 'gestion') return 'Registrar';
    if(ref.cambio) return 'Ir a Migraciones';
    if(['aliado_permisos', 'aliado_sin_permiso'].indexOf(f.tipo) >= 0 || (f.tipo === 'referido' && !f.cliente_id)) return 'Ir a Aliados';
    if(f.tipo === 'alerta_carga') return ref.no_aparece ? 'Ir a Clientes' : 'Ir a Actualizar';
    if(f.tipo === 'ordenes_atrasadas' || ((f.tipo === 'orden_atrasada' || f.tipo === 'por_instalar') && !f.cliente_id)) return 'Ir a Por instalar';
    if(!f.cliente_id || f.tipo === 'cerrar_corte') return 'Ir a Comisiones';
    if(f.tipo === 'venta_falta' || ['certificar', 'por_enviar', 'sin_ip', 'revisar_pago', 'carta_enviar'].indexOf(f.tipo) >= 0) return 'Ir a la comisión';
    if(['elaborar_contrato', 'elaborar_vgt', 'seguir_firma', 'contrato_archivo', 'contrato_vence', 'por_firmar'].indexOf(f.tipo) >= 0) return 'Abrir contrato';
    return 'Abrir expediente';
  }
  function plazo(f){
    const c = color(f); if(c === 'venc') return ['r', 'Vencido']; if(c === 'hoy') return ['a', 'Hoy']; if(!f.vence) return null;
    const d = C.diasEntre(D.hoy, f.vence); return ['g', d === 1 ? 'Mañana' : d <= 7 ? 'En ' + d + ' días' : fecha(f.vence).replace(/ de \d{4}$/, '')];
  }
  function itemHtml(f, hecho){
    const a = B.ACC[f.tipo] || [f.tipo, 'Ir']; const p = hecho ? null : plazo(f); const k = kDe(f);
    const quien = [D.vista !== 'lider' && f.lider && f.tipo !== 'carta_enviar' ? f.lider : '', (D.vista === 'coord' || D.vista === 'admin') && f.analista ? 'Analista ' + f.analista : ''].filter(Boolean).join(' · ');
    const ges = f.tipo === 'gestion' && !hecho && !solo() ? '<span class="bz-est" role="group" aria-label="Estado de la gestión">' + [['contactado', 'Contactado'], ['sin_contacto', 'Sin contacto'], ['esperando', 'Esperando']].map((x) =>
      '<button type="button" class="' + ((f.ref || {}).estado === x[0] ? 'on' : '') + '" aria-pressed="' + ((f.ref || {}).estado === x[0]) + '" data-gest-est="' + x[0] + '" data-k="' + esc(k) + '">' + x[1] + '</button>').join('') + '</span>' : '';
    const yoNo = D.vista === 'coord' && f.analista_id && yo && f.analista_id !== yo.id;
    return '<div class="bz-it' + (hecho ? ' hecho' : '') + '"><span class="bz-ck' + (hecho ? ' on' : '') + '" aria-hidden="true"></span><span class="bz-tx"><b>' + esc(a[0]) + ' <span>· ' + esc(f.titulo || '') + '</span>' +
      (p ? '<span class="mt-pill ' + p[0] + '">' + esc(p[1]) + '</span>' : '') + '</b><small>' + esc(hecho ? 'Hecho. Se quitó de tus pendientes' : (f.detalle || '') + (quien ? ' · ' + quien : '')) + '</small>' + ges + '</span>' +
      (hecho || solo() || f.tipo === 'gestion' ? '' : '<button type="button" class="btn btn-chico ' + (color(f) === 'venc' || f.tipo === 'revisar_docs' ? '' : 'btn-2') + '" data-hacer="' + esc(k) + '">' + esc(yoNo ? 'Hacerlo yo' : destino(f)) + '</button>') + '</div>';
  }
  // Ítems de un grupo con los tachados de esta visita al final
  function listaGrupo(g, max){
    const orden = g.items.slice().sort((a, b) => (String(a.vence || '9') < String(b.vence || '9') ? -1 : String(a.vence || '9') > String(b.vence || '9') ? 1 : String(a.desde) < String(b.desde) ? -1 : 1));
    const tach = Object.keys(tachados).map((k) => tachados[k]).filter((f) => g.tipos.indexOf(f.tipo) >= 0);
    let h;
    if(g.id === 'carta' && !max){   // Cartas: agrupadas por dueño, los cambios de categoría aparte
      const por = {}; orden.forEach((f) => { const d = /cambio de categoría/.test(f.detalle || '') ? 'Cambios de categoría' : (f.lider || 'Sin dueño'); (por[d] = por[d] || []).push(f); });
      h = Object.keys(por).sort((a, b) => (a === 'Cambios de categoría') - (b === 'Cambios de categoría') || a.localeCompare(b)).map((d) => '<div class="bz-grp">' + esc(d) + '</div>' + por[d].map((f) => itemHtml(f)).join('')).join('');
    } else h = orden.slice(0, max || cuantos).map((f) => itemHtml(f)).join('');
    if(!orden.length && !tach.length) h = '<p class="nota-chica bz-nada">Nada pendiente aquí. Cuando haya algo, aparece en esta lista.</p>';
    h += tach.map((f) => itemHtml(f, true)).join('');
    if(max && orden.length > max) h += '<button type="button" class="enlace bz-ver" data-grupo="' + g.id + '">Ver ' + (orden.length === max + 1 ? 'el otro' : 'los ' + orden.length) + '</button>';
    else if(!max && orden.length > cuantos && g.id !== 'carta') h += '<button type="button" class="btn btn-chico btn-2 mt-mas" data-tr="mas">Ver ' + Math.min(40, orden.length - cuantos) + ' más de ' + (orden.length - cuantos) + '</button>';
    return h;
  }
  function seccion(titulo, sub, cuerpo, extra){ return '<section class="bz-sec"><div class="bz-sh"><b>' + esc(titulo) + '</b>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + (extra || '') + '</div>' + cuerpo + '</section>'; }
  function accionesGrupo(g){
    if(solo()) return '';
    if(g.id === 'rev' && D.rol === 'admin') return '<span class="bz-sh-acc"><button type="button" class="btn btn-chico btn-2" data-tr="cola">Uno por uno</button><button type="button" class="btn btn-chico" data-tr="lote">Revisar en lote</button></span>';
    if(g.id === 'ges' && D.puedo_crear_gestion) return '<span class="bz-sh-acc"><button type="button" class="enlace" data-ges="nueva">Nueva gestión</button></span>';
    return '';
  }
  function subGrupo(g){
    if(g.id === 'falta' || g.id === 'dev'){ const mes = MESES[Number(String(D.corte).slice(5, 7)) - 1] || ''; return 'Corte de ' + mes + (D.limite ? ', límite ' + fecha(D.limite).replace(/ de \d{4}$/, '') : ''); }
    return g.sub;
  }
  function pintarCuerpo(gs, notas){
    let h = '';
    if(sel === 'notas') h = notasHtml();
    else if(sel === 'equipo') h = seccion('El equipo', 'Toca para ver su buzón tal como lo ve (solo consulta)', equipoHtml());
    else if(D.vista === 'abogado' && (sel === '' || sel === 'con')) h = tableroLegal(gs);
    else if(canales() && sel === '') h = tableroCanales();
    else if(sel === 'sindueno'){ const sd = filtrar((CN && CN.sin_dueno) || []); h = seccion('Órdenes sin dueño · ' + sd.length, 'No comisionan hasta elegir de quién son', sd.length ? sd.map((f) => '<div class="cn-fila"><div class="cn-tx"><b>' + esc(f.titulo || '') + '</b><small>' + esc(f.detalle || '') + '</small></div><span class="chip ambar">Falta elegir</span><span class="cn-acc"><button type="button" class="btn btn-chico" data-cn-hacer="' + esc(kDe(f)) + '">Elegir dueño</button></span></div>').join('') : '<p class="nota-chica bz-nada">Todas las órdenes tienen dueño.</p>'); }
    else if(sel){ const g = gs.find((x) => x.id === sel); h = seccion(g.titulo, subGrupo(g), listaGrupo(g), accionesGrupo(g)); }
    else {
      const urg = (D.items || []).slice().sort((a, b) => (String(a.vence || '9') < String(b.vence || '9') ? -1 : 1)).slice(0, 4);
      if(urg.length) h += seccion('Lo más urgente', 'Los 4 primeros de todo, por fecha', urg.map((f) => itemHtml(f)).join(''));
      else h += vacio('Todo al día', 'No tienes pendientes. Cuando algo necesite de ti, aparece aquí.');
      // Lote 05/11 D3: grupos plegables con su número; los que tienen algo vencido o de hoy salen abiertos
      gs.filter((g) => g.items.length).forEach((g) => { h += '<details class="bz-pl"' + (g.venc || g.hoy ? ' open' : '') + ' data-pl="' + g.id + '"><summary><b>' + esc(g.titulo) + '</b><span class="bz-pl-n">' + g.items.length + '</span>' +
        (g.venc ? '<span class="mt-pill r">' + plural(g.venc, 'vencido', 'vencidos') + '</span>' : '') + '</summary>' + seccion(g.titulo, subGrupo(g), listaGrupo(g, 3), accionesGrupo(g)) + '</details>'; });
      if(notas.length && !D.persona) h += seccion('Mis notas', 'Estas sí se marcan a mano', notas.slice(0, 3).map(notaHtml).join(''));
      if(D.equipo && D.equipo.length && !D.persona) h += seccion('El equipo', 'Toca para ver su buzón tal como lo ve (solo consulta)', equipoHtml(4));
    }
    $('cuerpo').innerHTML = h;
  }
  function equipoHtml(max){
    const eq = (D.equipo || []).slice(0, max || 40);
    return '<div class="bz-team">' + eq.map((e) => '<button type="button" class="bz-tm" data-persona="' + esc(e.id) + '"><b>' + esc(e.nombre) + ' · ' + esc(e.rol) + '</b><small' + (e.venc ? ' class="mal"' : '') + '>' +
      esc(plural(e.n, 'pendiente', 'pendientes') + (e.venc ? ' · ' + plural(e.venc, 'vencido', 'vencidos') : '') + (e.hoy ? ' · ' + e.hoy + ' hoy' : '')) + '</small></button>').join('') + '</div>';
  }

  // ---------- Lote 11/11 H2 (coordinadora, maqueta Coordinadora) y H3 (analista, maqueta TrabajoAnalista) ----------
  const canales = () => !!D && (D.vista === 'analista' || D.vista === 'coord') && !D.persona;
  const esCartaT = (f) => f.tipo === 'carta_enviar' || f.tipo === 'por_enviar';
  const sidDe = (f) => String((f.ref || {}).servicio || '');
  const exDe = (f) => ((CN && CN.extra) || {})[sidDe(f)] || {};
  const diasD = (f) => B.diasDesde(f.desde, D.hoy) || 0;
  const corto = (t) => { const x = String(t || '').trim().split(/\s+/); return x.length > 1 ? x[0] + ' ' + x[1].charAt(0) + '.' : x[0] || ''; };
  const fCorta = (t) => { const d = new Date(t); return isNaN(d) ? '' : String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); };
  const hora = (t) => { const d = new Date(t); return isNaN(d) ? '' : String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const cuando = (t) => { const d = B.diasDesde(t, D.hoy); return d === 0 ? 'hoy ' + hora(t) : d === 1 ? 'ayer ' + hora(t) : 'el ' + fCorta(t); };
  function filtrar(l){ if(!busca) return l; const q = C.normalizeStr(busca); const qd = busca.replace(/\D/g, '');
    return l.filter((f) => C.normalizeStr((f.titulo || '') + ' ' + (f.detalle || '')).indexOf(q) >= 0 || (qd.length >= 4 && String(f.doc || '').replace(/\D/g, '').indexOf(qd) >= 0)); }
  // La lista que se ve: la analista, lo suyo o todo el equipo; la coordinadora, lo suyo o su equipo
  function listaCanales(){
    const eq = filtrar((CN && CN.equipo) || []);
    if(D.vista === 'coord') return modoC === 'mio' ? eq.filter((f) => f.analista_id === yo.id) : eq;
    return verEq && CN && CN.equipo ? eq : (D.items || []);
  }
  const buscarCn = (k) => (D.items || []).concat((CN && CN.equipo) || [], (CN && CN.sin_dueno) || []).find((f) => kDe(f) === k);
  function cartaFila(f, coord){
    const e = exDe(f); const k = kDe(f); const dd = diasD(f); const falta = (f.ref || {}).carta === 'falta_ip';
    const dueno = coord ? (f.analista ? corto(f.analista) : 'Sin asignar') : '';
    let sub; let chip; let btns = '';
    if(e.descargada){
      sub = coord ? (dueno + ' · descargada ' + cuando(e.descargada.en) + ', sin confirmar') : 'Descargaste la carta ' + cuando(e.descargada.en) + '. ¿Ya la enviaste?';
      chip = '<span class="chip azul">Por confirmar</span>';
      btns = coord && f.analista_id && f.analista_id !== yo.id ? '<button type="button" class="btn btn-chico btn-2" data-cn-rec="' + esc(k) + '">Recordarle</button>'
        : '<button type="button" class="btn btn-chico" data-cn-ya="' + esc(k) + '">Ya la envié</button>';
    } else {
      const tel = e.tel ? e.tel.de + ' ' + window.Documentos.telFmt(e.tel.t) : '';
      sub = [dueno, falta ? 'Falta la IP' : 'IP lista', falta ? '' : (tel || (coord ? 'sin número del cliente' : 'Sin número: descárgala y envíala tú'))].filter(Boolean).join(' · ');
      chip = '<span class="chip ' + (dd > 3 ? 'rojo' : dd > 1 ? 'ambar' : '') + '">' + (dd === 0 ? 'Hoy' : plural(dd, 'día', 'días')) + '</span>';
      if(coord) btns += '<button type="button" class="btn btn-chico btn-2" data-cn-pasar="' + esc(k) + '">Pasar a otra persona</button>';
      btns += falta ? '<button type="button" class="btn btn-chico' + (coord ? ' btn-2' : '') + '" data-cn-hacer="' + esc(k) + '">Escribir IP</button>'
        : e.tel ? '<button type="button" class="btn btn-chico wa" data-cn-wa="' + esc(k) + '">' + (coord ? 'Enviar yo' : 'Enviar por WhatsApp') + '</button>'
        : '<button type="button" class="btn btn-chico btn-2" data-cn-pdf="' + esc(k) + '">Descargar</button>';
    }
    return '<div class="cn-fila"><div class="cn-tx"><b>' + esc(f.titulo || '') + '</b><small>' + esc(sub) + '</small></div>' + chip + '<span class="cn-acc">' + btns + '</span></div>';
  }
  function ipFila(f, ip){
    const e = exDe(f); const k = kDe(f);
    const sub = (e.instalada ? 'Instalado el ' + fCorta(e.instalada) : 'Sin fecha de instalación') + ' · ' + (ip ? 'Posible IP del pool: ' + ip.ip : 'Sin sugerencia');
    return '<div class="cn-fila"><div class="cn-tx"><b>' + esc(f.titulo || '') + '</b><small>' + esc(sub) + '</small></div><span class="cn-acc"><button type="button" class="btn btn-chico btn-2" data-cn-hacer="' + esc(k) + '">Escribir IP</button>' +
      (ip && sidDe(f) ? '<button type="button" class="btn btn-chico" data-cn-ip="' + esc(k) + '" data-fila="' + esc(ip.fila) + '">Usar ' + esc(ip.ip) + '</button>' : '') + '</span></div>';
  }
  function plegado(t, l, sub){
    return '<details class="bz-pl cn-pl"><summary><b>' + esc(t) + ' · ' + l.length + '</b>' + (sub ? '<span class="lg-sub">' + esc(sub) + '</span>' : '') + '</summary>' +
      (l.length ? l.slice(0, 30).map((f) => itemHtml(f)).join('') : '<p class="nota-chica bz-nada">Nada aquí.</p>') + '</details>';
  }
  const porPersona = (l) => { const m = {}; l.forEach((f) => { const n = f.analista ? corto(f.analista) : 'Sin asignar'; m[n] = (m[n] || 0) + 1; }); return Object.keys(m).sort((a, b) => m[b] - m[a]).map((n) => n + ' ' + m[n]).join(' · '); };
  function tableroCanales(){
    const coord = D.vista === 'coord' && modoC === 'equipo';
    if(!CN) return '<div aria-busy="true">' + C.esqueleto(4) + '</div>';
    if(CN.error) return '<div class="vacio" role="alert"><b>No se pudo cargar el detalle de Canales</b><p>' + esc(CN.error) + '</p><button type="button" class="btn btn-chico" data-tr="reintentar">Reintentar</button></div>';
    const its = listaCanales();
    const cartas = its.filter(esCartaT).sort((a, b) => (!!exDe(b).descargada - !!exDe(a).descargada) || (diasD(b) - diasD(a)));
    const desc = cartas.filter((f) => exDe(f).descargada); const viejas = cartas.filter((f) => diasD(f) > 3);
    const ips = its.filter((f) => f.tipo === 'sin_ip' || f.tipo === 'ip_confirmar'); const emi = its.filter((f) => f.tipo === 'cambio_emitir'); const pago = its.filter((f) => f.tipo === 'revisar_pago');
    let h = '';
    const tile = (n, t, c, g) => (g ? '<button type="button" class="bz-num ' + c + '" data-grupo="' + g + '">' : '<div class="bz-num ' + c + '">') + '<b>' + n + '</b><small>' + esc(t) + '</small>' + (g ? '</button>' : '</div>');
    if(!coord) h += '<div class="cn-tiles">' + tile(cartas.length, 'Cartas por enviar', 'a', 'carta') + tile(desc.length, 'Descargadas sin confirmar', 'b', '') + tile(viejas.length, 'Más de 3 días', 'r', '') +
      tile(ips.length, 'Esperan la IP', '', 'ip') + tile(emi.length, 'Cambios por emitir', 'b', 'emi') + tile(pago.length, 'Pago por revisar', 'r', 'pago') + '</div>';
    if(coord){
      const carga = (CN.carga || []).map((p) => { const det = [plural(p.cartas, 'carta', 'cartas'), p.ip ? p.ip + ' IP' : '', p.emi ? plural(p.emi, 'cambio por emitir', 'cambios por emitir') : '', p.pago ? plural(p.pago, 'pago', 'pagos') : ''].filter(Boolean).join(' · ');
        return '<div class="cn-per"><b>' + esc(p.id === yo.id ? 'Yo' : corto(p.nombre)) + '</b><span class="chip ' + (p.venc ? 'rojo' : p.hoy ? 'ambar' : 'verde') + '">' + esc(p.venc ? plural(p.venc, 'vencida', 'vencidas') : p.hoy ? p.hoy + ' hoy' : 'Al día') + '</span>' +
          '<small>' + esc(det) + '</small>' + (p.id === yo.id ? '' : '<button type="button" class="enlace" data-persona="' + esc(p.id) + '">Ver su trabajo</button>') + '</div>'; }).join('');
      h += '<div class="cn-team">' + carga + '</div>' + (CN.sin_asignar ? '<p class="nota-chica" style="margin:0">' + esc(plural(CN.sin_asignar, 'tarea sin asignar', 'tareas sin asignar')) + ': pásalas con "Pasar a otra persona".</p>' : '');
    }
    // Cartas y proformas (primero las descargadas sin confirmar, luego las más viejas)
    let lc;
    if(coord && cartasPor === 'persona'){ const m = {}; cartas.forEach((f) => { const n = f.analista || 'Sin asignar'; (m[n] = m[n] || []).push(f); });
      lc = Object.keys(m).sort((a, b) => (a === 'Sin asignar') - (b === 'Sin asignar') || a.localeCompare(b)).map((n) => '<div class="bz-grp">' + esc(n) + ' · ' + m[n].length + '</div>' + m[n].slice(0, 6).map((f) => cartaFila(f, true)).join('')).join(''); }
    else lc = cartas.slice(0, coord ? 12 : 6).map((f) => cartaFila(f, coord)).join('');
    const masC = cartas.length > (coord ? 12 : 6) && !(coord && cartasPor === 'persona') ? '<button type="button" class="enlace bz-ver" data-grupo="carta">Y ' + (cartas.length - (coord ? 12 : 6)) + ' más · Ver todas</button>' : '';
    const sw = coord ? '<span class="bz-sh-acc cn-sw" role="group" aria-label="Ordenar"><button type="button" class="' + (cartasPor === 'persona' ? 'on' : '') + '" aria-pressed="' + (cartasPor === 'persona') + '" data-cn-por="persona">Por persona</button><button type="button" class="' + (cartasPor === 'dias' ? 'on' : '') + '" aria-pressed="' + (cartasPor === 'dias') + '" data-cn-por="dias">Por días</button></span>' : '';
    h += seccion((coord ? 'Cartas y proformas del equipo · ' : 'Cartas y proformas · ') + cartas.length, coord ? '' : 'Las cartas se envían desde aquí mismo', (cartas.length ? lc : '<p class="nota-chica bz-nada">Ninguna carta por enviar.</p>') + masC, sw);
    if(coord){ const sd = filtrar(CN.sin_dueno || []);
      h += seccion('Órdenes sin dueño · ' + sd.length, 'No comisionan hasta elegir de quién son', sd.length ? sd.slice(0, 8).map((f) => '<div class="cn-fila"><div class="cn-tx"><b>' + esc(f.titulo || '') + '</b><small>' + esc(f.detalle || '') + '</small></div><span class="chip ambar">Falta elegir</span><span class="cn-acc"><button type="button" class="btn btn-chico" data-cn-hacer="' + esc(kDe(f)) + '">Elegir dueño</button></span></div>').join('') : '<p class="nota-chica bz-nada">Todas las órdenes tienen dueño.</p>'); }
    // Esperan la IP: a cada una, la siguiente IP libre del pool
    const pool = (CN.pool || []).slice(); const ipsO = ips.slice().sort((a, b) => String(exDe(a).instalada || '') < String(exDe(b).instalada || '') ? -1 : 1);
    h += seccion('Esperan la IP · ' + ips.length, 'Sin IP no sale la carta. La sugerencia hay que confirmarla en el sistema técnico', ips.length ? ipsO.slice(0, 8).map((f) => ipFila(f, f.tipo === 'sin_ip' ? pool.shift() : null)).join('') : '<p class="nota-chica bz-nada">Ninguna espera IP.</p>');
    h += plegado('Cambios por emitir', emi, coord ? porPersona(emi) : 'Cambios de categoría a emitir en el sistema') + plegado('Pago por revisar', pago, 'Clientes con varios servicios');
    return h;
  }
  async function fichaDe(f){ return rpc('cliente_ficha', { p_cliente: f.cliente_id }); }
  async function cnAccion(b){
    const f = buscarCn(b.dataset.cnWa || b.dataset.cnPdf || b.dataset.cnYa || b.dataset.cnRec || b.dataset.cnPasar || b.dataset.cnIp || b.dataset.cnHacer); if(!f) return;
    if(b.dataset.cnHacer){ hacer(f); return; }
    if(b.dataset.cnPasar){ abrirPasar(f); return; }
    const sid = Number(sidDe(f)); b.disabled = true;
    try {
      if(b.dataset.cnYa){ await rpc('carta_marcar_enviada', { p_servicio: sid, p_que: 'ambas', p_canal: 'whatsapp', p_fecha: D.hoy }); aviso('Marcada como enviada. Queda tu nombre en el hilo', null, true); }
      else if(b.dataset.cnRec){ const r = await rpc('trabajo_recordar', { p_tipo: f.tipo, p_clave: f.clave }); aviso('Le llegó el recordatorio a ' + (r && r.a ? r.a : 'la persona'), null, true); b.disabled = false; return; }
      else if(b.dataset.cnIp){ await rpc('ip_usar', { p_servicio: sid, p_fila: Number(b.dataset.fila) }); aviso('IP guardada. Queda en la bitácora', null, true); }
      else if(b.dataset.cnWa){ const F = await fichaDe(f); const r = await window.Ficha.cartaWhatsapp(F, sid, null); if(!r){ b.disabled = false; return; } }
      else if(b.dataset.cnPdf){ const F = await fichaDe(f); window.Ficha.cartaPdf(F, sid, 'proforma');
        if(((F.servicios || []).find((x) => Number(x.id) === sid) || {}).carta) setTimeout(() => window.Ficha.cartaPdf(F, sid, 'bienvenida'), 600);
        await rpc('carta_descargada', { p_servicio: sid }); aviso('Descargada. Cuando la envíes, toca "Ya la envié"', null, true); }
      cache.borrarTodo(); await cargar();
    } catch (e) { toast(e.message || 'No se pudo. Revisa tu conexión e intenta de nuevo', 'error'); if(document.contains(b)) b.disabled = false; }
  }
  // Pasar a otra persona: hoja chica con la gente de Canales
  let pasando = null;
  function abrirPasar(f){
    pasando = f; let h = $('hojaPasar');
    if(!h){ h = document.createElement('section'); h.id = 'hojaPasar'; h.className = 'hoja'; h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true'); h.setAttribute('aria-labelledby', 'tPasar'); h.setAttribute('aria-hidden', 'true'); document.body.appendChild(h); C.prepararHojas(); }
    const an = (CN && CN.analistas) || [];
    h.innerHTML = '<div class="cab"><div><h2 id="tPasar">Pasar a otra persona</h2><p class="sub-hoja">' + esc(f.titulo || '') + '</p></div><button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + C.ic('x') + '</button></div>' + '<form id="formPasar" novalidate><p class="nota-chica">Ahora la tiene: <b>' + esc(f.analista || 'nadie') + '</b>. A quien elijas le llega un aviso.</p>' +
      '<label class="rotulo" for="psQuien">Pasar a</label><select class="campo" id="psQuien">' + an.map((a) => '<option value="' + esc(a.id) + '"' + (a.id === f.analista_id ? ' disabled' : '') + '>' + esc(a.nombre) + (a.id === yo.id ? ' (yo)' : '') + '</option>').join('') + '</select>' +
      '<div class="error" id="ePasar" role="alert"></div><div class="acciones"><button type="submit" class="btn btn-ancho" id="psOk">Pasar</button></div></form>';
    C.abrirHoja('hojaPasar');
  }
  async function pasar(e){
    e.preventDefault(); if(!pasando) return; const b = $('psOk'); const er = $('ePasar'); er.textContent = ''; b.disabled = true;
    try { const r = await rpc('trabajo_pasar', { p_tipo: pasando.tipo, p_clave: pasando.clave, p_analista: $('psQuien').value }); C.cerrarHoja(); aviso('Ahora la tiene ' + (r && r.analista ? r.analista : 'esa persona') + '. Le llegó un aviso', null, true); pasando = null; await cargar(); }
    catch (x) { er.textContent = x.message || 'No se pudo. Intenta de nuevo'; b.disabled = false; }
  }
  // Legal: por elaborar por tipo de cliente, luego enviado a firmar, firmado sin subir y vencimientos
  function tableroLegal(gs){
    const its = D.items || []; const k = D.kpis || {};
    const ven = gs.find((g) => g.id === 'ven') || { items: [], tipos: ['contrato_vence'] };
    // Lote 05/11 D4: "Por elaborar contrato" por tipo de cliente, prioridad ISP, corporativo, VGT, PYME, con filtros arriba
    const TIPOS_C = [['isp', 'ISP', 'Prioridad 1'], ['corp', 'Corporativo', 'Prioridad 2'], ['vgt', 'VGT', 'Prioridad 3 · por solicitud'], ['pyme', 'PYME', 'Prioridad 4']];
    const tipoDe = (f) => { if(f.tipo === 'elaborar_vgt') return 'vgt'; const s = String(f.seg || ''); return /ISP/.test(s) ? 'isp' : /corporativo/i.test(s) ? 'corp' : /VGT/.test(s) ? 'vgt' : 'pyme'; };
    const elab = its.filter((f) => f.tipo === 'elaborar_contrato' || f.tipo === 'elaborar_vgt').sort((a, b) => (String(a.desde) < String(b.desde) ? -1 : 1));
    const filtros = '<div class="bz-fl" role="group" aria-label="Filtrar por tipo de cliente"><button type="button" class="' + (!filtroC ? 'on' : '') + '" data-filtro-c="" aria-pressed="' + !filtroC + '">Todos <b>' + elab.length + '</b></button>' +
      TIPOS_C.map((t) => '<button type="button" class="' + (filtroC === t[0] ? 'on' : '') + '" data-filtro-c="' + t[0] + '" aria-pressed="' + (filtroC === t[0]) + '">' + esc(t[1]) + ' <b>' + elab.filter((f) => tipoDe(f) === t[0]).length + '</b></button>').join('') + '</div>';
    // Lote 10/11 H1 (maqueta 4a): un solo grupo "Por elaborar contrato" con chips por tipo; ISP primero, luego corporativo, VGT y PYME, y del más viejo al más nuevo
    const ORD = { isp: 0, corp: 1, vgt: 2, pyme: 3 }; const ETQ_C = { isp: ['azul', 'ISP'], corp: ['', 'Corporativo'], vgt: ['morado', 'VGT'], pyme: ['', 'PYME'] };
    const diasDe = (f) => { const t = new Date(f.desde || f.en || ''); return isNaN(t) ? null : Math.max(0, Math.floor((Date.now() - t.getTime()) / 864e5)); };
    const fila = (f) => { const tp = tipoDe(f); const dd = diasDe(f); const c = ETQ_C[tp];
      return '<div class="lg-row"><span class="chip ' + c[0] + ' lg-tag">' + c[1] + '</span><div class="lg-it">' + itemHtml(f) + '</div>' + (f.tipo === 'elaborar_contrato' && !solo() ? '<button type="button" class="btn btn-chico btn-2 lg-prob" data-problema="' + esc(f.cliente_id) + '">Hay un problema</button>' : '') + (dd === null ? '' : '<span class="chip ' + (dd > 5 ? 'rojo' : dd > 2 ? 'ambar' : '') + ' lg-dias">' + (dd === 0 ? 'Nuevo' : plural(dd, 'día', 'días')) + '</span>') + '</div>'; };
    const lista = elab.filter((f) => !filtroC || tipoDe(f) === filtroC).sort((a, b) => ORD[tipoDe(a)] - ORD[tipoDe(b)] || (String(a.desde) < String(b.desde) ? -1 : 1));
    const masViejos = elab.filter((f) => (diasDe(f) || 0) > 5).length;
    const porTipo = seccion('Por elaborar contrato · ' + elab.length, masViejos ? plural(masViejos, 'lleva', 'llevan') + ' más de 5 días' : 'Primero los ISP. Cada uno abre el expediente donde se hace', filtros + (lista.length ? lista.slice(0, 60).map(fila).join('') : '<p class="nota-chica bz-nada">Nada por elaborar de este tipo.</p>'));
    const etapa = (t, tipo, sub) => { const l = its.filter((f) => f.tipo === tipo); const viejo = l.reduce((m, f) => Math.max(m, diasDe(f) || 0), 0);
      return '<details class="bz-pl lg-pl"><summary><b>' + esc(t) + ' · ' + l.length + '</b><span class="lg-sub">' + esc(sub || (l.length && viejo ? 'El más viejo: ' + plural(viejo, 'día', 'días') : '')) + '</span></summary>' + (l.length ? l.slice(0, 40).map((f) => itemHtml(f)).join('') : '<p class="nota-chica bz-nada">Nada aquí.</p>') + '</details>'; };
    return (elab.length > 1 && !solo() ? '<p style="margin:10px 0"><button type="button" class="btn btn-chico" data-tr="cola">Uno tras otro, del más viejo</button></p>' : '') + porTipo +
      etapa('Enviado a firmar', 'seguir_firma') + etapa('Firmado, falta subir', 'contrato_archivo') +
      '<details class="bz-pl lg-pl"><summary><b>Vencen en 60 días · ' + ven.items.length + '</b><span class="lg-sub">Se tachan solos cuando suben el documento nuevo</span></summary>' + listaGrupo(ven) + '</details>' +
      '<p class="nota-chica">' + esc(plural(k.firmados || 0, 'contrato firmado', 'contratos firmados')) + ' en los últimos 7 días.</p>';
  }
  // ---------- Notas personales ----------
  function notaHtml(n){
    return '<div class="bz-it' + (n.hecha ? ' hecho' : '') + '"><button type="button" class="bz-ck bz-ck-b' + (n.hecha ? ' on' : '') + '" data-nota-hecha="' + esc(n.id) + '" aria-pressed="' + !!n.hecha + '" aria-label="' + (n.hecha ? 'Desmarcar nota' : 'Marcar nota como hecha') + '"></button>' +
      '<span class="bz-tx"><b>' + esc(n.texto) + '</b><small>' + esc([n.recordar ? 'Recordar el ' + fecha(n.recordar) : 'Sin recordatorio', n.cliente || ''].filter(Boolean).join(' · ')) + '</small></span>' +
      (n.cliente_id ? '<button type="button" class="btn btn-chico btn-2" data-nota-cli="' + esc(n.cliente_id) + '">Ir</button>' : '') + '</div>';
  }
  function notasHtml(){
    const ns = D.notas || [];
    return seccion('Mis notas', 'Estas sí se marcan a mano', '<form class="bz-nota" id="formNotaP" novalidate><label class="rotulo" for="ntTexto">Escribir una nota</label><textarea class="area corta" id="ntTexto" maxlength="500"></textarea><div class="error" id="eNt" role="alert"></div>' +
      '<div class="bz-nota-f"><span><label class="rotulo" for="ntFecha">Recordar el (opcional)</label><input class="campo" id="ntFecha" type="date" min="' + esc(D.hoy) + '"></span><button type="submit" class="btn btn-chico">Guardar nota</button></div></form>' +
      (ns.length ? ns.map(notaHtml).join('') : '<p class="nota-chica bz-nada">Sin notas. Anota lo que no quieres olvidar; si le pones fecha, te lo recuerda.</p>'));
  }
  async function guardarNota(form){
    const t = $('ntTexto').value.trim(); $('eNt').textContent = '';
    if(!t){ $('eNt').textContent = 'Escribe la nota'; $('ntTexto').focus(); return; }
    const b = form.querySelector('[type="submit"]'); b.disabled = true;
    try { await rpc('nota_guardar', { p_id: null, p_texto: t, p_recordar: $('ntFecha').value || null, p_cliente: null }); aviso('Nota guardada', null, true); await cargar(); }
    catch (e) { $('eNt').textContent = e.message; b.disabled = false; }
  }
  async function notaHecha(id, hecha){
    try { await rpc('nota_hecha', { p_id: Number(id), p_hecha: hecha }); if(hecha) aviso('Nota marcada como hecha', () => notaHecha(id, false), true); await cargar(); }
    catch (e) { toast(e.message, 'error'); }
  }
  async function gestionEstado(b){
    const f = buscar(b.dataset.k); if(!f || solo()) return; b.disabled = true;
    try { await rpc('gestion_cliente_estado', { p_id: (f.ref || {}).gestion, p_cliente: f.cliente_id, p_estado: b.dataset.gestEst, p_nota: null, p_promesa: null }); aviso('Guardado en el historial de la gestión', null, true); await cargar(); }
    catch (e) { toast(e.message, 'error'); b.disabled = false; }
  }

  // ---------- Ir: la hoja encima, en la pestaña o casilla exacta ----------
  const buscar = (k) => (D.items || []).find((f) => kDe(f) === k);
  function hacer(f){
    if(solo()) return;
    const ref = f.ref || {};
    abierto = { k: kDe(f), f };
    if(f.tipo === 'gestion'){ window.Gestiones.abrir(ref.gestion, { cliente: f.cliente_id, alCerrar: cargar }); return; }
    if(ref.cambio){ location.href = 'migraciones.html?f=' + ({ cambio_emitir: 'por_emitir', sin_registro: 'sin_registro', cambio_revisar: 'por_revisar', planilla: 'por_revisar' }[f.tipo] || '') + '&c=' + encodeURIComponent(ref.cambio); return; }
    if(f.tipo === 'cerrar_corte' || ((f.tipo === 'certificar' || f.tipo === 'sin_cliente' || f.tipo === 'sin_servicio' || f.tipo === 'por_asignar') && !f.cliente_id)){ location.href = 'comisiones.html'; return; }
    if(f.tipo === 'aliado_permisos'){ location.href = 'aliados.html'; return; }
    if(f.tipo === 'aliado_sin_permiso'){ location.href = 'aliados.html?t=sinp'; return; }
    if(f.tipo === 'alerta_carga'){ location.href = ref.no_aparece ? 'clientes.html' : 'actualizar.html'; return; }
    if(f.tipo === 'ordenes_atrasadas' || ((f.tipo === 'orden_atrasada' || f.tipo === 'por_instalar') && !f.cliente_id)){ location.href = 'comisiones.html?t=por_instalar'; return; }
    if(f.tipo === 'referido' && !f.cliente_id){ location.href = 'aliados.html'; return; }
    if(!f.cliente_id){ location.href = 'comisiones.html'; return; }
    const o = { yo, alCerrar: alCerrarFicha };
    if(f.tipo === 'carta_enviar' && ref.servicio){ o.tab = 'datos'; o.enviar = ref.servicio; }
    else if(f.tipo === 'venta_falta') o.tab = ref.legal === false ? 'documentos' : 'comision';
    else if(['certificar', 'por_enviar', 'sin_ip', 'revisar_pago', 'carta_enviar'].indexOf(f.tipo) >= 0) o.tab = 'comision';
    else if(f.tipo === 'ip_confirmar') o.tab = 'datos';
    else if(['elaborar_contrato', 'elaborar_vgt', 'seguir_firma', 'contrato_archivo', 'contrato_vence', 'por_firmar'].indexOf(f.tipo) >= 0) o.tab = 'contrato';
    else if(['docs_faltan', 'devuelto', 'vgt', 'poliza', 'revisar_docs', 'cambio_revisar', 'cliente_nuevo', 'orden_atrasada', 'legal_obs'].indexOf(f.tipo) >= 0) o.tab = 'documentos';
    if(f.tipo === 'devuelto') o.casilla = 'devuelto';
    else if(f.tipo === 'docs_faltan' || f.tipo === 'cliente_nuevo') o.casilla = 'falta';
    if(f.tipo === 'revisar_docs' || f.tipo === 'cambio_revisar') o.revisar = true;
    if(f.tipo === 'sin_gestion') o.pedir = 'pedir';
    window.Ficha.abrir(f.cliente_id, o);
  }
  // Cola de revisión (administrador) o de contratos (Legal): al cerrar uno se ofrece el siguiente
  function empezarCola(){
    const tipo = D.vista === 'admin' ? 'revisar_docs' : 'elaborar_contrato';
    const l = (D.items || []).filter((f) => f.tipo === tipo).sort((a, b) => (String(a.desde) < String(b.desde) ? -1 : 1));
    if(!l.length) return; cola = { tipo, hechos: [l[0].clave] }; hacer(l[0]);
  }
  function alCerrarFicha(){ cargar(); }
  function seguirCola(){
    if(!cola || C.hojaAbierta()) return;
    const sig = (D.items || []).filter((f) => f.tipo === cola.tipo && cola.hechos.indexOf(f.clave) < 0).sort((a, b) => (String(a.desde) < String(b.desde) ? -1 : 1))[0];
    const z = $('barraCola');
    if(!sig){ cola = null; z.classList.add('hidden'); toast('Terminaste la cola'); return; }
    z.innerHTML = '<span>Siguiente: <b>' + esc(sig.titulo) + '</b></span><button type="button" class="btn btn-chico btn-2" data-tr="parar">Terminar</button><button type="button" class="btn btn-chico" data-tr="seguir" data-clave="' + esc(sig.clave) + '">Seguir</button>';
    z.classList.remove('hidden');
  }

  // ---------- Revisión en lote (vive aquí; revision.html lleva a esta vista) ----------
  function mostrarVista(){
    const lote = vista === 'lote';
    $('vistaBuzon').classList.toggle('hidden', lote); $('vistaLote').classList.toggle('hidden', !lote);
    ['nums', 'bandaPersona', 'zonaPersona'].forEach((x) => { if(lote) $(x).classList.add('hidden'); });
    document.querySelector('.mt-cab').classList.toggle('hidden', lote);
    if(lote) window.RevisionLote.abrir($('vistaLote'), { yo, aviso, alSalir: () => { vista = 'buzon'; guardarUrl(); mostrarVista(); D = null; cargar(); } });
    else if(D) pintar();
  }

  document.addEventListener('click', (ev) => {
    const t = ev.target; let b;
    if(t.closest('#vistaLote')) return;
    if((b = t.closest('[data-grupo]')) && (b.closest('#tarjetas') || b.closest('#nums') || b.closest('.cn-tiles') || b.classList.contains('bz-ver'))){ sel = b.dataset.grupo; if(sel === '') verEq = false; cuantos = 40; guardarUrl(); pintar(); if(b.classList.contains('bz-ver') || b.closest('#nums')) $('cuerpo').scrollIntoView({ block: 'start' }); return; }
    if((b = t.closest('[data-hacer]'))){ const f = buscar(b.dataset.hacer); if(f) hacer(f); return; }
    if((b = t.closest('[data-cn-wa],[data-cn-pdf],[data-cn-ya],[data-cn-rec],[data-cn-pasar],[data-cn-ip],[data-cn-hacer]'))){ cnAccion(b); return; }
    if((b = t.closest('#cuerpo [data-problema]'))){ window.Ficha.problemaLegal(Number(b.dataset.problema), () => { cache.borrarTodo(); cargar(); }); return; }
    if((b = t.closest('[data-cn-modo]'))){ modoC = b.dataset.cnModo; sel = ''; guardarUrl(); pintar(); return; }
    if((b = t.closest('[data-cn-eq]'))){ verEq = b.dataset.cnEq === '1'; sel = ''; guardarUrl(); pintar(); return; }
    if((b = t.closest('[data-cn-por]'))){ cartasPor = b.dataset.cnPor; pintar(); return; }
    if((b = t.closest('[data-gest-est]'))){ gestionEstado(b); return; }
    if((b = t.closest('[data-filtro-c]'))){ filtroC = b.dataset.filtroC; pintar(); return; }
    // Lote 05/11 D6: Marcar hecho pide confirmar (segundo toque) y queda en la bitácora
    if((b = t.closest('[data-nota-hecha]'))){ const marcar = b.getAttribute('aria-pressed') !== 'true';
      if(marcar && b.dataset.armado !== '1'){ b.dataset.armado = '1'; b.classList.add('armado'); aviso('Toca otra vez para marcarla como hecha'); setTimeout(() => { if(document.contains(b)){ b.dataset.armado = ''; b.classList.remove('armado'); } }, 4000); return; }
      notaHecha(b.dataset.notaHecha, marcar); return; }
    if((b = t.closest('[data-nota-cli]'))){ window.Ficha.abrir(Number(b.dataset.notaCli), { yo, alCerrar: alCerrarFicha }); return; }
    if((b = t.closest('[data-persona]'))){ persona = b.dataset.persona; sel = ''; guardarUrl(); D = null; cargar(); window.scrollTo(0, 0); return; }
    if((b = t.closest('[data-ges]'))){ const g = b.dataset.ges; if(g === 'nueva') window.Gestiones.nueva({ alCrear: cargar }); else window.Gestiones.abrir(Number(g), { alCerrar: cargar }); return; }
    if((b = t.closest('[data-tr]'))){
      const a = b.dataset.tr;
      if(a === 'reintentar') cargar(); else if(a === 'mas'){ cuantos += 40; pintar(); }
      else if(a === 'volver'){ persona = ''; guardarUrl(); D = null; cargar(); }
      else if(a === 'cola') empezarCola();
      else if(a === 'lote'){ vista = 'lote'; guardarUrl(); mostrarVista(); }
      else if(a === 'deshacer'){ const z = $('bzAviso'); const f = z._deshacer; z.classList.add('hidden'); if(f) f(); }
      else if(a === 'parar'){ cola = null; $('barraCola').classList.add('hidden'); }
      else if(a === 'entendido'){ try { localStorage.setItem('ae_quecambio_0511:' + yo.id, '1'); } catch (e) {} $('queCambio').classList.add('hidden'); }
      else if(a === 'seguir' && cola){ const f = (D.items || []).find((x) => x.tipo === cola.tipo && x.clave === b.dataset.clave); $('barraCola').classList.add('hidden'); if(f){ cola.hechos.push(f.clave); hacer(f); } }
    }
  });
  document.addEventListener('submit', (e) => { if(e.target.id === 'formNotaP'){ e.preventDefault(); guardarNota(e.target); } if(e.target.id === 'formPasar') pasar(e); });
  let buscaT = null;
  $('bzBuscar').addEventListener('input', () => { clearTimeout(buscaT); buscaT = setTimeout(() => { busca = $('bzBuscar').value.trim(); if(D) pintar(); }, 200); });
  $('persona').addEventListener('change', () => { persona = $('persona').value; sel = ''; guardarUrl(); D = null; cargar(); });
  document.addEventListener('visibilitychange', () => { if(!document.hidden && yo && !C.hojaAbierta() && vista === 'buzon') cargar(); });

  window.Armazon.arrancar(['admin', 'analista', 'lider', 'abogado'], { activo: 'trabajo' }, (p) => {
    yo = p; window.Ficha.montar(); leerUrl();
    if(vista === 'lote' && !(p.rol === 'admin' || p.rol === 'abogado')) vista = 'buzon';
    if(vista === 'lote') mostrarVista(); else cargar();
  }, (p) => { yo = p; });
})();
