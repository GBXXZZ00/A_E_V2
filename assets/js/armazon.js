// Armazón común de los módulos: barra de arriba, navegación y menú de cuenta.
(function(){
  'use strict';
  const { $, esc, ic, iniciales, fecha, abrirHoja, cerrarHoja, prepararHojas, cache } = window.Comun;
  const S = window.Sesion;
  window.ACTUALIZAR_LISTO = true;   // la pantalla Actualizar ya existe

  const NAV = [
    { id: 'inicio', texto: 'Inicio', icono: 'casa', enlace: 'inicio.html' },
    { id: 'comisiones', texto: 'Comisiones', icono: 'barras', enlace: 'comisiones.html' },
    { id: 'clientes', texto: 'Clientes', icono: 'edificio', enlace: 'clientes.html' },
    { id: 'factibilidad', texto: 'Factibilidad', icono: 'wifi', enlace: 'factibilidad.html', roles: ['admin', 'analista', 'lider'] },
    { id: 'revision', texto: 'Revisión', icono: 'doc', enlace: 'revision.html', roles: ['admin', 'abogado'] },
    { id: 'aliados', texto: 'Aliados', icono: 'usuarios', enlace: 'aliados.html', roles: ['admin', 'analista', 'lider', 'abogado'], soloPc: true }
  ];

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
      (conNav ? '<nav class="navpc" aria-label="Navegación">' + NAV.filter((n) => !n.roles || n.roles.indexOf(p.rol) >= 0).map((n) => '<a href="' + n.enlace + '"' + (o.activo === n.id ? ' class="on" aria-current="page"' : '') + '>' + n.texto + '</a>').join('') + '</nav>' : '') +
      '<span class="sep"></span>' +
      (o.acciones ? '<div class="acciones-bar" id="accionesBar">' + o.acciones + '</div>' : '') +
      '<button type="button" class="cuenta" id="cuenta" data-abre="hojaCuenta" aria-label="Mi cuenta">' +
        '<span class="tx"><b>' + esc(p.nombre) + '</b><small>' + esc(cargo) + '</small></span><span class="av" aria-hidden="true">' + esc(iniciales(p.nombre)) + '</span></button>';
    document.body.classList.toggle('modo-ficha', !!o.volver);

    if(conNav){
      document.body.classList.add('con-nav');
      let nav = $('navAbajo');
      if(!nav){ nav = document.createElement('nav'); nav.id = 'navAbajo'; nav.className = 'nav'; nav.setAttribute('aria-label', 'Navegación'); document.body.appendChild(nav); }
      nav.innerHTML = NAV.filter((n) => (!n.roles || n.roles.indexOf(p.rol) >= 0) && !n.soloPc).map((n) => '<a href="' + n.enlace + '"' + (o.activo === n.id ? ' class="on" aria-current="page"' : '') + '><span>' + ic(n.icono) + '</span>' + n.texto + '</a>').join('');
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
    montado = { clave, res: { equipo, conNav } };
    return montado.res;
  }

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

  window.Armazon = { montar, temprano, arrancar, datosMenu, cerrarCuenta: cerrarHoja, abrirCuenta: () => abrirHoja('hojaCuenta') };
})();
