// Factibilidad: dice si una ubicación tiene red con el mapa de ingeniería. Cada consulta se guarda sola y se revisa con cada mapa nuevo.
(function(){
  'use strict';
  const { $, esc, ic, rpc, toast, cache, esqueleto, vacio, fecha, plural, primerNombre, abrirHoja, cerrarHoja, hojaAbierta, prepararHojas } = window.Comun;
  const S = window.Sesion; const CO = window.Coordenadas;
  const EST = {
    hay_red: { c: 'verde', t: 'Hay red', f: 'Se puede vender. La zona tiene red activa.' },
    excepcion: { c: 'ambar', t: 'Posible excepción', f: 'Está muy cerca de la red, pero fuera. Confirma con ingeniería antes de vender.' },
    espera: { c: 'azul', t: 'En espera', f: 'Todavía no hay red aquí. Queda en seguimiento: te avisamos si un mapa nuevo trae red.' },
    sin_red: { c: 'rojo', t: 'Sin red', f: 'No hay red cerca. Queda guardada por si la red llega más adelante.' }
  };
  const CLIENTE = {
    hay_red: 'Buenas noticias: su ubicación tiene cobertura de nuestra red. Le preparo la propuesta para instalar.',
    excepcion: 'Su ubicación está muy cerca de nuestra red. Lo confirmo con ingeniería y le aviso apenas tenga respuesta.',
    espera: 'Por ahora su ubicación no tiene cobertura. La dejamos registrada y le avisamos apenas llegue la red a su zona.',
    sin_red: 'Por ahora no tenemos cobertura en su ubicación. La dejamos registrada por si la red llega más adelante.'
  };
  const ATAJOS = [['con_red', 'Ahora con red'], ['abiertas', 'Abiertas'], ['espera', 'En espera'], ['excepcion', 'Excepción'], ['cerradas', 'Cerradas']];
  const COLOR = { red: '#3B78E7', excl: '#0091B8', dis: '#C9A400' };
  const PAGINA = 30;
  let yo = null; let filtro = 'abiertas'; let L = null; let pedido = 0;
  let C = null;   // consulta abierta en la hoja
  let F = { texto: '', tipo: 'pyme', error: '', copiado: '' };   // formulario
  let mapas = {};   // mapas de Leaflet vivos
  const VER = ((document.currentScript && /[?&]v=(\d+)/.exec(document.currentScript.src)) || [])[1] || '1';

  const km = (m) => m === null || m === undefined ? '' : m < 1000 ? Math.round(m) + ' m' : (Math.round(m / 100) / 10).toLocaleString('es-VE') + ' km';
  const grupo = (z) => z.operativa ? (z.exclusividad === 'aliado' ? 'excl' : 'red') : 'dis';
  function lugar(d){ return (d.ciudad ? d.ciudad + ' · ' : '') + Number(d.lat).toFixed(5) + ', ' + Number(d.lng).toFixed(5); }
  function zonaTexto(d){
    if(!d.mdt) return 'Sin MDT a menos de 2 km';
    const dist = d.resultado === 'hay_red' ? 'dentro de la zona' : d.distancia_m !== null && d.distancia_m !== undefined ? km(d.distancia_m) + ' del borde' : '';
    return 'MDT ' + d.mdt + (dist ? ' · ' + dist : '') + (d.capacidad ? ' · ' + d.capacidad.toLocaleString('es-VE') + ' hogares' : '');
  }
  function chip(r, seg){
    if(seg === 'vendida') return '<span class="chip punto">Vendida</span>';
    if(seg === 'no_interesa') return '<span class="chip punto">Cerrada</span>';
    const e = EST[r] || EST.sin_red; return '<span class="chip punto ' + e.c + '">' + esc(e.t) + '</span>';
  }
  function haceCuanto(t){
    const d = Math.floor((Date.now() - new Date(t).getTime()) / 86400000);
    return d <= 0 ? 'hoy' : d === 1 ? 'ayer' : d < 7 ? 'hace ' + d + ' días' : d < 30 ? 'hace ' + plural(Math.floor(d / 7), 'semana', 'semanas') : fecha(t);
  }

  // ---------- Lista ----------
  let lista = null;   // { filas, total, conteos, mapa }
  function pintarLista(){
    const d = lista; if(!d) return;
    const n = d.conteos || {};
    $('faAviso').innerHTML = n.con_red ? '<div class="fa-cambio" role="status"><div class="tx"><b>' + esc(plural(n.con_red, 'consulta ahora tiene red', 'consultas ahora tienen red')) + '</b>' +
      (d.mapa ? 'Llegó el mapa del ' + esc(fecha(d.mapa.fecha)) + '. ' : '') + 'Llama al cliente.</div><button type="button" class="btn btn-chico fa-ver" data-filtro="con_red">Ver</button></div>' : '';
    $('faAtajos').innerHTML = ATAJOS.filter((a) => a[0] !== 'con_red' || n.con_red || filtro === 'con_red').map((a) => '<button type="button" role="tab" aria-selected="' + (a[0] === filtro) + '" class="' + (a[0] === 'con_red' ? 'nv' : '') + (a[0] === filtro ? ' on' : '') + '" data-filtro="' + a[0] + '">' + esc(a[1]) + ' <em>' + esc(n[a[0]] || 0) + '</em></button>').join('');
    $('faFecha').innerHTML = d.mapa ? 'Mapa de red del <b>' + esc(fecha(d.mapa.fecha)) + '</b>. ' + esc(Number(d.mapa.zonas || 0).toLocaleString('es-VE')) + ' zonas.'
      : 'Todavía no hay mapa de red. ' + (yo.rol === 'admin' ? 'Súbelo en <a class="enlace" href="actualizar.html">Actualizar</a>.' : 'Pídele al administrador que lo suba.');
    if(!d.filas.length){
      $('faLista').innerHTML = vacio(filtro === 'abiertas' ? 'Todavía no hay consultas' : 'Nada por aquí', filtro === 'abiertas' ? 'Toca Nueva consulta y pega el enlace de la ubicación que te mandó el cliente.' : 'Prueba con otro atajo.');
      return;
    }
    $('faLista').innerHTML = '<div class="fa-lista">' + d.filas.map((p) => {
      const nombre = p.nombre || 'Sin nombre';
      const zona = p.resultado === 'hay_red' ? (p.mdt ? 'MDT ' + p.mdt + ' · dentro de la zona' : 'Dentro de la zona') : p.mdt ? 'MDT ' + p.mdt + (p.distancia_m !== null ? ' · ' + km(p.distancia_m) + ' de la red' : '') : 'Sin red a 2 km';
      return '<button type="button" class="fa-pro" data-consulta="' + esc(p.id) + '"><span><b>' + (p.nuevo ? '<em class="fa-nuevo">NUEVO</em>' : '') + '<span>' + esc(nombre) + '</span></b>' +
        '<small>' + esc((p.ciudad ? p.ciudad + ' · ' : '') + haceCuanto(p.creada_en) + (p.lider ? ' · ' + p.lider : '')) + '</small></span>' +
        '<span class="c2">' + (p.anterior && p.nuevo ? '<s>' + esc((EST[p.anterior] || {}).t || '') + '</s> · ' : '') + esc(zona) + (p.exclusividad === 'aliado' && p.aliado ? ' · Exclusiva de ' + esc(p.aliado) : '') + '</span>' +
        chip(p.resultado, p.seguimiento) + '</button>';
    }).join('') + '</div>' + (d.filas.length < d.total ? '<button type="button" class="btn btn-2 btn-chico fa-mas" id="faMas">Ver ' + Math.min(PAGINA, d.total - d.filas.length) + ' más</button>' : '');
  }
  async function cargar(mas){
    const mio = ++pedido; const clave = 'fact:' + filtro;
    if(!mas){
      const g = cache.leer(clave);
      if(g && g.rol === yo.rol){ lista = g; pintarLista(); }
      else { lista = null; $('faLista').innerHTML = esqueleto(4); }
    }
    try {
      const r = await rpc('fact_lista', { p_filtro: filtro, p_desde: mas && lista ? lista.filas.length : 0, p_limite: PAGINA });
      if(mio !== pedido) return;
      if(mas && lista){ lista.filas = lista.filas.concat(r.filas || []); lista.total = r.total; lista.conteos = r.conteos; }
      else { lista = Object.assign({ filas: [] }, r); lista.filas = r.filas || []; cache.guardar(clave, lista); }
      pintarLista();
    } catch (e) {
      if(mio !== pedido) return;
      if(!lista) $('faLista').innerHTML = '<div class="vacio" role="alert"><b>No se pudieron cargar las consultas</b><p>' + esc(e.message) + '</p><button type="button" class="btn btn-chico" id="faReintentar">Reintentar</button></div>';
      toast(e.message, 'error');
    }
  }
  function ponerFiltro(f){
    filtro = ATAJOS.some((a) => a[0] === f) ? f : 'abiertas';
    try { const u = new URL(location.href); if(filtro === 'abiertas') u.searchParams.delete('f'); else u.searchParams.set('f', filtro); history.replaceState(history.state, '', u.toString()); } catch (e) {}
    cargar();
  }

  // ---------- Hojas ----------
  function montarHojas(){
    if($('hojaFact')) return;
    const h = document.createElement('section'); h.id = 'hojaFact'; h.className = 'hoja completa lado angosta';
    h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true'); h.setAttribute('aria-labelledby', 'tFact'); h.setAttribute('aria-hidden', 'true');
    h.innerHTML = '<div class="hoja-cab"><div class="tx"><b id="tFact">Nueva consulta</b><small id="sFact"></small></div><button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div>' +
      '<div class="hoja-cuerpo" id="cFact"></div><div class="hoja-pie" id="pFact"></div>';
    const m = document.createElement('section'); m.id = 'hojaMapa'; m.className = 'hoja completa lado';
    m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-labelledby', 'tMapa'); m.setAttribute('aria-hidden', 'true');
    m.innerHTML = '<div class="hoja-cab"><button type="button" class="cerrar" data-cierra="1" aria-label="Volver al resultado">' + ic('volver') + '</button><div class="tx"><b id="tMapa">Mapa amplio</b><small id="sMapa"></small></div><button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div>' +
      '<div class="hoja-cuerpo" id="cMapa"></div>';
    document.body.appendChild(h); document.body.appendChild(m); prepararHojas();
    h.addEventListener('hoja-cerrada', () => { C = null; soltarMapa('chico'); });
    m.addEventListener('hoja-cerrada', () => { soltarMapa('grande'); });
  }
  function soltarMapa(k){ if(mapas[k]){ try { mapas[k].stop(); mapas[k].off(); mapas[k].remove(); } catch (e) {} delete mapas[k]; } }

  // ---------- Formulario ----------
  const esTel = () => window.matchMedia('(max-width:899px)').matches;
  function formulario(o){
    montarHojas(); soltarMapa('chico'); C = null;
    F = Object.assign({ texto: '', tipo: F.tipo || 'pyme', error: '', copiado: '' }, o || {});
    $('tFact').textContent = 'Nueva consulta'; $('sFact').textContent = 'Pega el enlace, escribe las coordenadas o usa tu ubicación';
    $('cFact').innerHTML = (F.copiado ? '<div class="fa-copiado"><b>Tienes un enlace copiado</b>Toca Pegar y se consulta solo.</div>' : '') +
      '<label class="rotulo arriba" for="faEnlace">Enlace de Google Maps o coordenadas</label>' +
      '<div class="fa-campo-fila"><input class="campo" id="faEnlace" type="text" inputmode="url" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="600" value="' + esc(F.texto) + '"' + (F.error ? ' aria-invalid="true"' : '') + ' aria-describedby="faAyuda eEnlace">' +
      '<button type="button" class="fa-pegar" id="faPegar">Pegar</button></div>' +
      '<div class="error" id="eEnlace" role="alert">' + esc(F.error) + '</div><p class="nota" id="faAyuda">Ejemplos: https://maps.app.goo.gl/… o 10.0601, -72.5524</p>' +
      (esTel() ? '<div class="fa-otra"><button type="button" class="btn btn-2 btn-chico" id="faUbic">' + ic('wifi') + 'Usar mi ubicación</button></div>' : '') +
      '<span class="rotulo arriba" id="rTipo">Tipo de cliente</span><div class="fa-tipo" role="radiogroup" aria-labelledby="rTipo">' +
      [['pyme', 'PYME'], ['dedicado', 'Dedicado']].map((t) => '<button type="button" role="radio" aria-checked="' + (F.tipo === t[0]) + '" data-tipo="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>';
    $('pFact').innerHTML = '<button type="button" class="btn" id="faConsultar">Consultar</button>';
    if(hojaAbierta() !== 'hojaFact') abrirHoja('hojaFact');
  }
  function errorCampo(t){ F.error = t; const e = $('eEnlace'); const i = $('faEnlace'); if(e) e.textContent = t; if(i){ i.setAttribute('aria-invalid', t ? 'true' : 'false'); if(t) i.focus(); } }
  async function resolverCorto(url){
    let tk = '';
    try { const s = await db.auth.getSession(); tk = (s.data && s.data.session && s.data.session.access_token) || ''; } catch (e) {}
    if(!tk) throw new Error('Tu sesión venció. Entra de nuevo');
    let r;
    try { r = await fetch(db.supabaseUrl + '/functions/v1/resolver_enlace', { method: 'POST', headers: { Authorization: 'Bearer ' + tk, apikey: db.supabaseKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) }); }
    catch (e) { throw new Error('Sin conexión. Revisa el internet'); }
    let j = {}; try { j = await r.json(); } catch (e) {}
    const p = r.ok && j.url ? CO.desdeUrl(j.url) : null;
    if(!p) throw new Error('No pude abrir ese enlace corto. Abre el enlace en Google Maps, copia las coordenadas y pégalas aquí');
    return p;
  }
  async function consultar(){
    if(!$('faEnlace')) return;
    F.texto = $('faEnlace').value.trim(); errorCampo('');
    const r = CO.leer(F.texto);
    if(r.error){ errorCampo(r.error); return; }
    const b = $('faConsultar'); if(b){ b.disabled = true; b.textContent = 'Consultando…'; }
    $('tFact').textContent = 'Consultando'; $('sFact').textContent = F.texto.slice(0, 80);
    $('cFact').innerHTML = '<div class="sk" style="height:96px;border-radius:18px"></div><div class="sk" style="height:230px;border-radius:18px;margin-top:10px"></div><div class="sk" style="height:54px;border-radius:14px;margin-top:10px"></div><p class="nota" style="margin-top:10px">' + (r.corto ? 'Leyendo el enlace y buscando' : 'Buscando') + ' los MDT cercanos…</p>';
    $('pFact').innerHTML = '';
    let p = r;
    try {
      if(r.corto) p = await resolverCorto(r.corto);
      const d = await rpc('fact_consultar', { p_lat: p.lat, p_lng: p.lng, p_tipo: F.tipo, p_enlace: /^https?:/i.test(F.texto) ? F.texto : null });
      cache.borrarTodo(); resultado(d); cargar();
    } catch (e) {
      if(hojaAbierta() !== 'hojaFact') return;
      formulario({ texto: F.texto, tipo: F.tipo }); errorCampo(e.message);
    }
  }

  // ---------- Resultado ----------
  async function abrirConsulta(id){
    montarHojas(); soltarMapa('chico');
    $('tFact').textContent = 'Consulta'; $('sFact').textContent = '';
    $('cFact').innerHTML = '<div class="sk" style="height:96px;border-radius:18px"></div><div class="sk" style="height:230px;border-radius:18px;margin-top:10px"></div>';
    $('pFact').innerHTML = ''; C = { id: Number(id) };
    if(hojaAbierta() !== 'hojaFact') abrirHoja('hojaFact');
    try {
      const d = await rpc('fact_detalle', { p_id: Number(id) });
      if(!C || C.id !== Number(id)) return;
      resultado(d);
      if(d.mio && d.visto === false) rpc('fact_visto', { p_id: d.id }).then(() => { cache.borrarTodo(); cargar(); }).catch(() => {});
    } catch (e) {
      if(!C || C.id !== Number(id)) return;
      $('cFact').innerHTML = '<div class="vacio" role="alert"><b>No se pudo abrir la consulta</b><p>' + esc(e.message) + '</p><button type="button" class="btn btn-chico" data-consulta="' + esc(id) + '">Reintentar</button></div>';
    }
  }
  function textoOdoo(d, nombre, rif){
    const n = String(nombre || '').trim().toUpperCase() || 'NOMBRE DEL CLIENTE';
    const r = String(rif || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const doc = r ? (/^\d/.test(r) ? 'J' + r : r) : 'J000000000';
    return (d.tipo === 'dedicado' ? 'INST. DEDICADO ' : 'INST. PROMO PYME ') + n + ' ' + doc;
  }
  function resultado(d){
    C = { id: d.id, d, cercanas: null, plegado: { datos: !!(d.nombre || d.telefono || d.rif), odoo: false } };
    const e = EST[d.resultado] || EST.sin_red; const abierta = d.seguimiento === 'abierta';
    $('tFact').textContent = d.nombre || 'Consulta'; $('sFact').textContent = lugar(d);
    const rif = d.rif ? (d.rif_tipo || 'J') + d.rif : '';
    $('cFact').innerHTML =
      (d.anterior && d.cambio_en && d.visto === false ? '<div class="fa-bloque verde" style="margin:0 0 10px"><b>Cambió con el mapa del ' + esc(fecha(d.mapa.fecha)) + '</b>Antes: ' + esc((EST[d.anterior] || {}).t || '') + '. Ahora: ' + esc(e.t) + '.</div>' : '') +
      (d.seguimiento === 'vendida' ? '<div class="fa-bloque" style="margin:0 0 10px"><b>Vendida</b>La cerraste como vendida' + (d.seguimiento_en ? ' el ' + esc(fecha(d.seguimiento_en)) : '') + '.</div>' : d.seguimiento === 'no_interesa' ? '<div class="fa-bloque" style="margin:0 0 10px"><b>Cerrada</b>Al cliente ya no le interesa. Ya no se revisa con los mapas nuevos.</div>' : '') +
      '<div class="fa-veredicto ' + e.c + '"><b>' + esc(e.t) + '</b><p>' + esc(e.f) + '</p><small>' + esc(zonaTexto(d)) + ' · ' + (d.tipo === 'dedicado' ? 'Dedicado' : 'PYME') + '</small></div>' +
      (d.exclusividad === 'aliado' ? '<div class="fa-aviso"><b>Zona exclusiva de ' + esc(d.aliado || 'un aliado') + '</b><small>Se puede instalar. Solo ten en cuenta que esa zona tiene aliado asignado.</small></div>' : '') +
      (d.exclusividad === 'planta_externa' ? '<div class="fa-aviso"><b>Zona de Planta Externa</b><small>El equipo propio puede instalar. Un aliado no puede instalar aquí.</small></div>' : '') +
      '<div class="fa-mapa" id="faMapa"><div class="fa-sin">Cargando el mapa…</div></div>' +
      '<div class="fa-cerca" id="faCerca"></div>' +
      (d.resultado === 'hay_red' ? '<button type="button" class="fa-plegar" data-plegar="odoo" aria-expanded="false"><span>Texto para la orden de Odoo<small>Opcional. Cópialo al crear la orden.</small></span>' + ic('abajo') + '</button>' +
        '<div id="plOdoo" hidden><div class="fa-bloque" style="margin-top:8px"><div class="fa-odoo"><code id="txOdoo">' + esc(textoOdoo(d, d.nombre, rif)) + '</code><button type="button" class="btn btn-chico" id="faCopiaOdoo">Copiar</button></div>' +
        '<p class="nota" style="margin:8px 0 0">' + (rif ? 'RIF sin guiones, con su letra.' : 'Pon el RIF del cliente en lugar de J000000000, sin guiones.') + ' El nodo lo pone Odoo.' + (d.lider_codigo ? ' Si la orden la crea otra persona por ti, agrega al final tu código de vendedor: ' + esc(d.lider_codigo) + '.' : '') + '</p></div></div>' :
        '<div class="fa-bloque"><b>' + (abierta ? 'Queda en seguimiento' : 'Sin seguimiento') + '</b>' + (abierta ? 'Cada vez que se suba un mapa nuevo la revisamos. Si cambia, sale marcada como Nuevo.' : 'Está cerrada: los mapas nuevos ya no la revisan.') + '</div>') +
      '<button type="button" class="fa-plegar" data-plegar="datos" aria-expanded="' + C.plegado.datos + '"><span>Datos del cliente<small>Opcional. Se guarda solo.</small></span>' + ic('abajo') + '</button>' +
      '<div id="plDatos"' + (C.plegado.datos ? '' : ' hidden') + '>' + (d.puedo_editar ? '' : '<p class="nota">Solo quien hizo la consulta puede cambiar estos datos.</p>') +
        '<label class="rotulo arriba" for="gNom">Nombre (opcional)</label><input class="campo" id="gNom" maxlength="120" autocomplete="off" value="' + esc(d.nombre || '') + '"' + (d.puedo_editar ? '' : ' disabled') + '>' +
        '<div class="fa-dos"><div><label class="rotulo arriba" for="gTel">Teléfono (opcional)</label><input class="campo" id="gTel" type="tel" inputmode="tel" maxlength="20" value="' + esc(d.telefono || '') + '"' + (d.puedo_editar ? '' : ' disabled') + '></div>' +
        '<div><label class="rotulo arriba" for="gRif">RIF (opcional)</label><input class="campo" id="gRif" maxlength="14" autocapitalize="characters" value="' + esc(rif) + '"' + (d.puedo_editar ? '' : ' disabled') + '></div></div>' +
        '<div class="error" id="eDatos" role="alert"></div></div>' +
      '<div class="fa-hist"><span>Historial</span>' + (d.historial || []).map((h, i) => '<div class="fa-mov' + (h.resultado === 'hay_red' ? ' vd' : '') + '"><span>Mapa del ' + esc(fecha(h.fecha_mapa)) + ': <b>' + esc((EST[h.resultado] || {}).t || h.resultado) + '</b>' + (i === (d.historial.length - 1) ? ' al consultar' : '') + '</span><time>' + esc(fecha(h.en)) + '</time></div>').join('') +
        '<div class="fa-mov az"><span>Consultada por ' + esc(primerNombre(d.lider || '')) + '</span><time>' + esc(fecha(d.creada_en)) + '</time></div></div>' +
      (d.puedo_editar ? '<div class="fa-cierre">' + (abierta ? '<button type="button" class="btn btn-2" data-seguir="vendida">Ya lo vendí</button><button type="button" class="btn btn-2" data-seguir="no_interesa">Ya no interesa</button>' : '<button type="button" class="btn btn-2" data-seguir="abierta">Reabrir</button>') + '</div>' : '');
    $('pFact').innerHTML = '<button type="button" class="btn btn-2" id="faCopiarCliente">Copiar para el cliente</button><button type="button" class="btn" data-cierra="1">Listo</button>';
    cargarCercanas(d);
  }
  async function cargarCercanas(d){
    let z;
    try { z = await rpc('fact_cercanas', { p_lat: d.lat, p_lng: d.lng }); }
    catch (e) { if(C && C.id === d.id){ $('faMapa').innerHTML = '<div class="fa-sin">No se pudo cargar el mapa. ' + esc(e.message) + '</div>'; } return; }
    if(!C || C.id !== d.id) return;
    C.cercanas = z.zonas || [];
    const cer = C.cercanas.slice(0, 6);
    $('faCerca').innerHTML = cer.length ? '<span>MDT cercanos</span>' + cer.map(filaMdt).join('') : '';
    const zs = C.cercanas; const mio = C;
    setTimeout(() => { if(C === mio) dibujar('chico', $('faMapa'), d, zs, false); }, esTel() ? 320 : 300);
  }
  function filaMdt(z){
    const g = grupo(z);
    const tx = g === 'red' ? (z.exclusividad === 'planta_externa' ? 'Con red · Planta Externa' : 'Con red') : g === 'excl' ? 'Exclusiva de ' + (z.aliado || 'aliado') : z.estado === 'construccion' ? 'En construcción' : z.estado === 'permiso_vgt' ? 'Permiso VGT' : 'En diseño';
    return '<div class="fa-mdt"><i style="background:' + COLOR[g] + '"></i><span><b>' + esc(z.mdt) + '</b><small>' + esc(tx) + (z.capacidad ? ' · ' + esc(z.capacidad.toLocaleString('es-VE')) + ' hogares' : '') + '</small></span><time>' + esc(z.dentro ? 'Dentro' : km(z.distancia_m)) + '</time></div>';
  }
  const LEYENDA = '<div class="fa-ley" aria-hidden="true"><span><i style="background:' + COLOR.red + '"></i>Con red</span><span><i style="background:' + COLOR.excl + '"></i>Exclusiva aliado</span><span><i style="background:' + COLOR.dis + '"></i>En diseño</span></div>';
  function pin(d){
    const c = { hay_red: '#11734B', excepcion: '#8A5A00', espera: '#1B3A9E', sin_red: '#A32117' }[d.resultado] || '#111315';
    return L.divIcon({ className: 'fa-pin', iconSize: [24, 32], iconAnchor: [12, 31], html: '<svg width="24" height="32" viewBox="0 0 22 30" aria-hidden="true"><path d="M11 0C4.9 0 0 4.9 0 11c0 8.25 11 19 11 19s11-10.75 11-19C22 4.9 17.1 0 11 0z" fill="' + c + '" stroke="#fff" stroke-width="1.5"/><circle cx="11" cy="11" r="4" fill="#fff"/></svg>' });
  }
  // Dibuja el mapa con Leaflet. Si no cargó (sin internet), queda el aviso y la lista sigue sirviendo.
  function dibujar(k, caja, d, zonas, grande){
    if(!caja || !document.contains(caja) || !caja.offsetWidth) return;
    zonas = zonas || [];
    L = window.L;
    if(!L){ caja.innerHTML = '<div class="fa-sin">No se pudo cargar el mapa. Revisa el internet; la lista de MDT de abajo sigue sirviendo.</div>' + (grande ? '' : ''); return; }
    soltarMapa(k);
    caja.innerHTML = '<div class="fa-lienzo"></div>' + (grande ? '' : LEYENDA + '<button type="button" class="fa-amplio" id="faAmplio">Mapa amplio</button>');
    const m = L.map(caja.querySelector('.fa-lienzo'), { zoomControl: grande, attributionControl: true, scrollWheelZoom: grande, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false, inertia: false });
    mapas[k] = m; m.setView([d.lat, d.lng], 15, { animate: false });   // con vista antes de agregar las zonas
    const calles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
    const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: '© Esri' });
    m.attributionControl.setPrefix('<a href="https://leafletjs.com" rel="noopener">Leaflet</a>');
    calles.addTo(m); m._fa = { calles, sat, capas: { red: L.layerGroup().addTo(m), excl: L.layerGroup().addTo(m), dis: L.layerGroup().addTo(m) } };
    const p = [d.lat, d.lng]; const caja2 = L.latLngBounds([p, p]);
    zonas.forEach((z) => {
      if(!z.forma || !z.forma.length) return;
      const g = grupo(z); const sel = z.id === d.zona_id;
      const pol = L.polygon(z.forma, { color: COLOR[g], weight: sel ? 3.5 : 2, fillOpacity: g === 'dis' ? 0.25 : 0.32 });
      pol.bindTooltip(esc(z.mdt) + (grande ? (z.capacidad ? ' · ' + esc(z.capacidad) + ' HP' : '') : ''), { permanent: grande || sel, direction: 'center', className: 'fa-etq' });
      pol.bindPopup('<b>' + esc(z.mdt) + '</b><br>' + esc(z.dentro ? 'El punto está dentro' : 'A ' + km(z.distancia_m)) + (z.capacidad ? '<br>' + esc(z.capacidad) + ' hogares' : '') + (z.aliado ? '<br>Exclusiva de ' + esc(z.aliado) : ''));
      pol.addTo(m._fa.capas[g]);
      if(sel || z.dentro || z.distancia_m < (grande ? 2000 : 700)) caja2.extend(pol.getBounds());
    });
    L.marker(p, { icon: pin(d), keyboard: false, title: 'Ubicación consultada' }).addTo(m);
    if(grande){ L.circle(p, { radius: 2000, color: '#5B636E', weight: 1, dashArray: '4 4', fill: false, interactive: false }).addTo(m); caja2.extend(L.latLng(p).toBounds(4000)); }
    if(caja2.getNorthEast().equals(caja2.getSouthWest())) m.setView(p, 16, { animate: false }); else m.fitBounds(caja2.pad(0.08), { maxZoom: 17, animate: false });
    setTimeout(() => { if(mapas[k] === m && document.contains(caja)) try { m.invalidateSize(); } catch (e) {} }, 60);
  }
  function mapaAmplio(){
    if(!C || !C.d) return;
    const d = C.d; montarHojas();
    $('sMapa').textContent = 'MDT a menos de 2 km de ' + (d.nombre || 'la ubicación');
    $('cMapa').innerHTML = '<div class="fa-grande" id="faGrande"></div>' +
      '<div class="fa-capas"><button type="button" data-capa="red" aria-pressed="true"><i style="background:' + COLOR.red + '"></i>Con red</button><button type="button" data-capa="excl" aria-pressed="true"><i style="background:' + COLOR.excl + '"></i>Exclusiva aliado</button>' +
      '<button type="button" data-capa="dis" aria-pressed="true"><i style="background:' + COLOR.dis + '"></i>En diseño</button><button type="button" id="faSat" aria-pressed="false">Vista satélite</button></div>' +
      '<div class="fa-cerca">' + ((C.cercanas || []).length ? '<span>MDT a menos de 2 km</span>' + C.cercanas.map(filaMdt).join('') : '<p class="nota">No hay MDT a menos de 2 km.</p>') + '</div>';
    abrirHoja('hojaMapa');
    const zs = C.cercanas || []; const mio = C;
    setTimeout(() => { if(C === mio && hojaAbierta() === 'hojaMapa') dibujar('grande', $('faGrande'), d, zs, true); }, 320);
  }

  // ---------- Acciones ----------
  async function copiar(texto, ok){
    try { await navigator.clipboard.writeText(texto); toast(ok); }
    catch (e) { toast('No se pudo copiar. Mantén presionado el texto para copiarlo', 'error'); }
  }
  async function pegar(){
    let t = '';
    try { t = await navigator.clipboard.readText(); } catch (e) { errorCampo('El teléfono no dejó pegar. Mantén presionado el campo y toca Pegar'); return; }
    if(!t || !t.trim()){ errorCampo('No hay nada copiado. En WhatsApp mantén presionado el enlace y toca Copiar'); return; }
    $('faEnlace').value = t.trim(); consultar();
  }
  function ubicacion(){
    if(!navigator.geolocation){ errorCampo('Este teléfono no da la ubicación. Pega el enlace o escribe las coordenadas'); return; }
    const b = $('faUbic'); if(b){ b.disabled = true; b.textContent = 'Buscando tu ubicación…'; }
    navigator.geolocation.getCurrentPosition((p) => {
      if(!$('faEnlace')) return;
      $('faEnlace').value = p.coords.latitude.toFixed(6) + ', ' + p.coords.longitude.toFixed(6); consultar();
    }, (e) => {
      if(b && document.contains(b)){ b.disabled = false; b.innerHTML = ic('wifi') + 'Usar mi ubicación'; }
      errorCampo(e && e.code === 1 ? 'No diste permiso de ubicación. Actívalo en el teléfono o pega el enlace' : 'No se pudo saber dónde estás. Intenta otra vez o pega el enlace');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }
  let tDatos = null;
  async function guardarDatos(){
    if(!C || !C.d || !C.d.puedo_editar || !$('gNom')) return;
    const er = $('eDatos'); er.textContent = '';
    const datos = { p_id: C.d.id, p_nombre: $('gNom').value, p_telefono: $('gTel').value, p_rif: $('gRif').value };
    try {
      await rpc('fact_datos', datos);
      C.d.nombre = datos.p_nombre.replace(/\s+/g, ' ').trim() || null; $('tFact').textContent = C.d.nombre || 'Consulta';
      cache.borrarTodo(); cargar(); toast('Guardado');
    } catch (e) { er.textContent = e.message; }
  }
  async function seguir(estado, b){
    if(!C || !C.d) return;
    b.disabled = true;
    try {
      await rpc('fact_seguimiento', { p_id: C.d.id, p_estado: estado });
      toast(estado === 'vendida' ? 'Marcada como vendida' : estado === 'no_interesa' ? 'Consulta cerrada' : 'Consulta reabierta');
      cache.borrarTodo(); cargar(); abrirConsulta(C.d.id);
    } catch (e) { toast(e.message, 'error'); if(document.contains(b)) b.disabled = false; }
  }

  document.addEventListener('click', (e) => {
    const t = e.target; let b;
    if(t.closest('[data-nueva]')){ formulario(); return; }
    if((b = t.closest('[data-filtro]'))){ ponerFiltro(b.dataset.filtro); return; }
    if(t.closest('#faMas')){ cargar(true); return; }
    if(t.closest('#faReintentar')){ cargar(); return; }
    if((b = t.closest('[data-consulta]'))){ abrirConsulta(b.dataset.consulta); return; }
    if(t.closest('#faPegar')){ pegar(); return; }
    if(t.closest('#faUbic')){ ubicacion(); return; }
    if((b = t.closest('[data-tipo]'))){ F.tipo = b.dataset.tipo; Array.prototype.forEach.call(document.querySelectorAll('[data-tipo]'), (x) => x.setAttribute('aria-checked', String(x === b))); return; }
    if(t.closest('#faConsultar')){ consultar(); return; }
    if(t.closest('#faAmplio')){ mapaAmplio(); return; }
    if((b = t.closest('[data-plegar]'))){ const id = b.dataset.plegar === 'odoo' ? 'plOdoo' : 'plDatos'; const abre = b.getAttribute('aria-expanded') !== 'true'; b.setAttribute('aria-expanded', String(abre)); $(id).hidden = !abre; return; }
    if(t.closest('#faCopiaOdoo')){ copiar($('txOdoo').textContent, 'Texto para Odoo copiado'); return; }
    if(t.closest('#faCopiarCliente') && C && C.d){ copiar(CLIENTE[C.d.resultado] || CLIENTE.sin_red, 'Mensaje copiado. Pégalo en el chat del cliente'); return; }
    if((b = t.closest('[data-seguir]'))){ seguir(b.dataset.seguir, b); return; }
    if((b = t.closest('[data-capa]')) && mapas.grande){ const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); const g = mapas.grande._fa.capas[b.dataset.capa]; if(on) g.addTo(mapas.grande); else mapas.grande.removeLayer(g); return; }
    if((b = t.closest('#faSat')) && mapas.grande){ const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); const f = mapas.grande._fa; if(on){ mapas.grande.removeLayer(f.calles); f.sat.addTo(mapas.grande); } else { mapas.grande.removeLayer(f.sat); f.calles.addTo(mapas.grande); } }
  });
  document.addEventListener('keydown', (e) => { if(e.key === 'Enter' && e.target.id === 'faEnlace'){ e.preventDefault(); consultar(); } });
  document.addEventListener('input', (e) => {
    if(!C || !C.d) return;
    if(['gNom', 'gRif'].indexOf(e.target.id) >= 0 && $('txOdoo')) $('txOdoo').textContent = textoOdoo(C.d, $('gNom').value, $('gRif').value);
  });
  document.addEventListener('change', (e) => { if(['gNom', 'gTel', 'gRif'].indexOf(e.target.id) >= 0){ clearTimeout(tDatos); tDatos = setTimeout(guardarDatos, 150); } });

  window.Factibilidad = { _textoOdoo: textoOdoo, VER };
  (async function(){
    yo = await S.requerir(['admin', 'analista', 'lider']);
    if(!yo) return;
    window.Armazon.montar(yo, { activo: 'factibilidad' });
    $('faSub').textContent = yo.rol === 'lider' ? 'Tus consultas. Se revisan solas con cada mapa nuevo.' : 'Las consultas de todos los líderes. Se revisan solas con cada mapa nuevo.';
    let f = 'abiertas'; try { f = new URL(location.href).searchParams.get('f') || 'abiertas'; } catch (e) {}
    filtro = ATAJOS.some((a) => a[0] === f) ? f : 'abiertas';
    montarHojas(); cargar();
  })();
})();
