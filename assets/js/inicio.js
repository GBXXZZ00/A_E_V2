// Inicio: saludo, accesos a los módulos según el rol y hoja de Mi cuenta.
(function(){
  'use strict';
  const { $, esc, iniciales } = window.Comun;
  const S = window.Sesion;

  // Los módulos se encienden aquí a medida que se construyen (enlace distinto de null).
  const MODULOS = [
    { id: 'instalaciones', nombre: 'Instalaciones y comisión', texto: 'Seguimiento por líder, legal, pago y corte del 21 al 20.', enlace: null, roles: ['admin','abogado','lider','analista'], grande: true },
    { id: 'actualizar', nombre: 'Actualizar', texto: 'Sube Odoo, órdenes de instalación y TAD.', enlace: null, roles: ['admin','analista'] },
    { id: 'documentos', nombre: 'Documentos', texto: 'Expediente y requisitos de cada cliente.', enlace: null, roles: ['admin','abogado','lider','analista'] },
    { id: 'factibilidad', nombre: 'Factibilidad', texto: 'Consulta de cobertura por ubicación.', enlace: null, roles: ['admin','lider','analista'] },
    { id: 'usuarios', nombre: 'Usuarios', texto: 'Cuentas, roles y PIN del equipo.', enlace: 'usuarios.html', roles: ['admin'] }
  ];

  function pintarCuenta(p, equipo){
    $('cNombre').textContent = p.nombre; $('cCargo').textContent = p.cargo || S.ROLES[p.rol] || '';
    $('cIni').textContent = iniciales(p.nombre); $('cuenta').classList.remove('hidden');
    $('dNombre').textContent = p.nombre; $('dCargo').textContent = p.cargo || S.ROLES[p.rol] || '';
    $('dUsuario').textContent = p.usuario; $('dEquipo').textContent = S.EQUIPOS[equipo] || '';
  }

  function pintarModulos(p){
    const mios = MODULOS.filter((m) => m.roles.indexOf(p.rol) >= 0);
    $('contenido').innerHTML = '<div class="accesos">' + mios.map((m) => {
      const clase = 'acceso' + (m.grande ? ' grande' : '') + (m.enlace ? ' activo' : '');
      const dentro = '<b>' + esc(m.nombre) + '</b>' + (m.enlace ? '' : '<span class="chip">En construcción</span>') + '<p>' + esc(m.texto) + '</p>';
      return m.enlace
        ? '<a class="' + clase + '" href="' + esc(m.enlace) + '" data-modulo="' + esc(m.id) + '">' + dentro + '</a>'
        : '<div class="' + clase + '" aria-disabled="true" data-modulo="' + esc(m.id) + '">' + dentro + '</div>';
    }).join('') + '</div>';
  }

  async function arrancar(){
    const p = await S.requerir();
    if(!p) return;
    let equipo = S.equipoGuardado();
    if(!S.puedeEntrar(p, equipo)) equipo = p.equipo === 'ambos' ? 'ventas' : p.equipo;
    pintarCuenta(p, equipo);
    $('saludo').textContent = 'Hola, ' + (p.nombre.trim().split(/\s+/)[0] || p.nombre);
    if(equipo === 'aliados'){
      $('subSaludo').textContent = 'Aliados comerciales';
      $('contenido').innerHTML = '<div class="aviso"><b>Este espacio está en construcción</b><p>El módulo de aliados comerciales llega después de instalaciones y documentos. Te avisaremos cuando esté listo.</p></div>';
      return;
    }
    $('subSaludo').textContent = 'Ventas corporativas. Esto es lo que tienes disponible.';
    pintarModulos(p);
  }

  $('salir').addEventListener('click', async () => { await S.salir(); location.replace('index.html'); });
  arrancar();
})();
