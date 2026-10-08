// Clientes: búsqueda, filtros y tarjetas con lo que falta y la acción que sigue.
(function(){
  'use strict';
  const { $, esc, ic, rpc, toast, cache, esqueleto, vacio, docFmt, sucursal, chipEstatus, estadoServicio, faltaTexto, dia, diasEntre, primerNombre, plural, capital } = window.Comun;
  const S = window.Sesion;
  const POR_PAGINA = 20;
  const FILTROS = [
    { id: 'en_curso', t: 'En curso' }, { id: 'por_revisar', t: 'En revisión' }, { id: 'por_instalar', t: 'Por instalar' },
    { id: 'sin_gestion', t: 'Sin gestión' }, { id: 'por_firmar', t: 'Por firmar' }, { id: 'firmados', t: 'Firmados' }, { id: 'todos', t: 'Todos' }
  ];
  // Filtros a los que se llega desde un pendiente de Inicio
  const EXTRA = { devueltos: 'Con documentos devueltos', ultimo_corte: 'En su último corte' };
  let yo = null; let filtro = 'en_curso'; let q = ''; let filas = []; let total = 0; let conteos = null; let rol = ''; let pedido = 0; let cargando = false; let reloj = null;

  function leerUrl(){
    const u = new URLSearchParams(location.search);
    const f = u.get('f'); filtro = FILTROS.some((x) => x.id === f) || EXTRA[f] ? f : 'en_curso';
    q = (u.get('q') || '').slice(0, 60);
  }
  function guardarUrl(){
    const u = new URLSearchParams();
    if(filtro !== 'en_curso') u.set('f', filtro);
    if(q) u.set('q', q);
    const s = u.toString();
    history.replaceState(null, '', location.pathname + (s ? '?' + s : ''));
  }

  function pintarFiltros(){
    const lista = FILTROS.slice();
    if(EXTRA[filtro]) lista.unshift({ id: filtro, t: EXTRA[filtro] });
    $('filtros').innerHTML = lista.map((f) => {
      const n = conteos && conteos[f.id] !== undefined ? '<em>' + esc(conteos[f.id]) + '</em>' : '';
      return '<button type="button" role="tab" data-filtro="' + f.id + '" class="' + (f.id === filtro && !q ? 'on' : '') + '" aria-selected="' + (f.id === filtro && !q) + '">' + esc(f.t) + ' ' + n + '</button>';
    }).join('');
  }

  // Qué línea de aviso y qué botón lleva cada tarjeta, según el estatus y quién la ve
  function siguiente(c){
    const f = c.falta || []; const revisa = rol === 'admin' || rol === 'abogado';
    const dev = f.some((x) => x.e === 'devuelto'); const fal = f.some((x) => x.e === 'falta');
    const ficha = 'cliente.html?id=' + c.id;
    if(c.estatus === 'contrato_firmado') return { tono: 'verde', icono: 'check', texto: 'Contrato firmado', boton: 'Abrir', enlace: ficha, secundario: true };
    if(c.estatus === 'por_firmar') return { tono: 'morado', icono: 'lapiz', texto: 'Falta la firma del cliente' + desde(c), boton: 'Recordar la firma', pedir: 'firma' };
    if(c.estatus === 'contrato_en_curso') return { tono: 'morado', icono: 'doc', texto: 'Legal está elaborando el contrato', boton: 'Abrir', enlace: ficha, secundario: true };
    if(c.estatus === 'documentos_recibidos') return { tono: 'verde', icono: 'check', texto: 'Documentos completos. Sigue el contrato', boton: 'Abrir', enlace: ficha, secundario: !revisa };
    if(dev) return { tono: 'rojo', icono: 'devolver', texto: faltaTexto(f), boton: 'Recordar al cliente', pedir: 'recordar' };
    if(c.estatus === 'documentos_en_revision'){
      return revisa ? { tono: 'ambar', icono: 'reloj', texto: 'Falta tu revisión de ' + plural(c.por_revisar, 'documento', 'documentos'), boton: 'Revisar', enlace: ficha + '&t=documentos&revisar=1' }
        : { tono: 'ambar', icono: 'reloj', texto: 'Legal está revisando ' + plural(c.por_revisar, 'documento', 'documentos'), boton: 'Abrir', enlace: ficha, secundario: true };
    }
    if(fal) return { tono: 'gris', icono: 'alerta', texto: faltaTexto(f), boton: c.estatus === 'grandes_negocios' ? 'Pedir documentos' : 'Recordar al cliente', pedir: c.estatus === 'grandes_negocios' ? 'pedir' : 'recordar' };
    return { tono: 'gris', icono: 'doc', texto: 'Sin pendientes', boton: 'Abrir', enlace: ficha, secundario: true };
  }
  function desde(c){ const n = diasEntre(c.estatus_desde, new Date().toISOString()); return n > 0 ? ' desde hace ' + plural(n, 'día', 'días') : ''; }
  function gestion(c){
    const temprano = ['grandes_negocios', 'documentos_solicitados', 'documentos_pendientes'].indexOf(c.estatus) >= 0 && !c.por_instalar;
    if(!c.ug_en){
      const n = diasEntre(c.creado_en, new Date().toISOString());
      return '<span class="' + (temprano ? 'mal' : '') + '">Sin gestión' + (n > 0 ? ' hace ' + plural(n, 'día', 'días') : '') + '</span>';
    }
    const n = diasEntre(c.ug_en, new Date().toISOString());
    return '<span class="' + (temprano && n > 3 ? 'mal' : '') + '">' + esc(n > 1 && n < 30 ? 'Hace ' + n + ' días' : dia(c.ug_en)) + (c.ug_por ? ', ' + esc(primerNombre(c.ug_por)) : '') + '</span>';
  }
  function tarjeta(c){
    const s = c.serv; const sig = siguiente(c);
    const id = [docFmt(c.doc_tipo, c.doc_numero), s ? 'Cód. ' + s.sucursal + '-' + s.codigo : '', s ? sucursal(s.sucursal) : ''].filter(Boolean).join(' · ');
    const chips = chipEstatus(c.estatus) + (s ? estadoServicio(s.estado) : '') +
      (c.por_instalar ? '<span class="chip azul">Por instalar</span>' : '') +
      (c.ultimo_corte ? '<span class="chip rojo">Último corte</span>' : '') +
      (c.es_top ? '<span class="chip">TOP</span>' : '');
    const servicios = c.por_instalar ? 'Sin instalar' : c.n_serv + ' · ' + (c.n_serv === 1 && s ? (s.plan || s.categoria || '') : c.seg);
    return '<article class="tarj" data-cliente="' + esc(c.id) + '">' +
      '<div class="cab"><a href="cliente.html?id=' + esc(c.id) + '">' + esc(c.nombre) + '</a><span class="seg">' + esc(c.seg) + '</span></div>' +
      '<p class="id">' + esc(id) + '</p>' +
      '<div class="chips">' + chips + '</div>' +
      '<div class="meta"><div><small>Líder</small><span>' + esc(c.lider || 'Sin asignar') + '</span></div>' +
        '<div><small>Servicios</small><span>' + esc(servicios) + '</span></div>' +
        '<div><small>Última gestión</small>' + gestion(c) + '</div>' +
        '<div><small>Teléfono</small><span>' + esc(c.tel || 'Sin teléfono') + '</span></div></div>' +
      '<div class="falta ' + sig.tono + '">' + ic(sig.icono) + '<span>' + esc(sig.texto) + '</span></div>' +
      '<div class="acc">' + (sig.pedir
        ? '<button type="button" class="btn btn-chico" data-pedir="' + sig.pedir + '">' + esc(sig.boton) + '</button>'
        : '<a class="btn btn-chico' + (sig.secundario ? ' btn-2' : '') + '" href="' + esc(sig.enlace) + '">' + esc(sig.boton) + '</a>') +
        window.Pedir.iconos(c) + '</div></article>';
  }

  function pintarLista(){
    if(!filas.length){
      $('lista').innerHTML = q ? vacio('No encontramos nada con "' + q + '"', 'Prueba con otra parte del nombre, el RIF sin guiones o el código del servicio.')
        : vacio('No hay clientes aquí', filtro === 'en_curso' ? 'Cuando se cargue una instalación nueva, el cliente aparece en esta lista.' : 'Ningún cliente está en este grupo ahora mismo.',
          filtro !== 'todos' ? '<button type="button" class="btn btn-chico btn-2" data-filtro="todos">Ver todos</button>' : '');
      $('pieLista').classList.add('hidden');
      return;
    }
    $('lista').innerHTML = '<div class="tarjetas">' + filas.map(tarjeta).join('') + '</div>';
    const pie = $('pieLista'); pie.classList.remove('hidden');
    pie.innerHTML = '<span>Mostrando ' + filas.length + ' de ' + total + '.</span>' +
      (filas.length < total ? '<button type="button" class="btn btn-chico btn-2" id="verMas">Ver más</button>' : '');
  }

  async function cargar(mas){
    const mio = ++pedido; const desde = mas ? filas.length : 0; cargando = true;
    const clave = 'clientes:' + filtro + ':' + q;
    if(!mas){
      const guardado = cache.leer(clave);
      if(guardado && guardado.rol === rol){ filas = guardado.filas; total = guardado.total; conteos = guardado.conteos; pintarFiltros(); pintarLista(); }
      else { $('lista').innerHTML = '<div class="tarjetas">' + esqueleto(4, 'tarjeta') + '</div>'; $('pieLista').classList.add('hidden'); }
    } else { const b = $('verMas'); if(b){ b.disabled = true; b.textContent = 'Cargando…'; } }
    $('notaBusca').classList.toggle('hidden', !q);
    if(q) $('notaBusca').textContent = 'Buscando en todos los clientes.';
    try {
      const d = await rpc('clientes_lista', { p_filtro: filtro, p_busca: q, p_limite: POR_PAGINA, p_desde: desde });
      if(mio !== pedido) return;   // llegó una respuesta vieja: se ignora
      cargando = false;
      filas = mas ? filas.concat(d.filas || []) : (d.filas || []);
      total = d.total || 0; conteos = d.conteos || null;
      if(!mas) cache.guardar(clave, { filas, total, conteos, rol });
      if(q) $('notaBusca').textContent = plural(total, 'resultado', 'resultados') + ' en todos los clientes.';
      pintarFiltros(); pintarLista();
    } catch (e) {
      if(mio !== pedido) return;
      cargando = false;
      if(!filas.length || !mas) $('lista').innerHTML = '<div class="vacio" role="alert"><b>No se pudo cargar la lista</b><p>' + esc(e.message) + '</p><button type="button" class="btn btn-chico" id="reintentar">Reintentar</button></div>';
      else { const b = $('verMas'); if(b){ b.disabled = false; b.textContent = 'Ver más'; } }
      toast(e.message, 'error');
    }
  }
  // Vuelve a pedir lo que ya está en pantalla (después de un contacto cambia el estatus)
  async function refrescar(){
    if(cargando) return;
    const mio = ++pedido;
    try {
      const d = await rpc('clientes_lista', { p_filtro: filtro, p_busca: q, p_limite: Math.min(60, Math.max(POR_PAGINA, filas.length)), p_desde: 0 });
      if(mio !== pedido) return;
      filas = d.filas || []; total = d.total || 0; conteos = d.conteos || null;
      cache.guardar('clientes:' + filtro + ':' + q, { filas: filas.slice(0, POR_PAGINA), total, conteos, rol });
      pintarFiltros(); pintarLista();
    } catch (e) {}
  }

  document.addEventListener('click', (e) => {
    const f = e.target.closest('[data-filtro]');
    if(f){ filtro = f.dataset.filtro; q = ''; $('busca').value = ''; guardarUrl(); pintarFiltros(); cargar(false); return; }
    if(e.target.closest('#verMas')){ cargar(true); return; }
    if(e.target.closest('#reintentar')){ cargar(false); return; }
    const p = e.target.closest('[data-pedir]');
    if(p){
      const id = Number(p.closest('.tarj').dataset.cliente); const c = filas.find((x) => x.id === id); if(!c) return;
      window.Pedir.abrir(c, { yo: yo.nombre, motivo: p.dataset.pedir, alHacer: refrescar });
    }
  });
  $('formBusca').addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(reloj); buscar(); $('busca').blur(); });
  $('busca').addEventListener('input', () => { clearTimeout(reloj); reloj = setTimeout(buscar, 380); });
  function buscar(){
    const v = $('busca').value.trim(); if(v === q) return;
    q = v; guardarUrl(); pintarFiltros(); cargar(false);
  }
  // Al volver de WhatsApp o del correo se refresca lo que quedó anotado
  document.addEventListener('visibilitychange', () => { if(!document.hidden && yo && filas.length) refrescar(); });

  (async function(){
    yo = await S.requerir(['admin', 'abogado', 'lider', 'analista']);
    if(!yo) return;
    rol = yo.rol;
    window.Armazon.montar(yo, { activo: 'clientes' });
    window.Pedir.alContactar(refrescar);
    leerUrl(); $('busca').value = q; pintarFiltros();
    cargar(false);
  })();
})();
