// Armazón común de los módulos: barra de arriba, navegación y menú de cuenta.
(function(){
  'use strict';
  const { $, esc, ic, iniciales, fecha, abrirHoja, cerrarHoja, prepararHojas, cache, rpc, toast } = window.Comun;
  const S = window.Sesion;
  window.ACTUALIZAR_LISTO = true;   // la pantalla Actualizar ya existe

  const NAV = [
    { id: 'inicio', texto: 'Inicio', icono: 'casa', enlace: 'inicio.html' },
    { id: 'comisiones', texto: 'Comisiones', icono: 'barras', enlace: 'comisiones.html' },
    { id: 'trabajo', texto: 'Mi trabajo', icono: 'check', enlace: 'trabajo.html', roles: ['admin', 'analista', 'lider'], soloPc: true },
    { id: 'clientes', texto: 'Clientes', icono: 'edificio', enlace: 'clientes.html' },
    // En el teléfono entra solo si la barra de abajo no pasa de 5 botones (el administrador la abre desde Inicio)
    { id: 'migraciones', texto: 'Migraciones', icono: 'cambio', enlace: 'migraciones.html', roles: ['admin', 'analista', 'lider'], opcionalTel: true },
    { id: 'factibilidad', texto: 'Factibilidad', icono: 'wifi', enlace: 'factibilidad.html', roles: ['admin', 'analista', 'lider'] },
    { id: 'revision', texto: 'Revisión', icono: 'doc', enlace: 'revision.html', roles: ['admin', 'abogado'] },
    { id: 'aliados', texto: 'Aliados', icono: 'usuarios', enlace: 'aliados.html', roles: ['admin', 'analista', 'lider', 'abogado'], soloPc: true },
    { id: 'gerencia', texto: 'Gerencia', icono: 'barras', enlace: 'gerencia.html', roles: ['admin', 'analista', 'lider', 'abogado', 'gerencia'], soloPc: true }
  ];

  // Un módulo se ve por rol o, para un líder, por su marca (líder de dedicados)
  const puedeVer = (n, p) => p.rol === 'gerencia' ? n.id === 'gerencia' : !n.roles || n.roles.indexOf(p.rol) >= 0 || (n.marca && p.rol === 'lider' && !!p[n.marca]);
  // opciones: { activo: 'inicio'|'comisiones'|'clientes'|'factibilidad'|'revision'|'aliados'|null, sinNav: bool, volver: {enlace, texto}, acciones: html }
  let montado = null;   // { clave, res }: lo que ya está dibujado, para no repetirlo al confirmar la sesión
  function montar(p, opciones){
    const o = opciones || {};
    const clave = S.firma(p) + '|' + S.equipoGuardado() + '|' + JSON.stringify(o);
    if(montado && montado.clave === clave && $('barra').querySelector('.cuenta')) return montado.res;
    let equipo = S.equipoGuardado();
    if(!S.puedeEntrar(p, equipo)) equipo = p.equipo === 'ambos' ? 'ventas' : p.equipo;
    const conNav = !o.sinNav && equipo !== 'aliados' && p.rol !== 'aliado';
    const cargo = p.cargo || S.ROLES[p.rol] || '';
    const barra = $('barra');
    barra.innerHTML =
      (o.volver ? '<a class="barra-volver" href="' + esc(o.volver.enlace) + '">' + ic('volver', 'ch') + esc(o.volver.texto) + '</a>' : '') +
      '<a class="marca" href="inicio.html" aria-label="Inicio"><img class="logo" src="assets/img/logo.svg?v=5" alt="Airtek" width="96" height="12"><span>Empresas</span></a>' +
      (conNav ? '<nav class="navpc" aria-label="Navegación">' + NAV.filter((n) => puedeVer(n, p)).map((n) => '<a href="' + n.enlace + '" data-nav="' + n.id + '"' + (o.activo === n.id ? ' class="on" aria-current="page"' : '') + '>' + n.texto + '</a>').join('') + '</nav>' : '') +
      '<span class="sep"></span>' +
      (o.acciones ? '<div class="acciones-bar" id="accionesBar">' + o.acciones + '</div>' : '') +
      '<button type="button" class="cuenta" id="cuenta" data-abre="hojaCuenta" aria-label="Mi cuenta">' +
        '<span class="tx"><b>' + esc(p.nombre) + '</b><small>' + esc(cargo) + '</small></span><span class="av" aria-hidden="true">' + esc(iniciales(p.nombre)) + '</span></button>';
    document.body.classList.toggle('modo-ficha', !!o.volver);

    if(conNav){
      document.body.classList.add('con-nav');
      let nav = $('navAbajo');
      if(!nav){ nav = document.createElement('nav'); nav.id = 'navAbajo'; nav.className = 'nav'; nav.setAttribute('aria-label', 'Navegación'); document.body.appendChild(nav); }
      let tel = NAV.filter((n) => puedeVer(n, p) && (!n.soloPc || p.rol === 'gerencia') && !(n.pcSalvoMarca && !(p.rol === 'lider' && p[n.marca])));
      if(tel.length > 5) tel = tel.filter((n) => !n.opcionalTel);
      nav.innerHTML = tel.map((n) => '<a href="' + n.enlace + '" data-nav="' + n.id + '"' + (o.activo === n.id ? ' class="on" aria-current="page"' : '') + '><span>' + ic(n.icono) + '</span>' + n.texto + '</a>').join('');
    }
    if(conNav) contadores(null, p);

    let hoja = $('hojaCuenta');
    if(!hoja){
      hoja = document.createElement('section'); hoja.id = 'hojaCuenta'; hoja.className = 'hoja';
      hoja.setAttribute('role', 'dialog'); hoja.setAttribute('aria-modal', 'true'); hoja.setAttribute('aria-label', 'Mi cuenta'); hoja.setAttribute('aria-hidden', 'true');
      document.body.appendChild(hoja);
    }
    const ini = cache.leer('inicio') || {};
    const admin = p.rol === 'admin'; const sube = p.rol === 'admin' || p.rol === 'analista';
    hoja.innerHTML =
      '<div class="asa" aria-hidden="true"></div>' +
      '<div class="yo-cab"><span class="av" aria-hidden="true">' + esc(iniciales(p.nombre)) + '</span>' +
        '<span class="tx"><b id="dNombre">' + esc(p.nombre) + '</b><small id="dCargo">' + esc(cargo) + '</small></span>' +
        '<button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div>' +
      '<div class="datos"><div class="dato-f"><span>Usuario</span><b id="dUsuario">' + esc(p.usuario) + '</b></div>' +
        '<div class="dato-f"><span>Equipo</span><b id="dEquipo">' + esc(S.EQUIPOS[equipo] || '') + '</b></div></div>' +
      (equipo !== 'aliados' && (admin || (sube && window.ACTUALIZAR_LISTO)) ? '<div class="rot">Administración</div>' : '') +
      (equipo !== 'aliados' && admin ? '<a class="op" href="usuarios.html" data-ir="usuarios"><span class="ic">' + ic('usuarios') + '</span><span class="tx">Usuarios<small id="dUsuarios">' +
        (ini.usuarios ? esc(ini.usuarios) + ' con acceso' : 'Cuentas, roles y PIN del equipo') + '</small></span>' + ic('derecha', 'ch') + '</a>' : '') +
      (equipo !== 'aliados' && sube && window.ACTUALIZAR_LISTO ? '<a class="op" href="actualizar.html" data-ir="actualizar"><span class="ic">' + ic('actualizar') + '</span><span class="tx">Actualizar datos<small id="dTad">' +
        (ini.tad_en ? 'Último TAD: ' + esc(fecha(ini.tad_en)) : 'Odoo, instalaciones y TAD') + '</small></span>' + ic('derecha', 'ch') + '</a>' : '') +
      (equipo !== 'aliados' && admin ? '<button type="button" class="op" data-ocr-aj="1"><span class="ic">' + ic('doc') + '</span><span class="tx">Lectura con OCR<small>Qué se lee sin IA</small></span>' + ic('derecha', 'ch') + '</button>' : '') +
      '<div class="rot">Mi cuenta</div>' +
      '<a class="op" href="index.html#cambiar" data-foco><span class="ic">' + ic('candado') + '</span><span class="tx">Cambiar PIN</span>' + ic('derecha', 'ch') + '</a>' +
      '<button type="button" class="op salir" id="salir"><span class="ic">' + ic('salir') + '</span><span class="tx">Salir</span></button>';
    prepararHojas();
    $('salir').addEventListener('click', async () => { cache.borrarTodo(); await S.salir(); location.replace('index.html'); });
    montado = { clave, res: { equipo, conNav } };
    return montado.res;
  }

  // Corrida 14/10 tarde: cada módulo del menú lleva su contador de pendientes (la misma fuente que Mi trabajo e Inicio).
  // Se guarda en el dispositivo y se pide de nuevo cada 2 minutos como máximo; si falla, el menú sigue sin número.
  const K_CONT = 'contadores_menu'; let pidiendo = false;
  function numerosNav(r){
    const m = (r && r.modulos) || {}; const n = (k) => (m[k] || {}).n || 0; const rj = (k) => (m[k] || {}).rojo || 0;
    return { trabajo: [r ? r.total || 0 : 0, r ? r.rojo || 0 : 0], clientes: [n('expedientes') + n('dedicados'), rj('expedientes') + rj('dedicados')],
      comisiones: [n('comisiones'), rj('comisiones')], migraciones: [n('migraciones'), rj('migraciones')], aliados: [n('aliados'), rj('aliados')] };
  }
  function pintarNumeros(r){
    const nums = numerosNav(r);
    Array.prototype.forEach.call(document.querySelectorAll('[data-nav]'), (a) => {
      let b = a.querySelector('.nbadge'); const x = nums[a.dataset.nav];
      const nom = a.dataset.nom || (a.dataset.nom = a.textContent.replace(/\d+\+?/g, '').trim());
      if(!x || !x[0]){ if(b) b.remove(); a.removeAttribute('aria-label'); return; }
      if(!b){ b = document.createElement('b'); b.className = 'nbadge'; (a.querySelector('span') || a).appendChild(b); }
      b.textContent = x[0] > 99 ? '99+' : String(x[0]); b.classList.toggle('rojo', x[1] > 0);
      b.setAttribute('aria-hidden', 'true'); a.setAttribute('aria-label', nom + ', ' + x[0] + ' pendientes' + (x[1] ? ', ' + x[1] + ' vencidos' : ''));
    });
  }
  // resumen: lo que ya trajo la página (Inicio); sin él, se usa lo guardado y se pide si está viejo
  async function contadores(resumen, p){
    const yo = p || {}; if(['admin', 'analista', 'lider'].indexOf(yo.rol) < 0) return;
    if(resumen){ cache.guardar(K_CONT, { uid: yo.id, en: Date.now(), r: resumen }); pintarNumeros(resumen); return; }
    const g = cache.leer(K_CONT); const mio = g && g.uid === yo.id ? g : null;
    if(mio) pintarNumeros(mio.r);
    if(/(?:inicio|trabajo)\.html$|\/$/.test(location.pathname)) return;   // estas páginas ya piden el resumen y lo pasan aquí
    if((mio && Date.now() - mio.en < 120000) || pidiendo || !navigator.onLine) return;
    pidiendo = true;
    try { const r = await rpc('trabajo_resumen', {}); if(r){ cache.guardar(K_CONT, { uid: yo.id, en: Date.now(), r }); pintarNumeros(r); } }
    catch (e) { /* el contador es de ayuda: si falla, la página sigue y su propia carga avisa del error */ }
    finally { pidiendo = false; }
  }

  // Corrida 14/10 tarde: ajustes del OCR (solo el administrador). Arrancan en NO; con NO todo sigue como antes (la IA)
  const AJ_OCR = [['aliados', 'Usar OCR en aliados', 'El RIF de una solicitud se lee con OCR; si es dudoso, con la IA'],
    ['revision', 'Usar OCR en la revisión', 'RIF y cédulas claros no van a la IA; combinados, actas y dudosos sí'],
    ['expediente', 'Llenar datos del expediente con OCR', 'Al subir el RIF propone razón social y domicilio para confirmar']];
  async function abrirAjOcr(){
    let h = $('hojaOcrAj');
    if(!h){ h = document.createElement('section'); h.id = 'hojaOcrAj'; h.className = 'hoja'; h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true'); h.setAttribute('aria-labelledby', 'tOcrAj'); h.setAttribute('aria-hidden', 'true'); document.body.appendChild(h); prepararHojas(); }
    const pinta = (v, err) => { h.innerHTML = '<div class="cab"><div><h2 id="tOcrAj">Lectura con OCR</h2><p class="sub-hoja">Google Drive lee el texto gratis; la IA queda para lo que hay que entender.</p></div><button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div>' +
      (err ? '<div class="vacio" role="alert"><b>No se pudieron leer los ajustes</b><p>' + esc(err) + '</p><button type="button" class="btn btn-chico" data-ocr-aj="1">Reintentar</button></div>'
        : !v ? '<div class="sk-bloque"><span class="sk" style="height:60px;border-radius:16px"></span><span class="sk" style="height:60px;border-radius:16px"></span><span class="sk" style="height:60px;border-radius:16px"></span></div>'
        : AJ_OCR.map((x) => '<div class="interr"><span class="tx">' + esc(x[1]) + '<small>' + esc(x[2]) + '</small></span><button type="button" class="sw" role="switch" data-ocr-sw="' + x[0] + '" aria-checked="' + !!v[x[0]] + '" aria-label="' + esc(x[1]) + '"></button></div>').join('') +
          '<p class="nota-chica">Si el OCR falla o lee algo dudoso, siempre sigue la IA. Cada cambio queda en la bitácora.</p>'); };
    pinta(null); abrirHoja('hojaOcrAj');
    try { pinta(await rpc('ocr_ajustes', {})); } catch (e) { pinta(null, e.message); }
  }
  document.addEventListener('click', async (ev) => {
    const t = ev.target; let b;
    if(t.closest('[data-ocr-aj]')){ abrirAjOcr(); return; }
    if((b = t.closest('[data-ocr-sw]'))){
      if(b.disabled) return; const si = b.getAttribute('aria-checked') !== 'true'; b.disabled = true;
      try { const v = await rpc('ocr_ajuste_guardar', { p_clave: b.dataset.ocrSw, p_si: si }); b.setAttribute('aria-checked', String(!!v[b.dataset.ocrSw])); toast(si ? 'Prendido' : 'Apagado'); }
      catch (e) { toast(e.message, 'error'); }
      finally { b.disabled = false; }
    }
  });

  // Opciones de cada página, para dibujar la navegación antes de que responda el servidor
  function opcionesPagina(){
    const pag = (location.pathname.split('/').pop() || '').replace('.html', '');
    if(pag === 'usuarios' || pag === 'actualizar') return { activo: null, volver: { enlace: 'inicio.html', texto: 'Inicio' } };
    if(NAV.some((n) => n.id === pag)) return { activo: pag };
    return null;
  }
  // Con el perfil guardado se dibuja todo al instante; S.requerir() confirma después y montar() corrige si algo cambió.
  // Devuelve ese perfil si sirve para esta página (para pintar lo último visto mientras llega lo nuevo).
  function temprano(roles){
    const o = opcionesPagina(); if(!o) return null;
    // Nunca en blanco: mientras corre el módulo, la lista muestra su esqueleto
    const l = $('lista'); if(l && !l.innerHTML.trim()) l.innerHTML = window.Comun.esqueleto(6);
    const z = $('zonaCorte'); if(z && !z.innerHTML.trim()) z.innerHTML = '<div class="sk" style="height:92px;border-radius:22px;margin-top:18px"></div>';
    const p = S.perfilGuardado(roles); if(!p) return null;
    try { montar(p, o); } catch (e) { return null; }
    return p;
  }
  temprano();

  // Arranque de un módulo: con perfil guardado, iniciar() corre al instante (lista con lo último visto);
  // si no, espera a S.requerir(). Si el servidor dice algo distinto del perfil guardado, se recarga con el bueno.
  async function arrancar(roles, o, iniciar, alConfirmar){
    const pre = temprano(roles);
    if(pre){ montar(pre, o); iniciar(pre); }
    const p = await S.requerir(roles);
    if(!p) return null;
    if(pre && S.firma(pre) !== S.firma(p)){ location.reload(); return null; }
    montar(p, o);
    if(!pre) iniciar(p); else if(alConfirmar) alConfirmar(p);
    return p;
  }

  // Actualiza los textos del menú cuando llegan los datos de Inicio
  function datosMenu(ini){
    if(!ini) return;
    const u = $('dUsuarios'); if(u && ini.usuarios) u.textContent = ini.usuarios + ' con acceso';
    const t = $('dTad'); if(t) t.textContent = ini.tad_en ? 'Último TAD: ' + fecha(ini.tad_en) : 'Odoo, instalaciones y TAD';
  }

  window.Armazon = { montar, temprano, arrancar, datosMenu, contadores, cerrarCuenta: cerrarHoja, abrirCuenta: () => abrirHoja('hojaCuenta') };
})();
