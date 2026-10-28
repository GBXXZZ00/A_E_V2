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
  let avisoT = null;

  function leerUrl(){ const u = new URLSearchParams(location.search); sel = (u.get('g') || '').slice(0, 10); persona = (u.get('p') || '').slice(0, 40); vista = u.get('v') === 'lote' ? 'lote' : 'buzon'; }
  function guardarUrl(){ const u = new URLSearchParams(); if(vista === 'lote') u.set('v', 'lote'); else { if(sel) u.set('g', sel); if(persona) u.set('p', persona); } const s = u.toString(); history.replaceState(history.state, '', location.pathname + (s ? '?' + s : '')); }

  async function cargar(){
    const mio = ++pedido; const clave = 'mitrabajo:' + (yo && yo.id) + ':' + persona;
    if(!D){ const g = cache.leer(clave); if(g){ D = g; pintar(); } else esqueleto(); }
    try {
      const r = await rpc('mi_trabajo', { p_persona: persona || null }); if(mio !== pedido) return;
      D = r; cache.guardar(clave, r); revisarAbierto(); pintar(); if(cola) seguirCola();
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

  function pintar(){
    if(!D) return;
    if(window.Gestiones) window.Gestiones.puedeCrear = !!D.puedo_crear_gestion;
    const gs = B.grupos(D); const notas = (D.notas || []).filter((x) => !x.hecha);
    const validos = gs.map((g) => g.id).concat(['notas', D.equipo && D.equipo.length && !D.persona ? 'equipo' : '']).filter(Boolean);
    if(sel && validos.indexOf(sel) < 0) sel = '';
    const it = D.items || []; const venc = it.filter((f) => color(f) === 'venc').length; const hoy = it.filter((f) => color(f) === 'hoy').length;
    $('saludo').textContent = 'Mi trabajo'; $('frase').textContent = frase(gs);
    $('pildoras').innerHTML = '<span class="mt-pill r">' + plural(venc, 'vencido', 'vencidos') + '</span><span class="mt-pill a">' + (hoy === 1 ? '1 vence hoy' : hoy + ' vencen hoy') + '</span><span class="mt-pill g">' + it.length + ' en total</span>';
    const bp = $('bandaPersona'); bp.classList.toggle('hidden', !D.persona);
    if(D.persona) bp.innerHTML = '<b>Estás viendo el buzón de ' + esc(D.persona.nombre) + ' tal como lo ve</b><p>Solo consulta: no puedes hacer nada desde aquí. <button type="button" class="enlace" data-tr="volver">Volver a mi trabajo</button></p>';
    const zp = $('zonaPersona'); const ps = D.personas || []; zp.classList.toggle('hidden', !ps.length);
    if(ps.length) $('persona').innerHTML = '<option value="">' + (D.rol === 'admin' || D.senior ? 'Mi trabajo' : 'Todos los analistas') + '</option>' +
      ps.map((p) => '<option value="' + esc(p.id) + '"' + (p.id === persona ? ' selected' : '') + '>' + esc(p.nombre + ' (' + ({ lider: 'líder', abogado: 'Legal', analista: 'analista' }[p.rol] || p.rol) + ')') + '</option>').join('');
    $('btnLote').classList.toggle('hidden', !(D.rol === 'admin' || D.rol === 'abogado') || !!D.persona);
    pintarNums(gs); pintarIndice(gs, notas); pintarCuerpo(gs, notas);
  }
  // Números de arriba (líder y Canales): cada uno abre su grupo
  function pintarNums(gs){
    const n = (id) => (gs.find((x) => x.id === id) || { items: [] }).items.length; const z = $('nums');
    const dias = D.limite ? Math.max(0, C.diasEntre(D.hoy, D.limite)) : null;
    let l = null;
    if(D.vista === 'lider') l = [[(D.items || []).filter((f) => f.tipo === 'devuelto').length, 'Documentos devueltos', 'r', D.vende ? 'dev' : 'doc'], [(D.items || []).filter((f) => f.tipo === 'orden_atrasada').length, 'Órdenes de más de 24 horas', 'a', D.vende ? 'inst' : 'ins'],
      [dias === null ? 'Sin fecha' : plural(dias, 'día', 'días'), 'Para el cierre del corte' + (D.limite ? ' (' + fecha(D.limite).replace(/ de \d{4}$/, '') + ')' : ''), '', ''], [n('falta'), 'Faltan para comisionar', 'b', D.vende ? 'falta' : '']];
    else if(D.vista === 'analista' || D.vista === 'coord') l = [[n('carta'), 'Cartas y proformas por enviar', 'a', 'carta'], [n('ip'), 'IP por escribir', '', 'ip'], [n('pago'), 'Del corte sin pago', 'r', 'pago'], [n('emi'), 'Cambios por emitir', 'b', 'emi']];
    z.classList.toggle('hidden', !l);
    if(l) z.innerHTML = l.map((x) => (x[3] ? '<button type="button" class="bz-num ' + x[2] + '" data-grupo="' + x[3] + '">' : '<div class="bz-num ' + x[2] + '">') + '<b>' + esc(x[0]) + '</b><small>' + esc(x[1]) + '</small>' + (x[3] ? '</button>' : '</div>')).join('');
  }
  function pintarIndice(gs, notas){
    const partes = new Set(gs.map((g) => g.parte)); const dos = partes.size > 1; let ult = '';
    let h = '<button type="button" class="bz-md' + (sel === '' ? ' on' : '') + '" data-grupo="" aria-pressed="' + (sel === '') + '">Todo<span>' + (D.items || []).length + '</span></button>';
    gs.forEach((g) => {
      if(dos && g.parte !== ult){ h += '<span class="bz-parte">' + (g.parte === 'ventas' ? 'Mis ventas' : 'Mi rol') + '</span>'; ult = g.parte; }
      const viejo = g.items.length ? g.items.reduce((a, f) => (String(f.desde) < String(a.desde) ? f : a), g.items[0]) : null;
      const nuevos = g.items.filter((f) => B.diasDesde(f.desde, D.hoy) === 0).length;
      h += '<button type="button" class="bz-cd' + (sel === g.id ? ' on' : '') + '" data-grupo="' + g.id + '" aria-pressed="' + (sel === g.id) + '">' + B.icono(g.icono, g.tono) +
        '<span class="bz-cd-t"><b>' + esc(g.titulo) + '</b><small>' + esc(g.sub) + '</small></span><span class="bz-cd-n">' + g.items.length + '</span>' +
        '<span class="bz-cd-f">' + (g.venc ? '<span class="mt-pill r">' + plural(g.venc, 'vencido', 'vencidos') + '</span>' : '') + (g.hoy ? '<span class="mt-pill a">' + g.hoy + ' hoy</span>' : '') +
          '<span>' + esc(viejo ? 'Más viejo: ' + plural(B.diasDesde(viejo.desde, D.hoy), 'día', 'días') : 'Nada pendiente') + '</span>' + (nuevos ? '<b>' + esc(plural(nuevos, 'nuevo hoy', 'nuevos hoy')) + '</b>' : '') + '</span></button>';
    });
    if(!D.persona){
      const prox = notas.filter((x) => x.recordar).sort((a, b) => (a.recordar < b.recordar ? -1 : 1))[0];
      h += '<button type="button" class="bz-cd' + (sel === 'notas' ? ' on' : '') + '" data-grupo="notas" aria-pressed="' + (sel === 'notas') + '">' + B.icono('nota', 'v') +
        '<span class="bz-cd-t"><b>Mis notas</b><small>Lo que tú anotas</small></span><span class="bz-cd-n">' + notas.length + '</span>' +
        '<span class="bz-cd-f"><span>' + esc(prox ? 'Recordar el ' + fecha(prox.recordar).replace(/ de \d{4}$/, '') : notas.length ? 'Sin recordatorio' : 'Sin notas') + '</span></span></button>';
    }
    if(D.equipo && D.equipo.length && !D.persona) h += '<button type="button" class="bz-md' + (sel === 'equipo' ? ' on' : '') + '" data-grupo="equipo" aria-pressed="' + (sel === 'equipo') + '">El equipo<span>' + plural(D.equipo.length, 'persona', 'personas') + '</span></button>';
    $('tarjetas').innerHTML = h;
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
      (hecho || solo() || f.tipo === 'gestion' ? '' : '<button type="button" class="btn btn-chico ' + (color(f) === 'venc' ? '' : 'btn-2') + '" data-hacer="' + esc(k) + '">' + esc(yoNo ? 'Hacerlo yo' : a[1]) + '</button>') + '</div>';
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
    else if(sel){ const g = gs.find((x) => x.id === sel); h = seccion(g.titulo, subGrupo(g), listaGrupo(g), accionesGrupo(g)); }
    else {
      const urg = (D.items || []).slice().sort((a, b) => (String(a.vence || '9') < String(b.vence || '9') ? -1 : 1)).slice(0, 4);
      if(urg.length) h += seccion('Lo más urgente', 'Los 4 primeros de todo, por fecha', urg.map((f) => itemHtml(f)).join(''));
      else h += vacio('Todo al día', 'No tienes pendientes. Cuando algo necesite de ti, aparece aquí.');
      gs.filter((g) => g.items.length).forEach((g) => { h += seccion(g.titulo, subGrupo(g), listaGrupo(g, 3), accionesGrupo(g)); });
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
  // Legal: tablero por etapa y, abajo, los vencimientos
  function tableroLegal(gs){
    const its = D.items || []; const k = D.kpis || {};
    const col = (t, tipo) => { const l = its.filter((f) => f.tipo === tipo);
      return '<div class="bz-col"><div class="bz-col-h"><b>' + t + '</b><span>' + l.length + '</span></div>' +
        (tipo === 'elaborar_contrato' && l.length > 1 && !solo() ? '<button type="button" class="btn btn-chico" data-tr="cola">Uno tras otro, del más viejo</button>' : '') + (l.length ? l.slice(0, 30).map((f) => '<div class="bz-kd"><b>' + esc(f.titulo) + '</b><small>' + esc([f.lider, f.detalle].filter(Boolean).join(' · ')) + '</small>' +
        (plazo(f) ? '<span class="mt-pill ' + plazo(f)[0] + '">' + esc(plazo(f)[1]) + '</span>' : '') + (solo() ? '' : '<button type="button" class="btn btn-chico btn-2" data-hacer="' + esc(kDe(f)) + '">' + esc((B.ACC[f.tipo] || [, 'Ir'])[1]) + '</button>') + '</div>').join('') +
        (l.length > 30 ? '<p class="nota-chica">Y ' + (l.length - 30) + ' más.</p>' : '') : '<p class="nota-chica">Nada aquí.</p>') + '</div>'; };
    const ven = gs.find((g) => g.id === 'ven') || { items: [], tipos: ['contrato_vence'] };
    return '<div class="bz-board">' + col('Para elaborar', 'elaborar_contrato') + col('Enviado a firmar', 'seguir_firma') + col('Firmado, falta subir', 'contrato_archivo') +
      '<div class="bz-col"><div class="bz-col-h"><b>Listo esta semana</b><span>' + (k.firmados || 0) + '</span></div><p class="nota-chica">' + esc(plural(k.firmados || 0, 'contrato firmado', 'contratos firmados')) + ' en los últimos 7 días.</p></div></div>' +
      seccion('Vencimientos próximos', 'Se tachan solos cuando suben el documento nuevo', listaGrupo(ven));
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
    else if(['elaborar_contrato', 'seguir_firma', 'contrato_archivo', 'contrato_vence', 'por_firmar'].indexOf(f.tipo) >= 0) o.tab = 'contrato';
    else if(['docs_faltan', 'devuelto', 'vgt', 'poliza', 'revisar_docs', 'cambio_revisar', 'cliente_nuevo', 'orden_atrasada'].indexOf(f.tipo) >= 0) o.tab = 'documentos';
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
    if((b = t.closest('[data-grupo]')) && (b.closest('#tarjetas') || b.closest('#nums') || b.classList.contains('bz-ver'))){ sel = sel === b.dataset.grupo && b.closest('#tarjetas') ? '' : b.dataset.grupo; cuantos = 40; guardarUrl(); pintar(); if(b.classList.contains('bz-ver') || b.closest('#nums')) $('cuerpo').scrollIntoView({ block: 'start' }); return; }
    if((b = t.closest('[data-hacer]'))){ const f = buscar(b.dataset.hacer); if(f) hacer(f); return; }
    if((b = t.closest('[data-gest-est]'))){ gestionEstado(b); return; }
    if((b = t.closest('[data-nota-hecha]'))){ notaHecha(b.dataset.notaHecha, b.getAttribute('aria-pressed') !== 'true'); return; }
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
      else if(a === 'seguir' && cola){ const f = (D.items || []).find((x) => x.tipo === cola.tipo && x.clave === b.dataset.clave); $('barraCola').classList.add('hidden'); if(f){ cola.hechos.push(f.clave); hacer(f); } }
    }
  });
  document.addEventListener('submit', (e) => { if(e.target.id === 'formNotaP'){ e.preventDefault(); guardarNota(e.target); } });
  $('persona').addEventListener('change', () => { persona = $('persona').value; sel = ''; guardarUrl(); D = null; cargar(); });
  document.addEventListener('visibilitychange', () => { if(!document.hidden && yo && !C.hojaAbierta() && vista === 'buzon') cargar(); });

  window.Armazon.arrancar(['admin', 'analista', 'lider', 'abogado'], { activo: 'trabajo' }, (p) => {
    yo = p; window.Ficha.montar(); leerUrl();
    if(vista === 'lote' && !(p.rol === 'admin' || p.rol === 'abogado')) vista = 'buzon';
    if(vista === 'lote') mostrarVista(); else cargar();
  }, (p) => { yo = p; });
})();
