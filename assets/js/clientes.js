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
    { id: 'faltan', t: 'Faltan documentos' }, { id: 'por_subir', t: 'Archivos por subir' }, { id: 'vgt', t: 'VGT', ded: true },
    { id: 'revisar_fecha', t: 'Revisar fecha', ded: true }   // lote 27/10: contratos de dedicados sin vencimiento, para ponerlo a mano
  ];
  const DEF = 'todos';
  const GESTION = window.Comun.GESTION || { contactado: 'Contactado', sin_contacto: 'Sin contacto', esperando: 'Esperando documentos' };
  const TARJETAS = [{ id: 'pyme', t: 'PYME' }, { id: 'corporativo', t: 'Dedicado corporativo' }, { id: 'isp', t: 'Dedicado ISP' }];
  // Lo que se escribía como "Segmento" en enlaces viejos ahora es la tarjeta
  const DE_TIPO = { 'PYME': 'pyme', 'Combinado': 'pyme', 'Dedicado corporativo': 'corporativo', 'Dedicado ISP': 'isp' };
  const K_TARJETA = 'ae_cli_tarjeta';
  // Atajos a los que se llega desde un pendiente de Inicio
  const EXTRA = { devueltos: 'Con documentos devueltos', ultimo_corte: 'En su último corte', por_firmar: 'Por firmar', firmados: 'Firmados' };
  // Lote 22/10: un solo botón Filtros con grupos plegables; dentro de un grupo se suman, entre grupos se combinan
  const GR = [
    { k: 'tipo', u: 'tipo', t: 'Tipo' }, { k: 'estatus', u: 'est', t: 'Estatus legal' }, { k: 'lider', u: 'lid', t: 'Líder' }, { k: 'gestion', u: 'ges', t: 'Gestiones' },
    { k: 'ctr', u: 'ctr', t: 'Contrato de dedicado', ayuda: 'Solo cuenta dedicados' }, { k: 'vgt', u: 'vgt', t: 'VGT' }, { k: 'otros', u: 'otros', t: 'Otros' }
  ];
  const FIJAS = { tipo: [['pyme', 'PYME'], ['dedicado', 'Dedicado corporativo'], ['isp', 'Dedicado ISP'], ['combinado', 'PYME + Dedicado']],
    ctr: [['sin_contrato', 'Sin contrato'], ['por_firmar', 'Por firmar'], ['por_actualizar', 'Por actualizar'], ['firmado_sin_archivo', 'Firmado sin archivo'], ['sin_vence', 'Sin vencimiento'], ['vence_60', 'Vence en 60 días']],
    vgt: [['con', 'Con VGT'], ['por_firmar', 'VGT por firmar'], ['incompletos', 'Faltan requisitos VGT']], otros: [['suspendidos', 'Suspendidos']] };
  const EST_GES = [['contactado', 'Contactado'], ['sin_contacto', 'Sin contacto'], ['esperando', 'Esperando'], ['cumplido', 'Cumplido'], ['resuelto', 'Resuelto']];
  let tarjeta = 'pyme'; let nTarjetas = null; let RES = null;
  const esDed = () => tarjeta === 'corporativo' || tarjeta === 'isp';
  const atajosDe = () => ATAJOS.filter((x) => !x.ded || esDed());
  // Al salir de las tarjetas de dedicados se suelta su atajo
  function soltarDed(){ if(esDed()) return; if(ATAJOS.some((x) => x.ded && x.id === filtro)) filtro = DEF; }
  function leerTarjeta(){ try { const v = localStorage.getItem(K_TARJETA); return TARJETAS.some((t) => t.id === v) ? v : 'pyme'; } catch (e) { return 'pyme'; } }
  function guardarTarjeta(){ if(tarjeta === 'todas') return; try { localStorage.setItem(K_TARJETA, tarjeta); } catch (e) {} }
  let yo = null; let rol = ''; let filtro = DEF; let q = ''; let sel = {}; let filas = []; let total = 0; let conteos = null; let facetas = null; let gestiones = [];
  // Lote 13/11 parte 6 (maqueta 06b): filtro de Fecha. de: entro, estatus, firmo, vence; queda en la dirección (fd, fde, fha)
  let fec = { de: '', desde: '', hasta: '' };
  const FEC_DE = [['entro', 'Entró a la app', 'Entró'], ['estatus', 'Cambió de estatus', 'Cambió de estatus'], ['firmo', 'Firmó el contrato', 'Firmó'], ['vence', 'Vence el contrato', 'Vence']];
  const FEC_CUANDO = [['mes', 'Este mes'], ['mes_pasado', 'Mes pasado'], ['d30', 'Últimos 30 días'], ['anio', 'Este año'], ['entre', 'Entre fechas']];
  const isoDia = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  function rangoDe(k){
    const h = new Date(); const y = h.getFullYear(); const m = h.getMonth();
    if(k === 'mes') return [isoDia(new Date(y, m, 1)), isoDia(new Date(y, m + 1, 0))];
    if(k === 'mes_pasado') return [isoDia(new Date(y, m - 1, 1)), isoDia(new Date(y, m, 0))];
    if(k === 'd30') return [isoDia(new Date(y, m, h.getDate() - 30)), isoDia(h)];
    if(k === 'anio') return [y + '-01-01', y + '-12-31'];
    return null;
  }
  const cuandoDe = (a, b) => (FEC_CUANDO.find((x) => { const r = rangoDe(x[0]); return r && r[0] === a && r[1] === b; }) || ['entre'])[0];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function fecTexto(){
    if(!fec.de) return 'Fecha: <b>cualquiera</b>';
    const k = cuandoDe(fec.desde, fec.hasta); const corto = (FEC_DE.find((x) => x[0] === fec.de) || [])[2] || 'Fecha';
    const dm = (s) => s ? s.slice(8, 10) + '/' + s.slice(5, 7) : '…';
    const v = k === 'mes' || k === 'mes_pasado' ? MESES[Number(fec.desde.slice(5, 7)) - 1] + ' ' + fec.desde.slice(0, 4) : k === 'entre' ? dm(fec.desde) + ' a ' + dm(fec.hasta) : (FEC_CUANDO.find((x) => x[0] === k) || [])[1].toLowerCase();
    return esc(corto) + ': <b>' + esc(v) + '</b>';
  }
  let pedido = 0; let reloj = null; let cargando = false; let marcado = 0;
  let desde = 0;                  // primera fila de la página que se ve
  let nSus = 0;   // suspendidos: fuera de la lista salvo con el filtro Otros: Suspendidos
  const verSus = () => (sel.otros || []).indexOf('suspendidos') >= 0;

  function leerUrl(){
    const u = new URLSearchParams(location.search);
    const f = u.get('f'); filtro = ATAJOS.some((x) => x.id === f) || Object.prototype.hasOwnProperty.call(EXTRA, f || '') ? f : DEF;
    q = (u.get('q') || '').slice(0, 60);
    sel = {}; GR.forEach((x) => { const v = u.get(x.u); if(v) sel[x.k] = v.split('|').map((y) => y.slice(0, 60)).slice(0, 20); });
    // Enlaces viejos: segmento, estatus, líder y VGT de una sola opción; suspendidos
    const viejo = { segmento: 'tipo', estatus: 'estatus', lider: 'lider', vgt: 'vgt' };
    Object.keys(viejo).forEach((k) => { const v = u.get(k); if(v && !sel[viejo[k]]) sel[viejo[k]] = [v.slice(0, 60)]; });
    if(u.get('sus') === '1') sel.otros = ['suspendidos'];
    const fd = u.get('fd'); const okF = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '';
    fec = FEC_DE.some((x) => x[0] === fd) ? { de: fd, desde: okF(u.get('fde')), hasta: okF(u.get('fha')) } : { de: '', desde: '', hasta: '' };
    if(!sel.tipo && u.get('tipo') === 'Combinado') sel.tipo = ['combinado'];
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
    GR.forEach((x) => { if((sel[x.k] || []).length) u.set(x.u, sel[x.k].join('|')); });
    if(fec.de){ u.set('fd', fec.de); if(fec.desde) u.set('fde', fec.desde); if(fec.hasta) u.set('fha', fec.hasta); }
    const s = u.toString();
    history.replaceState(history.state, '', location.pathname + (s ? '?' + s : ''));
  }
  const nSel = () => GR.reduce((a, x) => a + (sel[x.k] || []).length, 0);
  const clave = () => 'clientes5:' + tarjeta + ':' + filtro + ':' + q + ':' + JSON.stringify(sel) + (fec.de ? ':' + JSON.stringify(fec) : '');

  // Lote 05/11 F1: "+ Registrar dedicado nuevo" solo con la tarjeta de dedicados y para quien puede registrar (no Legal)
  const puedeRegistrar = () => !!yo && ['admin', 'analista', 'lider'].indexOf(yo.rol) >= 0;
  const esRif = (v) => /^[vejgpc]?[\s-]*\d{5,10}([\s-]*\d)?$/i.test(String(v || '').trim());
  function registrarDed(){ window.Gestion.registrarDedicado({ yo, tipo: esDed() ? tarjeta : '', rif: esRif(q) ? q : '', alCrear: (cid) => { refrescar(); abrirCliente(cid, { tab: 'documentos' }); } }); }
  function pintarTarjetas(){
    const bd = $('dedNuevo'); if(bd) bd.classList.toggle('hidden', !(esDed() && puedeRegistrar()));
    $('tarjetas').innerHTML = TARJETAS.map((t) => { const n = nTarjetas ? nTarjetas[t.id] : null; const on = t.id === tarjeta;
      return '<button type="button" class="tcli' + (on ? ' on' : '') + '" data-tarjeta="' + t.id + '" aria-pressed="' + on + '"><b>' + (n === null || n === undefined ? '<span class="sk" style="display:inline-block;width:42px;height:26px"></span>' : esc(n)) + '</b><span>' + esc(t.t) + (window.ClientesPanel && window.ClientesPanel.sub(t.id) ? '<small>' + esc(window.ClientesPanel.sub(t.id)) + '</small>' : '') + '</span></button>'; }).join('');
  }

  function pintarAtajos(){
    const lista = atajosDe();
    if(EXTRA[filtro]) lista.unshift({ id: filtro, t: EXTRA[filtro] });
    const n = nSel();
    $('filtros').innerHTML = '<button type="button" class="bfil" id="abrirFiltros">Filtros' + (n ? '<u>' + n + '</u>' : '') + '</button>' +
      '<button type="button" class="clf-dd' + (fec.de ? ' on' : '') + '" id="abrirFecha" aria-haspopup="dialog" aria-expanded="false">' + fecTexto() + ic('abajo') + '</button>' + lista.map((f) => {
      const c = conteos && conteos[f.id] !== undefined ? '<em>' + esc(conteos[f.id]) + '</em>' : '';
      return '<button type="button" data-filtro="' + f.id + '" class="' + (f.id === filtro && !q ? 'on' : '') + '" aria-pressed="' + (f.id === filtro && !q) + '">' + esc(f.t) + ' ' + c + '</button>';
    }).join('');
    pintarGestion(); pintarEstLegal();
  }
  // Lote 12/11 B, parte 7 (maqueta revision-nueva/img/20): una fila propia "Estatus legal" con los estatus de la app (mismo nombre y color),
  // contados con la tarjeta elegida. Un toque filtra y queda en la dirección. Para el administrador y Legal.
  function pintarEstLegal(){
    const z = $('estLegal'); if(!z) return;
    if(!yo || ['admin', 'abogado'].indexOf(yo.rol) < 0){ z.innerHTML = ''; return; }
    const fa = (facetas && facetas.estatus) || {}; const act = (sel.estatus || []).length === 1 ? sel.estatus[0] : (sel.estatus || []).length ? null : '';
    const tot = Object.keys(ESTATUS).reduce((a, e) => a + (Number(fa[e]) || 0), 0);
    const b = (v, t, n, c) => '<button type="button" class="est-p' + (act === v ? ' on' : '') + '" data-est-legal="' + esc(v) + '" aria-pressed="' + (act === v) + '">' + (c ? '<i class="pt ' + c + '" aria-hidden="true"></i>' : '') + esc(t) + ' <em>' + esc(n) + '</em></button>';
    z.innerHTML = '<p class="est-rot" id="rEstLegal">Estatus legal</p><div class="est-fila" role="group" aria-labelledby="rEstLegal">' + b('', 'Todos', facetas ? tot : '', '') +
      Object.keys(ESTATUS).map((e) => b(e, ESTATUS[e].t, facetas ? Number(fa[e]) || 0 : '', ESTATUS[e].c)).join('') + '</div>';
  }
  // Los filtros puestos, como chips con X
  function nombreOpcion(k, v){
    if(k === 'estatus') return (ESTATUS[v] || {}).t || v;
    if(k === 'gestion'){ const p = String(v).split(':'); const g = gestiones.find((x) => String(x.id) === p[0]); return (g ? g.nombre : 'Gestión') + (p[1] ? ': ' + ((EST_GES.find((e) => e[0] === p[1]) || [])[1] || p[1]) : ''); }
    const f = (FIJAS[k] || []).find((o) => o[0] === v); return f ? f[1] : v;
  }
  function pintarGestion(){
    const z = $('gestionCuentas'); if(!z) return;
    z.innerHTML = GR.map((g) => (sel[g.k] || []).map((v) => '<button type="button" class="gcu on fil-chip" data-quitar-fil="' + esc(g.k + '|' + v) + '" aria-label="Quitar ' + esc(nombreOpcion(g.k, v)) + '">' + esc(g.t + ': ' + nombreOpcion(g.k, v)) + ic('x') + '</button>').join('')).join('');
  }
  function opcionesDe(k){
    const fa = (facetas && facetas[k]) || {};
    if(k === 'estatus') return Object.keys(ESTATUS).map((e) => [e, ESTATUS[e].t, fa[e] || 0]);
    if(k === 'lider') return Object.keys(fa).concat((sel.lider || []).filter((v) => !fa[v])).sort((a, b) => a.localeCompare(b)).map((v) => [v, v, fa[v] || 0]);
    if(k === 'otros') return [['suspendidos', 'Suspendidos', Number(nSus) || 0]];
    if(k === 'gestion') return [].concat.apply([], gestiones.map((g) => [[String(g.id), g.nombre, fa[g.id] || 0, true]].concat(EST_GES.map((e) => [g.id + ':' + e[0], e[1], fa[g.id + ':' + e[0]] || 0, false, true]))));
    return (FIJAS[k] || []).map((o) => [o[0], o[1], fa[o[0]] || 0]);
  }
  function pintarSels(){
    const z = $('filGrupos'); if(!z) return;
    const abiertos = {}; z.querySelectorAll('details[data-g]').forEach((d) => { abiertos[d.dataset.g] = d.open; });
    z.innerHTML = GR.map((g) => {
      const ops = opcionesDe(g.k); const n = (sel[g.k] || []).length; const ab = abiertos[g.k] !== undefined ? abiertos[g.k] : n > 0;
      return '<details class="fil-g" data-g="' + g.k + '"' + (ab ? ' open' : '') + '><summary><b>' + esc(g.t) + '</b>' + (n ? '<u>' + n + '</u>' : '') + (g.ayuda ? '<small>' + esc(g.ayuda) + '</small>' : '') + ic('abajo') + '</summary>' +
        (ops.length ? ops.map((o) => '<label class="fil-op' + (o[4] ? ' sub' : '') + (o[3] ? ' tit' : '') + '"><input type="checkbox" data-fil="' + esc(g.k + '|' + o[0]) + '"' + ((sel[g.k] || []).indexOf(o[0]) >= 0 ? ' checked' : '') + '><span>' + esc(o[1]) + '</span><em>' + esc(o[2]) + '</em></label>').join('')
          : '<p class="nota-chica">' + (g.k === 'gestion' ? 'No hay gestiones activas.' : 'Sin opciones.') + '</p>') + '</details>';
    }).join('');
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
    const ges = (c.ges || []).map((x) => { const p = String(x).split(':'); const gg = gestiones.find((y) => String(y.id) === p[0]); return gg ? '<span class="tagn gest-' + esc(p[1] === 'cumplido' || p[1] === 'resuelto' ? 'contactado' : p[1]) + '">' + esc(gg.nombre + ': ' + ((EST_GES.find((e) => e[0] === p[1]) || [])[1] || p[1])) + '</span>' : ''; }).join('');
    const tags = (c.suspendido ? '<span class="tagn rojo">Suspendido</span>' : '') + (c.sin_tad ? '<span class="tagn azul">Aún no está en el TAD</span>' : '') + (c.no_aparece_tad ? '<span class="tagn ambar">No aparece en el TAD</span>' : '') + ges + (g ? '<span class="tagn gest-' + esc(g.e) + '">' + esc(GESTION[g.e]) + (g.fecha ? ' ' + esc(String(g.fecha).slice(8, 10) + '/' + String(g.fecha).slice(5, 7)) : '') + '</span>' : '') +
      (c.combinado ? '<span class="tagn azul">PYME + Dedicado' + (c.ded === 'isp' ? ' ISP' : '') + '</span>' : '') + (c.vgt ? '<span class="tagn azul">VGT</span>' : '') + polizaTag(c.poliza_vence) +
      (c.ctr === 'sin_archivo' ? '<span class="tagn ambar">Firmado: falta subir contrato</span>' : c.ctr === 'sin_vence' ? '<span class="tagn ambar">Falta vencimiento</span>' : '');
    return '<div class="cli-w"><button type="button" class="cli' + (marcado === c.id ? ' sel' : '') + '" data-cliente="' + esc(c.id) + '">' +
      '<span class="quien"><span class="mono" aria-hidden="true">' + esc(iniciales(c.nombre).charAt(0)) + '</span><span><b>' + esc(c.nombre) + '</b><small>' + tags + (c.por_subir ? '<span class="tagn ambar">' + (c.aprobado_por_subir ? 'Aprobado, documentos por subir' : 'Archivos por subir') + '</span>' : '') + esc(sub) + '</small></span></span>' +
      '<span class="c2">' + esc(c.lider || 'Sin líder') + '</span><span class="c3">' + chipEstatus(c.estatus) + '</span>' +
      '<span class="sig ' + sig[0] + '">' + (c.ultimo_corte ? 'Último corte. ' : '') + esc(sig[1]) + '</span>' + ic('derecha', 'ch fl') + '</button>' +
      '<button type="button" class="cli-etq" data-etiquetar="' + esc(c.id) + '" aria-label="Etiqueta de gestión de ' + esc(c.nombre) + '">' + ic('etiqueta') + '</button></div>';
  }
  function pintarLista(){
    const n = nSel() + (fec.de ? 1 : 0);
    const T = TARJETAS.find((t) => t.id === tarjeta);
    $('cuentaLista').innerHTML = (q ? plural(total, 'resultado', 'resultados') + ' en todos los clientes' : (verSus() ? plural(total, 'cliente suspendido', 'clientes suspendidos') : plural(total, 'cliente', 'clientes')) + (T ? ' en ' + T.t : ' en todas las tarjetas')) + (n ? '<button type="button" class="enlace" id="quitarFiltros">Quitar filtros</button>' : '');
    if(!filas.length){
      $('enc').classList.add('hidden');
      $('lista').innerHTML = q ? vacio('No encontramos nada con "' + q + '"', 'Prueba con otra parte del nombre, el RIF sin guiones o el código del servicio.' + (esRif(q) && puedeRegistrar() ? ' Si es un dedicado nuevo, regístralo.' : ''),
          esRif(q) && puedeRegistrar() ? '<button type="button" class="btn btn-chico btn-2" data-ded-nuevo="1">' + ic('mas') + 'Registrar dedicado nuevo</button>' : '')
        : n ? vacio('Ningún cliente con esos filtros', 'Quita alguno para ver más.', '<button type="button" class="btn btn-chico btn-2" id="quitarFiltros2">Quitar filtros</button>')
        : T && conteosTodas() ? vacio('Nada aquí en ' + T.t, 'Hay clientes en este grupo en otras tarjetas.', '<button type="button" class="btn btn-chico btn-2" data-tarjeta-todas="1">Ver en todas</button>')
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
  const conteosTodas = () => !!nTarjetas && (nTarjetas.pyme + nTarjetas.corporativo + nTarjetas.isp) > 0 && filtro !== 'todos' && !verSus();
  function esqueletos(){ let h = ''; for(let i = 0; i < 6; i++) h += '<div class="sk-cli" aria-hidden="true"><span class="sk" style="width:40px;height:40px;border-radius:12px"></span><span class="sk-tx"><span class="sk" style="width:' + (45 + i * 7) + '%;height:14px"></span><span class="sk" style="width:' + (30 + i * 5) + '%;height:11px"></span></span></div>'; return h; }

  async function pedirLista(de, limite, fecF){
    return rpc('clientes_lista3', { p_filtro: filtro === 'revisar_fecha' ? DEF : filtro, p_busca: q, p_limite: limite, p_desde: de, p_f: Object.assign({}, sel, filtro === 'revisar_fecha' ? { ctr: ['sin_vence'] } : {}, fecF || (fec.de ? { fecha: fec } : {}), { tarjeta: tarjeta === 'todas' ? '' : tarjeta }) });
  }
  function recibir(d){
    filas = d.filas || [];
    total = d.total || 0; conteos = d.conteos || null; facetas = d.facetas || facetas; nTarjetas = d.tarjetas || nTarjetas; gestiones = d.gestiones || gestiones;
    nSus = d.suspendidos !== undefined ? d.suspendidos : nSus;
  }
  // pag: número de la primera fila a pedir (las flechas); sin él vuelve a la primera página
  async function cargar(pag){
    const mio = ++pedido; cargando = true; const otra = typeof pag === 'number';
    desde = otra ? Math.max(0, pag) : 0;
    if(!otra){
      const g = cache.leer(clave());
      if(g && g.rol === rol){ filas = g.filas; total = g.total; conteos = g.conteos; facetas = g.facetas || facetas; nTarjetas = g.tarjetas || nTarjetas; gestiones = g.gestiones || gestiones; nSus = g.nSus || nSus; pintarTarjetas(); pintarAtajos(); pintarSels(); pintarLista(); }
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
      if(!otra) cache.guardar(clave(), { filas, total, conteos, facetas, rol, tarjetas: nTarjetas, gestiones, nSus });
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
      if(!desde) cache.guardar(clave(), { filas, total, conteos, facetas, rol, tarjetas: nTarjetas, gestiones, nSus });
      pintarTarjetas(); pintarAtajos(); pintarSels(); pintarLista();
    } catch (e) {}
  }
  function abrirCliente(id, o){
    marcado = id; Array.prototype.forEach.call(document.querySelectorAll('.cli'), (x) => x.classList.toggle('sel', Number(x.dataset.cliente) === id));
    window.Ficha.abrir(id, Object.assign({ yo, alCerrar: refrescar }, o || {}));
  }
  // El desplegable de Fecha: Fecha de, Cuándo, Desde y Hasta; "Ver N clientes" cuenta con el servidor antes de aplicar
  let FD = null; let fdReloj = null; let fdPed = 0;
  function abrirFecha(){
    const k = fec.de ? cuandoDe(fec.desde, fec.hasta) : '';
    FD = { de: fec.de || 'entro', cuando: k, desde: fec.desde, hasta: fec.hasta, n: null };
    let z = $('clfPop'); if(!z){ z = document.createElement('div'); z.id = 'clfPop'; z.className = 'clf-pop'; z.setAttribute('role', 'dialog'); z.setAttribute('aria-label', 'Filtrar por fecha'); document.body.appendChild(z); }
    z.classList.add('ver'); pintarFecha(); const b = $('abrirFecha'); if(b) b.setAttribute('aria-expanded', 'true'); ubicarFecha(); contarFecha();
  }
  function ubicarFecha(){
    const z = $('clfPop'); const b = $('abrirFecha'); if(!z || !b) return;
    if(!window.matchMedia('(min-width:900px)').matches){ z.style.left = ''; z.style.top = ''; return; }
    const r = b.getBoundingClientRect(); z.style.left = Math.max(16, Math.min(r.left - 6, window.innerWidth - 396)) + 'px';
    // Debajo del botón; si no cabe, sube lo justo para verse entero
    z.style.top = Math.max(12, Math.min(r.bottom + 8, window.innerHeight - z.offsetHeight - 12)) + 'px';
  }
  function cerrarFecha(){ const z = $('clfPop'); if(z) z.classList.remove('ver'); FD = null; const b = $('abrirFecha'); if(b) b.setAttribute('aria-expanded', 'false'); }
  function pintarFecha(){
    const z = $('clfPop'); if(!z || !FD) return;
    setTimeout(ubicarFecha, 0);
    const op = (attr, k, tx, on) => '<button type="button" class="' + (on ? 'on' : '') + '" ' + attr + '="' + k + '" aria-pressed="' + on + '">' + esc(tx) + '</button>';
    const listo = FD.desde || FD.hasta;
    z.innerHTML = '<span class="lbl" id="clfDe">Fecha de</span><div class="ops" role="group" aria-labelledby="clfDe">' + FEC_DE.map((x) => op('data-fd', x[0], x[1], FD.de === x[0])).join('') + '</div>' +
      '<span class="lbl" id="clfCu">Cuándo</span><div class="ops" role="group" aria-labelledby="clfCu">' + FEC_CUANDO.map((x) => op('data-fc', x[0], x[1], FD.cuando === x[0])).join('') + '</div>' +
      '<div class="dos"><div><label for="clfDesde">Desde</label><input class="campo" type="date" id="clfDesde" value="' + esc(FD.desde || '') + '"></div><div><label for="clfHasta">Hasta</label><input class="campo" type="date" id="clfHasta" value="' + esc(FD.hasta || '') + '"></div></div>' +
      '<div class="error" id="clfErr" role="alert"></div>' +
      '<div class="acc"><button type="button" class="hc-b s ch" data-fq="1">Quitar</button><button type="button" class="hc-b ch" data-fv="1"' + (listo ? '' : ' disabled') + '>' + (FD.n === null ? 'Ver clientes' : 'Ver ' + plural(FD.n, 'cliente', 'clientes')) + '</button></div>';
  }
  function contarFecha(){
    clearTimeout(fdReloj); if(!FD || !(FD.desde || FD.hasta)) return;
    if(FD.desde && FD.hasta && FD.desde > FD.hasta){ $('clfErr').textContent = 'Desde va antes que Hasta'; return; }
    const mio = ++fdPed;
    fdReloj = setTimeout(async () => {
      try { const d = await pedirLista(0, 1, { fecha: { de: FD.de, desde: FD.desde, hasta: FD.hasta } }); if(mio !== fdPed || !FD) return; FD.n = d.total || 0; const b = document.querySelector('#clfPop [data-fv]'); if(b) b.textContent = 'Ver ' + plural(FD.n, 'cliente', 'clientes'); }
      catch (e) { if(mio === fdPed && $('clfErr')) $('clfErr').textContent = e.message; }
    }, 250);
  }
  function aplicarFecha(quitar){
    if(!quitar && FD && FD.desde && FD.hasta && FD.desde > FD.hasta){ $('clfErr').textContent = 'Desde va antes que Hasta'; return; }
    fec = quitar || !FD ? { de: '', desde: '', hasta: '' } : { de: FD.de, desde: FD.desde || '', hasta: FD.hasta || '' };
    cerrarFecha(); guardarUrl(); pintarAtajos(); cargar();
  }
  document.addEventListener('click', (e) => {
    const t = e.target; let b; const z = $('clfPop');
    if(t.closest('#abrirFecha')){ if(z && z.classList.contains('ver')) cerrarFecha(); else abrirFecha(); return; }
    if(!z || !z.classList.contains('ver') || !FD) return;
    if(!t.closest('#clfPop')){ cerrarFecha(); return; }
    if((b = t.closest('[data-fd]'))){ FD.de = b.dataset.fd; FD.n = null; pintarFecha(); contarFecha(); return; }
    if((b = t.closest('[data-fc]'))){ FD.cuando = b.dataset.fc; const r = rangoDe(FD.cuando); if(r){ FD.desde = r[0]; FD.hasta = r[1]; } FD.n = null; pintarFecha(); if(FD.cuando === 'entre') $('clfDesde').focus(); contarFecha(); return; }
    if(t.closest('[data-fq]')){ aplicarFecha(true); return; }
    if(t.closest('[data-fv]')){ aplicarFecha(false); return; }
  });
  document.addEventListener('change', (e) => {
    if(!FD || !e.target.closest('#clfPop')) return;
    if(e.target.id === 'clfDesde') FD.desde = e.target.value; if(e.target.id === 'clfHasta') FD.hasta = e.target.value;
    FD.cuando = cuandoDe(FD.desde, FD.hasta); FD.n = null; pintarFecha(); contarFecha();
  });
  document.addEventListener('keydown', (e) => { if(e.key === 'Escape' && FD){ cerrarFecha(); const b = $('abrirFecha'); if(b) b.focus(); } });
  window.addEventListener('resize', () => { if(FD) ubicarFecha(); });
  function limpiar(){ sel = {}; fec = { de: '', desde: '', hasta: '' }; cerrarFecha(); guardarUrl(); pintarSels(); pintarAtajos(); cargar(); }

  document.addEventListener('click', (e) => {
    const t = e.target; let b;
    if((b = t.closest('#tarjetas [data-tarjeta]'))){
      if(b.dataset.tarjeta === tarjeta && !q) return;
      tarjeta = b.dataset.tarjeta; guardarTarjeta(); soltarDed(); if(RES) RES.cambiarModulo();
      q = ''; $('busca').value = ''; guardarUrl(); pintarTarjetas(); pintarAtajos(); pintarSels(); cargar(); if(window.ClientesPanel) window.ClientesPanel.pintar(); return;
    }
    if(t.closest('#lista [data-tarjeta-todas]')){ tarjeta = 'todas'; soltarDed(); guardarUrl(); pintarTarjetas(); pintarSels(); cargar(); return; }
    if((b = t.closest('#filtros [data-filtro], #lista [data-filtro]'))){ filtro = b.dataset.filtro; q = ''; $('busca').value = ''; guardarUrl(); pintarAtajos(); cargar(); return; }
    if(t.closest('[data-ded-nuevo]')){ registrarDed(); return; }
    if(t.closest('#abrirFiltros')){ abrirHoja('hojaFiltros'); return; }
    if(t.closest('#quitarFiltros') || t.closest('#quitarFiltros2') || t.closest('#limpiarFiltros')){ limpiar(); return; }
    if(t.closest('#pagAnt')){ cargar(Math.max(0, desde - POR_PAGINA)); return; }
    if(t.closest('#pagSig')){ cargar(desde + POR_PAGINA); return; }
    if((b = t.closest('[data-est-legal]'))){ const v = b.dataset.estLegal; if(v) sel.estatus = [v]; else delete sel.estatus; guardarUrl(); pintarAtajos(); pintarSels(); cargar(); return; }
    if((b = t.closest('[data-quitar-fil]'))){ const p = b.dataset.quitarFil.split('|'); sel[p[0]] = (sel[p[0]] || []).filter((v) => v !== p.slice(1).join('|')); if(!sel[p[0]].length) delete sel[p[0]]; guardarUrl(); pintarAtajos(); pintarSels(); cargar(); return; }
    if((b = t.closest('[data-etiquetar]'))){ window.Gestion.etiquetar(Number(b.dataset.etiquetar), refrescar, (filas.find((x) => x.id === Number(b.dataset.etiquetar)) || {}).etq); return; }
    if(t.closest('#lista #reintentar')){ cargar(); return; }
    if((b = t.closest('.cli[data-cliente]'))) abrirCliente(Number(b.dataset.cliente));
  });
  document.addEventListener('change', (e) => {
    const x = e.target.closest('[data-fil]'); if(!x) return;
    const p = x.dataset.fil.split('|'); const k = p[0]; const v = p.slice(1).join('|'); const l = (sel[k] || []).filter((y) => y !== v);
    if(x.checked) l.push(v); if(l.length) sel[k] = l; else delete sel[k];
    guardarUrl(); pintarAtajos(); cargar();
  });
  $('formBusca').addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(reloj); buscar(); $('busca').blur(); });
  $('busca').addEventListener('input', () => { clearTimeout(reloj); reloj = setTimeout(buscar, 380); });
  function buscar(){ const v = $('busca').value.trim(); if(v === q) return; q = v; guardarUrl(); pintarAtajos(); cargar(); if(window.ClientesPanel) window.ClientesPanel.buscar(q); }
  // Lote 28/10: el panel de arriba filtra la lista (estatus legal, atajos de dedicados, gestiones)
  function aplicar(o){
    if(o.tarjeta){ tarjeta = o.tarjeta; soltarDed(); }
    if(o.sel){ sel = Object.assign({}, o.sel); }
    filtro = o.filtro || DEF; q = ''; $('busca').value = '';
    guardarUrl(); pintarTarjetas(); pintarAtajos(); pintarSels(); cargar();
    const z = $('cuentaLista'); if(z && z.scrollIntoView) z.scrollIntoView({ block: 'start', behavior: 'auto' });
  }
  $('hojaFiltros').addEventListener('hoja-cerrada', () => setTimeout(guardarUrl, 60));
  document.addEventListener('visibilitychange', () => { if(!document.hidden && yo && filas.length && !window.Comun.hojaAbierta()) refrescar(); });

  window.Armazon.arrancar(['admin', 'abogado', 'lider', 'analista'], { activo: 'clientes' }, (p) => {
    yo = p; rol = yo.rol;
    window.Ficha.montar(); window.Ficha.alContactarFuera(refrescar);
    // Lote 27/10: Lista | Resumen. Con las tarjetas de dedicados, el Resumen es el de Dedicados
    const u = leerUrl();
    if(window.Resumen) RES = window.Resumen.enModulo({ modulo: () => esDed() ? 'dedicados' : 'clientes', yo: p, crear: window.CliResumen ? window.CliResumen.crear : undefined }); $('busca').value = q; guardarTarjeta(); pintarTarjetas(); pintarAtajos(); pintarSels();
    if(window.ClientesPanel) window.ClientesPanel.montar({ yo: p, tarjeta: () => tarjeta, busca: () => q, aplicar, alCambiar: pintarTarjetas });
    cargar();
    // Enlace directo a un expediente (desde Inicio o un aviso)
    if(u.c){ guardarUrl(); abrirCliente(u.c, { tab: u.t, revisar: u.revisar, pedir: u.pedir }); }
    // Desde Inicio: la lista de bienvenidas por enviar
    else if(new URLSearchParams(location.search).get('bienvenidas')){ try { history.replaceState(history.state, '', location.pathname); } catch (e) {} window.Bienvenidas.abrir({ yo, alCerrar: refrescar }); }
  }, (p) => { yo = p; });
})();
