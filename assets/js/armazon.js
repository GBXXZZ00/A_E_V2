// Armazón común de los módulos: barra de arriba, navegación y menú de cuenta.
(function(){
  'use strict';
  const { $, esc, ic, iniciales, fecha, abrirHoja, cerrarHoja, prepararHojas, cache } = window.Comun;
  const S = window.Sesion;
  window.ACTUALIZAR_LISTO = true;   // la pantalla Actualizar ya existe

  const NAV = [
    { id: 'inicio', texto: 'Inicio', icono: 'casa', enlace: 'inicio.html' },
    { id: 'comisiones', texto: 'Comisiones', icono: 'barras', enlace: 'comisiones.html' },
    { id: 'clientes', texto: 'Clientes', icono: 'edificio', enlace: 'clientes.html' }
  ];

  // opciones: { activo: 'inicio'|'comisiones'|'clientes'|null, sinNav: bool, volver: {enlace, texto}, acciones: html }
  function montar(p, opciones){
    const o = opciones || {};
    let equipo = S.equipoGuardado();
    if(!S.puedeEntrar(p, equipo)) equipo = p.equipo === 'ambos' ? 'ventas' : p.equipo;
    const conNav = !o.sinNav && equipo !== 'aliados' && p.rol !== 'aliado';
    const cargo = p.cargo || S.ROLES[p.rol] || '';
    const barra = $('barra');
    barra.innerHTML =
      (o.volver ? '<a class="barra-volver" href="' + esc(o.volver.enlace) + '">' + ic('volver', 'ch') + esc(o.volver.texto) + '</a>' : '') +
      '<a class="marca" href="inicio.html" aria-label="Inicio"><img class="logo" src="assets/img/logo.svg?v=5" alt="Airtek" width="96" height="12"><span>Empresas</span></a>' +
      (conNav ? '<nav class="navpc" aria-label="Navegación">' + NAV.map((n) => '<a href="' + n.enlace + '"' + (o.activo === n.id ? ' class="on" aria-current="page"' : '') + '>' + n.texto + '</a>').join('') + '</nav>' : '') +
      '<span class="sep"></span>' +
      (o.acciones ? '<div class="acciones-bar" id="accionesBar">' + o.acciones + '</div>' : '') +
      '<button type="button" class="cuenta" id="cuenta" data-abre="hojaCuenta" aria-label="Mi cuenta">' +
        '<span class="tx"><b>' + esc(p.nombre) + '</b><small>' + esc(cargo) + '</small></span><span class="av" aria-hidden="true">' + esc(iniciales(p.nombre)) + '</span></button>';
    document.body.classList.toggle('modo-ficha', !!o.volver);

    if(conNav){
      document.body.classList.add('con-nav');
      let nav = $('navAbajo');
      if(!nav){ nav = document.createElement('nav'); nav.id = 'navAbajo'; nav.className = 'nav'; nav.setAttribute('aria-label', 'Navegación'); document.body.appendChild(nav); }
      nav.innerHTML = NAV.map((n) => '<a href="' + n.enlace + '"' + (o.activo === n.id ? ' class="on" aria-current="page"' : '') + '><span>' + ic(n.icono) + '</span>' + n.texto + '</a>').join('');
    }

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
      '<div class="rot">Mi cuenta</div>' +
      '<a class="op" href="index.html#cambiar" data-foco><span class="ic">' + ic('candado') + '</span><span class="tx">Cambiar PIN</span>' + ic('derecha', 'ch') + '</a>' +
      '<button type="button" class="op salir" id="salir"><span class="ic">' + ic('salir') + '</span><span class="tx">Salir</span></button>';
    prepararHojas();
    $('salir').addEventListener('click', async () => { cache.borrarTodo(); await S.salir(); location.replace('index.html'); });
    return { equipo, conNav };
  }

  // Actualiza los textos del menú cuando llegan los datos de Inicio
  function datosMenu(ini){
    if(!ini) return;
    const u = $('dUsuarios'); if(u && ini.usuarios) u.textContent = ini.usuarios + ' con acceso';
    const t = $('dTad'); if(t) t.textContent = ini.tad_en ? 'Último TAD: ' + fecha(ini.tad_en) : 'Odoo, instalaciones y TAD';
  }

  window.Armazon = { montar, datosMenu, cerrarCuenta: cerrarHoja, abrirCuenta: () => abrirHoja('hojaCuenta') };
})();
