// Clientes: la única lista de expedientes. Arriba tres tarjetas (PYME, Dedicado corporativo, Dedicado ISP; un combinado sale en dos).
// La lista se queda quieta; los filtros y el expediente salen encima.
(function(){
  'use strict';
  const { $, esc, ic, rpc, toast, cache, vacio, docFmt, sucursal, chipEstatus, faltaTexto, diasEntre, plural, iniciales, abrirHoja, ESTATUS } = window.Comun;
  const S = window.Sesion;
  const POR_PAGINA = 30;
  const ATAJOS = [
    { id: 'en_curso', t: 'En curso' }, { id: 'por_revisar', t: 'Por revisar' }, { id: 'sin_gestion', t: 'Sin gestión' },
    { id: 'faltan', t: 'Faltan documentos' }, { id: 'por_subir', t: 'Archivos por subir' }, { id: 'vgt', t: 'VGT', ded: true }, { id: 'todos', t: 'Todos' }
  ];
  const TARJETAS = [{ id: 'pyme', t: 'PYME' }, { id: 'corporativo', t: 'Dedicado corporativo' }, { id: 'isp', t: 'Dedicado ISP' }];
  // Lo que se escribía como "Segmento" en enlaces viejos ahora es la tarjeta
  const DE_TIPO = { 'PYME': 'pyme', 'Combinado': 'pyme', 'Dedicado corporativo': 'corporativo', 'Dedicado ISP': 'isp' };
  const K_TARJETA = 'ae_cli_tarjeta';
  // Atajos a los que se llega desde un pendiente de Inicio
  const EXTRA = { devueltos: 'Con documentos devueltos', ultimo_corte: 'En su último corte', por_firmar: 'Por firmar', firmados: 'Firmados' };
  const SELS = [
    { k: 'lider', t: 'Líder' }, { k: 'estatus', t: 'Estatus legal' }, { k: 'sucursal', t: 'Sucursal' }, { k: 'servicio', t: 'Estado del servicio' },
    // Solo en las tarjetas de dedicados
    { k: 'vgt', t: 'VGT', ded: true }, { k: 'enlaces', t: 'Enlaces', ded: true }, { k: 'poliza', t: 'Pólizas', ded: true }
  ];
  const FIJAS = { vgt: [['con', 'Con VGT'], ['por_firmar', 'VGT por firmar']], enlaces: [['activos', 'Con enlaces activos'], ['sin', 'Sin enlaces activos']],
    poliza: [['por_vencer', 'Vencida o vence en 30 días'], ['con', 'Con póliza cargada']] };
  let tarjeta = 'pyme'; let nTarjetas = null;
  const esDed = () => tarjeta === 'corporativo' || tarjeta === 'isp';
  const selsDe = () => SELS.filter((x) => !x.ded || esDed());
  const atajosDe = () => ATAJOS.filter((x) => !x.ded || esDed());
  // Al salir de las tarjetas de dedicados se sueltan sus filtros y su atajo
  function soltarDed(){ if(esDed()) return; SELS.forEach((x) => { if(x.ded) delete sel[x.k]; }); if(ATAJOS.some((x) => x.ded && x.id === filtro)) filtro = 'en_curso'; }
  function leerTarjeta(){ try { const v = localStorage.getItem(K_TARJETA); return TARJETAS.some((t) => t.id === v) ? v : 'pyme'; } catch (e) { return 'pyme'; } }
  function guardarTarjeta(){ if(tarjeta === 'todas') return; try { localStorage.setItem(K_TARJETA, tarjeta); } catch (e) {} }
  let yo = null; let rol = ''; let filtro = 'en_curso'; let q = ''; let sel = {}; let filas = []; let total = 0; let conteos = null; let opciones = null;
  let pedido = 0; let reloj = null; let cargando = false; let marcado = 0;

  function leerUrl(){
    const u = new URLSearchParams(location.search);
    const f = u.get('f'); filtro = ATAJOS.some((x) => x.id === f) || Object.prototype.hasOwnProperty.call(EXTRA, f || '') ? f : 'en_curso';
    q = (u.get('q') || '').slice(0, 60);
    sel = {}; SELS.forEach((x) => { const v = u.get(x.k); if(v) sel[x.k] = v.slice(0, 60); });
    // Con un atajo que viene de Inicio o Comisiones (sin tarjeta) se ve en todas, igual que el número que lo trajo
    const s = u.get('s'); tarjeta = TARJETAS.some((t) => t.id === s) ? s : DE_TIPO[u.get('tipo')] || (u.get('f') || u.get('c') ? 'todas' : leerTarjeta());
    soltarDed();
    return { c: Number(u.get('c')) || 0, t: u.get('t') || '', revisar: u.get('revisar'), pedir: u.get('pedir') };
  }
  function guardarUrl(){
    const u = new URLSearchParams();
    if(tarjeta !== 'pyme' && tarjeta !== 'todas') u.set('s', tarjeta);
    if(filtro !== 'en_curso') u.set('f', filtro);
    if(q) u.set('q', q);
    SELS.forEach((x) => { if(sel[x.k]) u.set(x.k, sel[x.k]); });
    const s = u.toString();
    history.replaceState(history.state, '', location.pathname + (s ? '?' + s : ''));
  }
  const nSel = () => selsDe().filter((x) => sel[x.k]).length;
  const clave = () => 'clientes3:' + tarjeta + ':' + filtro + ':' + q + ':' + JSON.stringify(sel);

  function pintarTarjetas(){
    $('tarjetas').innerHTML = TARJETAS.map((t) => { const n = nTarjetas ? nTarjetas[t.id] : null; const on = t.id === tarjeta;
      return '<button type="button" class="tcli' + (on ? ' on' : '') + '" data-tarjeta="' + t.id + '" aria-pressed="' + on + '"><b>' + (n === null || n === undefined ? '<span class="sk" style="display:inline-block;width:42px;height:26px"></span>' : esc(n)) + '</b><span>' + esc(t.t) + '</span></button>'; }).join('');
  }

  function pintarAtajos(){
    const lista = atajosDe();
    if(EXTRA[filtro]) lista.unshift({ id: filtro, t: EXTRA[filtro] });
    const n = nSel();
    $('filtros').innerHTML = '<button type="button" class="bfil" id="abrirFiltros">Filtros' + (n ? '<u>' + n + '</u>' : '') + '</button>' + lista.map((f) => {
      const c = conteos && conteos[f.id] !== undefined ? '<em>' + esc(conteos[f.id]) + '</em>' : '';
      return '<button type="button" data-filtro="' + f.id + '" class="' + (f.id === filtro && !q ? 'on' : '') + '" aria-pressed="' + (f.id === filtro && !q) + '">' + esc(f.t) + ' ' + c + '</button>';
    }).join('');
  }
  function opcionesDe(k){
    if(k === 'estatus') return Object.keys(ESTATUS).map((e) => [e, ESTATUS[e].t]);
    if(FIJAS[k]) return FIJAS[k];
    const l = (opciones && opciones[k]) || [];
    return l.map((v) => [v, k === 'sucursal' ? (sucursal(v) === v ? 'Sucursal ' + v : sucursal(v)) : v]);
  }
  function pintarSels(){
    const campos = (pre) => selsDe().map((x) => {
      const ops = opcionesDe(x.k); const v = sel[x.k] || '';
      const extra = v && !ops.some((o) => o[0] === v) ? [[v, v]] : [];
      return '<div class="campo-s"><label for="' + pre + x.k + '">' + x.t + '</label><select id="' + pre + x.k + '" data-sel="' + x.k + '" class="' + (v ? 'puesto' : '') + '"><option value="">Todos</option>' +
        ops.concat(extra).map((o) => '<option value="' + esc(o[0]) + '"' + (o[0] === v ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select></div>';
    }).join('');
    const foco = document.activeElement && document.activeElement.id;
    $('selsPc').innerHTML = campos('p'); $('selsTel').innerHTML = campos('t');
    if(foco && $(foco) && $(foco).tagName === 'SELECT') $(foco).focus();
    const b = $('verFiltrados'); if(b) b.textContent = 'Ver ' + plural(total, 'cliente', 'clientes');
  }

  // Qué sigue con cada cliente, según el estatus y quién lo ve
  function siguiente(c){
    const f = c.falta || []; const revisa = rol === 'admin' || rol === 'abogado';
    const dev = f.some((x) => x.e === 'devuelto'); const fal = f.some((x) => x.e === 'falta');
    const n = diasEntre(c.estatus_desde, new Date().toISOString());
    if(c.estatus === 'contrato_firmado') return ['verde', 'Contrato firmado'];
    if(c.estatus === 'por_firmar') return ['morado', 'Falta la firma del cliente' + (n > 0 ? ' hace ' + plural(n, 'día', 'días') : '')];
    if(c.estatus === 'contrato_en_curso') return ['morado', 'Legal está elaborando el contrato'];
    if(c.estatus === 'documentos_recibidos') return ['verde', 'Documentos completos. Sigue el contrato'];
    if(dev) return ['rojo', faltaTexto(f)];
    if(c.estatus === 'documentos_en_revision') return ['ambar', (revisa ? 'Revisar ' : 'Legal revisa ') + plural(c.por_revisar, 'documento', 'documentos')];
    if(c.por_instalar) return ['azul', 'Por instalar. Adelanta los documentos'];
    if(c.estatus === 'grandes_negocios') return ['gris', 'Pedir documentos'];
    if(fal) return [c.ultimo_corte ? 'rojo' : 'gris', faltaTexto(f)];
    return ['gris', 'Sin pendientes'];
  }
  // Póliza VGT que venció o vence en 30 días: se ve en la fila
  function polizaTag(v){
    if(!v) return ''; const d = diasEntre(new Date().toISOString(), String(v).slice(0, 10) + 'T12:00:00'); if(d > 30) return '';
    return '<span class="tagn ' + (d < 0 ? 'rojo' : 'ambar') + '">' + (d < 0 ? 'Póliza vencida' : 'Póliza vence ' + String(v).slice(8, 10) + '/' + String(v).slice(5, 7)) + '</span>';
  }
  function fila(c){
    const s = c.serv; const sig = siguiente(c);
    const dedSolo = !!c.ded && !c.n_serv;
    const sub = [c.provisional ? 'Provisional, sin RIF' : docFmt(c.doc_tipo, c.doc_numero), c.combinado ? '' : c.seg, dedSolo ? plural(c.n_enl || 0, 'enlace activo', 'enlaces activos') : s ? (sucursal(s.sucursal) === s.sucursal ? 'Suc. ' + s.sucursal : sucursal(s.sucursal)) : '', c.n_serv > 1 ? c.n_serv + ' servicios' : ''].filter(Boolean).join(' · ');
    const etq = (c.combinado ? '<span class="tagn azul">Combinado' + (c.ded === 'isp' ? ', ISP' : '') + '</span>' : '') + (c.vgt ? '<span class="tagn azul">VGT</span>' : '') + polizaTag(c.poliza_vence);
    return '<button type="button" class="cli' + (marcado === c.id ? ' sel' : '') + '" data-cliente="' + esc(c.id) + '">' +
      '<span class="quien"><span class="mono" aria-hidden="true">' + esc(iniciales(c.nombre).charAt(0)) + '</span><span><b>' + esc(c.nombre) + '</b><small>' + etq + (c.por_subir ? '<span class="tagn ambar">' + (c.aprobado_por_subir ? 'Aprobado, documentos por subir' : 'Archivos por subir') + '</span>' : '') + esc(sub) + '</small></span></span>' +
      '<span class="c2">' + esc(c.lider || 'Sin líder') + '</span><span class="c3">' + chipEstatus(c.estatus) + '</span>' +
      '<span class="sig ' + sig[0] + '">' + (c.ultimo_corte ? 'Último corte. ' : '') + esc(sig[1]) + '</span>' + ic('derecha', 'ch fl') + '</button>';
  }
  function pintarLista(){
    const n = nSel();
    const T = TARJETAS.find((t) => t.id === tarjeta);
    $('cuentaLista').innerHTML = (q ? plural(total, 'resultado', 'resultados') + ' en todos los clientes' : plural(total, 'cliente', 'clientes') + (T ? ' en ' + T.t : ' en todas las tarjetas')) + (n ? '<button type="button" class="enlace" id="quitarFiltros">Quitar filtros</button>' : '');
    if(!filas.length){
      $('enc').classList.add('hidden');
      $('lista').innerHTML = q ? vacio('No encontramos nada con "' + q + '"', 'Prueba con otra parte del nombre, el RIF sin guiones o el código del servicio.')
        : n ? vacio('Ningún cliente con esos filtros', 'Quita alguno para ver más.', '<button type="button" class="btn btn-chico btn-2" id="quitarFiltros2">Quitar filtros</button>')
        : T && conteosTodas() ? vacio('Nada aquí en ' + T.t, 'Hay clientes en este grupo en otras tarjetas.', '<button type="button" class="btn btn-chico btn-2" data-tarjeta-todas="1">Ver en todas</button>')
        : vacio('No hay clientes aquí', filtro === 'en_curso' ? 'Cuando se cargue una instalación nueva, el cliente aparece en esta lista.' : 'Ningún cliente está en este grupo ahora mismo.',
          filtro !== 'todos' ? '<button type="button" class="btn btn-chico btn-2" data-filtro="todos">Ver todos</button>' : '');
      $('pieLista').classList.add('hidden');
      return;
    }
    $('enc').classList.remove('hidden');
    $('lista').innerHTML = '<div class="lista-cli">' + filas.map(fila).join('') + '</div>';
    const pie = $('pieLista'); pie.classList.remove('hidden');
    pie.innerHTML = '<span>Mostrando ' + filas.length + ' de ' + total + '.</span>' + (filas.length < total ? '<button type="button" class="btn btn-chico btn-2" id="verMas">Ver más</button>' : '');
  }
  const conteosTodas = () => !!nTarjetas && (nTarjetas.pyme + nTarjetas.corporativo + nTarjetas.isp) > 0 && filtro !== 'todos';
  function esqueletos(){ let h = ''; for(let i = 0; i < 6; i++) h += '<div class="sk-cli" aria-hidden="true"><span class="sk" style="width:40px;height:40px;border-radius:12px"></span><span class="sk-tx"><span class="sk" style="width:' + (45 + i * 7) + '%;height:14px"></span><span class="sk" style="width:' + (30 + i * 5) + '%;height:11px"></span></span></div>'; return h; }

  async function pedirLista(desde, limite){
    return rpc('clientes_lista2', { p_filtro: filtro, p_busca: q, p_limite: limite, p_desde: desde, p_filtros: Object.assign({}, sel, { tarjeta: tarjeta === 'todas' ? '' : tarjeta }) });
  }
  function recibir(d, mas){
    filas = mas ? filas.concat(d.filas || []) : (d.filas || []);
    total = d.total || 0; conteos = d.conteos || null; opciones = d.opciones || opciones; nTarjetas = d.tarjetas || nTarjetas;
  }
  async function cargar(mas){
    const mio = ++pedido; cargando = true;
    if(!mas){
      const g = cache.leer(clave());
      if(g && g.rol === rol){ filas = g.filas; total = g.total; conteos = g.conteos; opciones = g.opciones || opciones; nTarjetas = g.tarjetas || nTarjetas; pintarTarjetas(); pintarAtajos(); pintarSels(); pintarLista(); }
      else { $('lista').innerHTML = esqueletos(); $('pieLista').classList.add('hidden'); $('cuentaLista').textContent = 'Cargando…'; }
    } else { const b = $('verMas'); if(b){ b.disabled = true; b.textContent = 'Cargando…'; } }
    try {
      const d = await pedirLista(mas ? filas.length : 0, POR_PAGINA);
      if(mio !== pedido) return;   // llegó una respuesta vieja: se ignora
      cargando = false; recibir(d, mas);
      if(!mas) cache.guardar(clave(), { filas, total, conteos, opciones, rol, tarjetas: nTarjetas });
      pintarTarjetas(); pintarAtajos(); pintarSels(); pintarLista();
    } catch (e) {
      if(mio !== pedido) return;
      cargando = false;
      if(!filas.length || !mas) $('lista').innerHTML = '<div class="vacio" role="alert"><b>No se pudo cargar la lista</b><p>' + esc(e.message) + '</p><button type="button" class="btn btn-chico" id="reintentar">Reintentar</button></div>';
      else { const b = $('verMas'); if(b){ b.disabled = false; b.textContent = 'Ver más'; } }
      toast(e.message, 'error');
    }
  }
  // Vuelve a pedir lo que ya está en pantalla (al cerrar un expediente pudo cambiar el estatus)
  async function refrescar(){
    if(cargando) return;
    const mio = ++pedido;
    try {
      const d = await pedirLista(0, Math.min(60, Math.max(POR_PAGINA, filas.length)));
      if(mio !== pedido) return;
      recibir(d, false);
      cache.guardar(clave(), { filas: filas.slice(0, POR_PAGINA), total, conteos, opciones, rol, tarjetas: nTarjetas });
      pintarTarjetas(); pintarAtajos(); pintarSels(); pintarLista();
    } catch (e) {}
  }
  function abrirCliente(id, o){
    marcado = id; Array.prototype.forEach.call(document.querySelectorAll('.cli'), (x) => x.classList.toggle('sel', Number(x.dataset.cliente) === id));
    window.Ficha.abrir(id, Object.assign({ yo, alCerrar: refrescar }, o || {}));
  }
  function limpiar(){ sel = {}; guardarUrl(); pintarSels(); cargar(false); }

  document.addEventListener('click', (e) => {
    const t = e.target; let b;
    if((b = t.closest('#tarjetas [data-tarjeta]'))){
      if(b.dataset.tarjeta === tarjeta && !q) return;
      tarjeta = b.dataset.tarjeta; guardarTarjeta(); soltarDed();
      q = ''; $('busca').value = ''; guardarUrl(); pintarTarjetas(); pintarAtajos(); pintarSels(); cargar(false); return;
    }
    if(t.closest('#lista [data-tarjeta-todas]')){ tarjeta = 'todas'; soltarDed(); guardarUrl(); pintarTarjetas(); pintarSels(); cargar(false); return; }
    if((b = t.closest('#filtros [data-filtro], #lista [data-filtro]'))){ filtro = b.dataset.filtro; q = ''; $('busca').value = ''; guardarUrl(); pintarAtajos(); cargar(false); return; }
    if(t.closest('#abrirFiltros')){ abrirHoja('hojaFiltros'); return; }
    if(t.closest('#quitarFiltros') || t.closest('#quitarFiltros2') || t.closest('#limpiarFiltros')){ limpiar(); return; }
    if(t.closest('#verMas')){ cargar(true); return; }
    if(t.closest('#lista #reintentar')){ cargar(false); return; }
    if((b = t.closest('.cli[data-cliente]'))) abrirCliente(Number(b.dataset.cliente));
  });
  document.addEventListener('change', (e) => {
    const x = e.target.closest('[data-sel]'); if(!x) return;
    if(x.value) sel[x.dataset.sel] = x.value; else delete sel[x.dataset.sel];
    guardarUrl(); pintarSels(); cargar(false);
  });
  $('formBusca').addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(reloj); buscar(); $('busca').blur(); });
  $('busca').addEventListener('input', () => { clearTimeout(reloj); reloj = setTimeout(buscar, 380); });
  function buscar(){ const v = $('busca').value.trim(); if(v === q) return; q = v; guardarUrl(); pintarAtajos(); cargar(false); }
  $('hojaFiltros').addEventListener('hoja-cerrada', () => setTimeout(guardarUrl, 60));
  document.addEventListener('visibilitychange', () => { if(!document.hidden && yo && filas.length && !window.Comun.hojaAbierta()) refrescar(); });

  window.Armazon.arrancar(['admin', 'abogado', 'lider', 'analista'], { activo: 'clientes' }, (p) => {
    yo = p; rol = yo.rol;
    window.Ficha.montar(); window.Ficha.alContactarFuera(refrescar);
    const u = leerUrl(); $('busca').value = q; guardarTarjeta(); pintarTarjetas(); pintarAtajos(); pintarSels();
    cargar(false);
    // Enlace directo a un expediente (desde Inicio o un aviso)
    if(u.c){ guardarUrl(); abrirCliente(u.c, { tab: u.t, revisar: u.revisar, pedir: u.pedir }); }
    // Desde Inicio: la lista de bienvenidas por enviar
    else if(new URLSearchParams(location.search).get('bienvenidas')){ try { history.replaceState(history.state, '', location.pathname); } catch (e) {} window.Bienvenidas.abrir({ yo, alCerrar: refrescar }); }
  }, (p) => { yo = p; });
})();
