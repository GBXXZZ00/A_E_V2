// Clientes: la única lista de expedientes. Arriba tres tarjetas (PYME, Dedicado corporativo, Dedicado ISP; un combinado sale en dos).
// La lista se queda quieta; los filtros y el expediente salen encima. Lote 21/10: "Todos" por defecto, páginas con flechas,
// etiquetas de gestión (Contactado, Sin contacto, Esperando documentos) y suspendidos aparte.
(function(){
  'use strict';
  const { $, esc, ic, rpc, toast, cache, vacio, docFmt, sucursal, chipEstatus, faltaTexto, diasEntre, plural, iniciales, abrirHoja, ESTATUS } = window.Comun;
  const S = window.Sesion;
  const POR_PAGINA = 30;
  const ATAJOS = [
    { id: 'todos', t: 'Todos' }, { id: 'en_curso', t: 'En curso' }, { id: 'por_revisar', t: 'Por revisar' }, { id: 'sin_gestion', t: 'Sin gestión' },
    { id: 'faltan', t: 'Faltan documentos' }, { id: 'por_subir', t: 'Archivos por subir' }, { id: 'vgt', t: 'VGT', ded: true }
  ];
  const DEF = 'todos';
  const GESTION = window.Comun.GESTION || { contactado: 'Contactado', sin_contacto: 'Sin contacto', esperando: 'Esperando documentos' };
  const TARJETAS = [{ id: 'pyme', t: 'PYME' }, { id: 'corporativo', t: 'Dedicado corporativo' }, { id: 'isp', t: 'Dedicado ISP' }];
  // Lo que se escribía como "Segmento" en enlaces viejos ahora es la tarjeta
  const DE_TIPO = { 'PYME': 'pyme', 'Combinado': 'pyme', 'Dedicado corporativo': 'corporativo', 'Dedicado ISP': 'isp' };
  const K_TARJETA = 'ae_cli_tarjeta';
  // Atajos a los que se llega desde un pendiente de Inicio
  const EXTRA = { devueltos: 'Con documentos devueltos', ultimo_corte: 'En su último corte', por_firmar: 'Por firmar', firmados: 'Firmados' };
  const SELS = [
    { k: 'segmento', t: 'Segmento' }, { k: 'lider', t: 'Líder' }, { k: 'estatus', t: 'Estatus legal' }, { k: 'vgt', t: 'VGT' },
    { k: 'sucursal', t: 'Sucursal' }, { k: 'servicio', t: 'Estado del servicio' }
  ];
  const FIJAS = { segmento: [['pyme', 'PYME'], ['dedicado', 'Dedicado'], ['isp', 'Dedicado ISP'], ['combinado', 'Combinado']],
    vgt: [['con', 'Con VGT'], ['por_firmar', 'VGT por firmar'], ['incompletos', 'Requisitos VGT incompletos']] };
  let tarjeta = 'pyme'; let nTarjetas = null;
  const esDed = () => tarjeta === 'corporativo' || tarjeta === 'isp';
  const selsDe = () => SELS.filter((x) => !x.ded || esDed());
  const atajosDe = () => ATAJOS.filter((x) => !x.ded || esDed());
  // Al salir de las tarjetas de dedicados se suelta su atajo
  function soltarDed(){ if(esDed()) return; SELS.forEach((x) => { if(x.ded) delete sel[x.k]; }); if(ATAJOS.some((x) => x.ded && x.id === filtro)) filtro = DEF; }
  function leerTarjeta(){ try { const v = localStorage.getItem(K_TARJETA); return TARJETAS.some((t) => t.id === v) ? v : 'pyme'; } catch (e) { return 'pyme'; } }
  function guardarTarjeta(){ if(tarjeta === 'todas') return; try { localStorage.setItem(K_TARJETA, tarjeta); } catch (e) {} }
  let yo = null; let rol = ''; let filtro = DEF; let q = ''; let sel = {}; let filas = []; let total = 0; let conteos = null; let opciones = null;
  let pedido = 0; let reloj = null; let cargando = false; let marcado = 0;
  let desde = 0;                  // primera fila de la página que se ve
  let etq = ''; let gcu = null;   // etiqueta de gestión que filtra y la cuenta de cada una
  let verSus = false; let nSus = 0;   // suspendidos: fuera de la lista salvo con "Ver suspendidos"

  function leerUrl(){
    const u = new URLSearchParams(location.search);
    const f = u.get('f'); filtro = ATAJOS.some((x) => x.id === f) || Object.prototype.hasOwnProperty.call(EXTRA, f || '') ? f : DEF;
    const g = u.get('g'); etq = GESTION[g] ? g : ''; verSus = u.get('sus') === '1';
    q = (u.get('q') || '').slice(0, 60);
    sel = {}; SELS.forEach((x) => { const v = u.get(x.k); if(v) sel[x.k] = v.slice(0, 60); });
    // Enlaces viejos con Tipo = Combinado
    if(!sel.segmento && u.get('tipo') === 'Combinado') sel.segmento = 'combinado';
    // Con un atajo que viene de Inicio o Comisiones (sin tarjeta) se ve en todas, igual que el número que lo trajo
    const s = u.get('s'); tarjeta = TARJETAS.some((t) => t.id === s) ? s : DE_TIPO[u.get('tipo')] || (u.get('f') || u.get('c') ? 'todas' : leerTarjeta());
    soltarDed();
    return { c: Number(u.get('c')) || 0, t: u.get('t') || '', revisar: u.get('revisar'), pedir: u.get('pedir') };
  }
  function guardarUrl(){
    const u = new URLSearchParams();
    if(tarjeta !== 'pyme' && tarjeta !== 'todas') u.set('s', tarjeta);
    if(filtro !== DEF) u.set('f', filtro);
    if(q) u.set('q', q);
    if(etq) u.set('g', etq);
    if(verSus) u.set('sus', '1');
    SELS.forEach((x) => { if(sel[x.k]) u.set(x.k, sel[x.k]); });
    const s = u.toString();
    history.replaceState(history.state, '', location.pathname + (s ? '?' + s : ''));
  }
  const nSel = () => selsDe().filter((x) => sel[x.k]).length;
  const clave = () => 'clientes4:' + tarjeta + ':' + filtro + ':' + q + ':' + etq + ':' + (verSus ? 1 : 0) + ':' + JSON.stringify(sel);

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
    pintarGestion();
  }
  // La cuenta de cada etiqueta de gestión (filtra al tocarla) y "Ver suspendidos"
  function pintarGestion(){
    const z = $('gestionCuentas'); if(!z) return;
    z.innerHTML = (verSus ? '' : Object.keys(GESTION).map((k) => { const on = etq === k; const n = gcu && gcu[k] !== undefined ? Number(gcu[k]) || 0 : null;
      return '<button type="button" class="gcu ' + k + (on ? ' on' : '') + '" data-etq-filtro="' + k + '" aria-pressed="' + on + '"><i aria-hidden="true"></i>' + esc(GESTION[k]) + (n === null ? '' : '<b>' + n + '</b>') + '</button>'; }).join('')) +
      (verSus || nSus ? '<button type="button" class="gcu sus' + (verSus ? ' on' : '') + '" id="verSus" aria-pressed="' + verSus + '">' + (verSus ? 'Volver a la lista' : 'Ver suspendidos<b>' + (Number(nSus) || 0) + '</b>') + '</button>' : '');
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
    const g = c.etq && GESTION[c.etq.e] ? c.etq : null;
    const tags = (c.suspendido ? '<span class="tagn rojo">Suspendido</span>' : '') + (g ? '<span class="tagn gest-' + esc(g.e) + '">' + esc(GESTION[g.e]) + (g.fecha ? ' ' + esc(String(g.fecha).slice(8, 10) + '/' + String(g.fecha).slice(5, 7)) : '') + '</span>' : '') +
      (c.combinado ? '<span class="tagn azul">PYME + Dedicado' + (c.ded === 'isp' ? ' ISP' : '') + '</span>' : '') + (c.vgt ? '<span class="tagn azul">VGT</span>' : '') + polizaTag(c.poliza_vence) +
      (c.ctr === 'sin_archivo' ? '<span class="tagn ambar">Firmado: falta subir contrato</span>' : c.ctr === 'sin_vence' ? '<span class="tagn ambar">Falta vencimiento</span>' : '');
    return '<div class="cli-w"><button type="button" class="cli' + (marcado === c.id ? ' sel' : '') + '" data-cliente="' + esc(c.id) + '">' +
      '<span class="quien"><span class="mono" aria-hidden="true">' + esc(iniciales(c.nombre).charAt(0)) + '</span><span><b>' + esc(c.nombre) + '</b><small>' + tags + (c.por_subir ? '<span class="tagn ambar">' + (c.aprobado_por_subir ? 'Aprobado, documentos por subir' : 'Archivos por subir') + '</span>' : '') + esc(sub) + '</small></span></span>' +
      '<span class="c2">' + esc(c.lider || 'Sin líder') + '</span><span class="c3">' + chipEstatus(c.estatus) + '</span>' +
      '<span class="sig ' + sig[0] + '">' + (c.ultimo_corte ? 'Último corte. ' : '') + esc(sig[1]) + '</span>' + ic('derecha', 'ch fl') + '</button>' +
      '<button type="button" class="cli-etq" data-etiquetar="' + esc(c.id) + '" aria-label="Etiqueta de gestión de ' + esc(c.nombre) + '">' + ic('etiqueta') + '</button></div>';
  }
  function pintarLista(){
    const n = nSel();
    const T = TARJETAS.find((t) => t.id === tarjeta);
    $('cuentaLista').innerHTML = (q ? plural(total, 'resultado', 'resultados') + ' en todos los clientes' : (verSus ? plural(total, 'cliente suspendido', 'clientes suspendidos') : plural(total, 'cliente', 'clientes')) + (T ? ' en ' + T.t : ' en todas las tarjetas') + (etq ? ': ' + GESTION[etq].toLowerCase() : '')) + (n || etq ? '<button type="button" class="enlace" id="quitarFiltros">Quitar filtros</button>' : '');
    if(!filas.length){
      $('enc').classList.add('hidden');
      $('lista').innerHTML = q ? vacio('No encontramos nada con "' + q + '"', 'Prueba con otra parte del nombre, el RIF sin guiones o el código del servicio.')
        : n ? vacio('Ningún cliente con esos filtros', 'Quita alguno para ver más.', '<button type="button" class="btn btn-chico btn-2" id="quitarFiltros2">Quitar filtros</button>')
        : T && conteosTodas() ? vacio('Nada aquí en ' + T.t, 'Hay clientes en este grupo en otras tarjetas.', '<button type="button" class="btn btn-chico btn-2" data-tarjeta-todas="1">Ver en todas</button>')
        : verSus ? vacio('No hay clientes suspendidos', 'Un cliente se suspende desde su hoja, en Datos.', '<button type="button" class="btn btn-chico btn-2" id="verSus2">Volver a la lista</button>')
        : etq ? vacio('Ningún cliente con la etiqueta ' + GESTION[etq], 'Pon la etiqueta desde la fila o la hoja del cliente.', '<button type="button" class="btn btn-chico btn-2" id="quitarFiltros2">Quitar filtros</button>')
        : vacio('No hay clientes aquí', filtro === 'en_curso' ? 'Cuando se cargue una instalación nueva, el cliente aparece en esta lista.' : 'Ningún cliente está en este grupo ahora mismo.',
          filtro !== 'todos' ? '<button type="button" class="btn btn-chico btn-2" data-filtro="todos">Ver todos</button>' : '');
      $('pieLista').classList.add('hidden');
      return;
    }
    $('enc').classList.remove('hidden');
    $('lista').innerHTML = '<div class="lista-cli">' + filas.map(fila).join('') + '</div>';
    const pie = $('pieLista'); pie.classList.toggle('hidden', total <= POR_PAGINA && desde === 0);
    const hasta = desde + filas.length;
    pie.innerHTML = '<nav class="pasapag" aria-label="Páginas"><button type="button" class="pag-f" id="pagAnt" aria-label="Página anterior"' + (desde > 0 ? '' : ' disabled') + '>' + ic('izquierda') + '</button>' +
      '<span id="pagTx">' + (desde + 1) + '–' + hasta + ' de ' + total + '</span>' +
      '<button type="button" class="pag-f" id="pagSig" aria-label="Página siguiente"' + (hasta < total ? '' : ' disabled') + '>' + ic('derecha') + '</button></nav>';
  }
  const conteosTodas = () => !!nTarjetas && (nTarjetas.pyme + nTarjetas.corporativo + nTarjetas.isp) > 0 && filtro !== 'todos' && !etq && !verSus;
  function esqueletos(){ let h = ''; for(let i = 0; i < 6; i++) h += '<div class="sk-cli" aria-hidden="true"><span class="sk" style="width:40px;height:40px;border-radius:12px"></span><span class="sk-tx"><span class="sk" style="width:' + (45 + i * 7) + '%;height:14px"></span><span class="sk" style="width:' + (30 + i * 5) + '%;height:11px"></span></span></div>'; return h; }

  async function pedirLista(de, limite){
    return rpc('clientes_lista2', { p_filtro: filtro, p_busca: q, p_limite: limite, p_desde: de, p_filtros: Object.assign({}, sel, { tarjeta: tarjeta === 'todas' ? '' : tarjeta, gestion: etq, suspendidos: verSus ? '1' : '' }) });
  }
  function recibir(d){
    filas = d.filas || [];
    total = d.total || 0; conteos = d.conteos || null; opciones = d.opciones || opciones; nTarjetas = d.tarjetas || nTarjetas;
    gcu = d.gestion || gcu; nSus = d.suspendidos !== undefined ? d.suspendidos : nSus;
  }
  // pag: número de la primera fila a pedir (las flechas); sin él vuelve a la primera página
  async function cargar(pag){
    const mio = ++pedido; cargando = true; const otra = typeof pag === 'number';
    desde = otra ? Math.max(0, pag) : 0;
    if(!otra){
      const g = cache.leer(clave());
      if(g && g.rol === rol){ filas = g.filas; total = g.total; conteos = g.conteos; opciones = g.opciones || opciones; nTarjetas = g.tarjetas || nTarjetas; gcu = g.gcu || gcu; nSus = g.nSus || nSus; pintarTarjetas(); pintarAtajos(); pintarSels(); pintarLista(); }
      else { $('lista').innerHTML = esqueletos(); $('pieLista').classList.add('hidden'); $('cuentaLista').textContent = 'Cargando…'; }
    } else {
      // Mientras llega la otra página se ve la de antes, atenuada, con las flechas quietas
      ['pagAnt', 'pagSig'].forEach((k) => { const b = $(k); if(b) b.disabled = true; }); const t = $('pagTx'); if(t) t.textContent = 'Cargando…';
      $('lista').classList.add('cargando-lista');
    }
    try {
      const d = await pedirLista(desde, POR_PAGINA);
      if(mio !== pedido) return;   // llegó una respuesta vieja: se ignora
      cargando = false; recibir(d); $('lista').classList.remove('cargando-lista');
      if(!otra) cache.guardar(clave(), { filas, total, conteos, opciones, rol, tarjetas: nTarjetas, gcu, nSus });
      pintarTarjetas(); pintarAtajos(); pintarSels(); pintarLista();
      if(otra){ const z = $('cuentaLista'); if(z) z.scrollIntoView({ block: 'start', behavior: 'auto' }); }
    } catch (e) {
      if(mio !== pedido) return;
      cargando = false; $('lista').classList.remove('cargando-lista');
      if(!filas.length || !otra) $('lista').innerHTML = '<div class="vacio" role="alert"><b>No se pudo cargar la lista</b><p>' + esc(e.message) + '</p><button type="button" class="btn btn-chico" id="reintentar">Reintentar</button></div>';
      else pintarLista();
      toast(e.message, 'error');
    }
  }
  // Vuelve a pedir lo que ya está en pantalla (al cerrar un expediente pudo cambiar el estatus)
  async function refrescar(){
    if(cargando) return;
    const mio = ++pedido;
    try {
      const d = await pedirLista(desde, POR_PAGINA);
      if(mio !== pedido) return;
      recibir(d);
      if(!desde) cache.guardar(clave(), { filas, total, conteos, opciones, rol, tarjetas: nTarjetas, gcu, nSus });
      pintarTarjetas(); pintarAtajos(); pintarSels(); pintarLista();
    } catch (e) {}
  }
  function abrirCliente(id, o){
    marcado = id; Array.prototype.forEach.call(document.querySelectorAll('.cli'), (x) => x.classList.toggle('sel', Number(x.dataset.cliente) === id));
    window.Ficha.abrir(id, Object.assign({ yo, alCerrar: refrescar }, o || {}));
  }
  function limpiar(){ sel = {}; etq = ''; guardarUrl(); pintarSels(); pintarAtajos(); cargar(); }

  document.addEventListener('click', (e) => {
    const t = e.target; let b;
    if((b = t.closest('#tarjetas [data-tarjeta]'))){
      if(b.dataset.tarjeta === tarjeta && !q) return;
      tarjeta = b.dataset.tarjeta; guardarTarjeta(); soltarDed();
      q = ''; $('busca').value = ''; guardarUrl(); pintarTarjetas(); pintarAtajos(); pintarSels(); cargar(); return;
    }
    if(t.closest('#lista [data-tarjeta-todas]')){ tarjeta = 'todas'; soltarDed(); guardarUrl(); pintarTarjetas(); pintarSels(); cargar(); return; }
    if((b = t.closest('#filtros [data-filtro], #lista [data-filtro]'))){ filtro = b.dataset.filtro; q = ''; $('busca').value = ''; guardarUrl(); pintarAtajos(); cargar(); return; }
    if(t.closest('#abrirFiltros')){ abrirHoja('hojaFiltros'); return; }
    if(t.closest('#quitarFiltros') || t.closest('#quitarFiltros2') || t.closest('#limpiarFiltros')){ limpiar(); return; }
    if(t.closest('#pagAnt')){ cargar(Math.max(0, desde - POR_PAGINA)); return; }
    if(t.closest('#pagSig')){ cargar(desde + POR_PAGINA); return; }
    if((b = t.closest('[data-etq-filtro]'))){ etq = etq === b.dataset.etqFiltro ? '' : b.dataset.etqFiltro; q = ''; $('busca').value = ''; guardarUrl(); pintarAtajos(); cargar(); return; }
    if(t.closest('#verSus') || t.closest('#verSus2')){ verSus = !verSus; etq = ''; q = ''; $('busca').value = ''; guardarUrl(); pintarAtajos(); cargar(); return; }
    if((b = t.closest('[data-etiquetar]'))){ window.Gestion.etiquetar(Number(b.dataset.etiquetar), refrescar, (filas.find((x) => x.id === Number(b.dataset.etiquetar)) || {}).etq); return; }
    if(t.closest('#lista #reintentar')){ cargar(); return; }
    if((b = t.closest('.cli[data-cliente]'))) abrirCliente(Number(b.dataset.cliente));
  });
  document.addEventListener('change', (e) => {
    const x = e.target.closest('[data-sel]'); if(!x) return;
    if(x.value) sel[x.dataset.sel] = x.value; else delete sel[x.dataset.sel];
    guardarUrl(); pintarSels(); cargar();
  });
  $('formBusca').addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(reloj); buscar(); $('busca').blur(); });
  $('busca').addEventListener('input', () => { clearTimeout(reloj); reloj = setTimeout(buscar, 380); });
  function buscar(){ const v = $('busca').value.trim(); if(v === q) return; q = v; guardarUrl(); pintarAtajos(); cargar(); }
  $('hojaFiltros').addEventListener('hoja-cerrada', () => setTimeout(guardarUrl, 60));
  document.addEventListener('visibilitychange', () => { if(!document.hidden && yo && filas.length && !window.Comun.hojaAbierta()) refrescar(); });

  window.Armazon.arrancar(['admin', 'abogado', 'lider', 'analista'], { activo: 'clientes' }, (p) => {
    yo = p; rol = yo.rol;
    window.Ficha.montar(); window.Ficha.alContactarFuera(refrescar);
    const u = leerUrl(); $('busca').value = q; guardarTarjeta(); pintarTarjetas(); pintarAtajos(); pintarSels();
    cargar();
    // Enlace directo a un expediente (desde Inicio o un aviso)
    if(u.c){ guardarUrl(); abrirCliente(u.c, { tab: u.t, revisar: u.revisar, pedir: u.pedir }); }
    // Desde Inicio: la lista de bienvenidas por enviar
    else if(new URLSearchParams(location.search).get('bienvenidas')){ try { history.replaceState(history.state, '', location.pathname); } catch (e) {} window.Bienvenidas.abrir({ yo, alCerrar: refrescar }); }
  }, (p) => { yo = p; });
})();
