// Usuarios (solo administrador): crear, editar, restablecer PIN y activar o desactivar.
(function(){
  'use strict';
  const { $, esc, toast, mensajeError, iniciales, normalizeStr, abrirHoja, cerrarHoja } = window.Comun;
  const S = window.Sesion;
  const db = window.db;
  const EQ = { ventas: 'Ventas corporativas', aliados: 'Aliados comerciales', ambos: 'Los dos' };
  let usuarios = [];
  let editando = null;  // el usuario abierto en la hoja, o null si es nuevo
  let yo = null;

  async function llamar(cuerpo){
    const { data, error } = await db.functions.invoke('gestionar_usuarios', { body: cuerpo });
    if(error){
      let m = '';
      try { const j = await error.context.json(); m = j && j.error; } catch (e) {}
      if(error.context && error.context.status === 401){ await S.salir(); location.replace('index.html'); }
      throw new Error(m || mensajeError(error));
    }
    if(data && data.error) throw new Error(data.error);
    return data;
  }

  function pinAzar(){
    for(;;){
      const n = new Uint32Array(1); crypto.getRandomValues(n);
      const p = String(n[0] % 1000000).padStart(6, '0');
      if(!S.pinFacil(p)) return p;
    }
  }
  // El usuario para entrar: sin acentos ni espacios y en minúscula
  function limpiarUsuario(v){ return normalizeStr(v).replace(/[^a-z0-9]/g, ''); }

  function pintar(){
    const activos = usuarios.filter((u) => u.activo).length;
    $('resumen').textContent = usuarios.length ? activos + ' con acceso' + (usuarios.length > activos ? ', ' + (usuarios.length - activos) + ' sin acceso' : '') : '';
    if(!usuarios.length){
      $('lista').innerHTML = '<div class="vacio"><b>Todavía no hay usuarios</b><p>Crea la primera cuenta para que tu equipo pueda entrar.</p></div>';
      return;
    }
    $('lista').innerHTML = '<div class="lista">' + usuarios.map((u, i) => {
      const est = !u.activo ? '<span class="chip chip-off">Sin acceso</span>'
        : u.debe_cambiar_pin ? '<span class="chip chip-warn">PIN temporal</span>' : '<span class="chip chip-ok">Activo</span>';
      const rol = S.ROLES[u.rol] || u.rol;
      return '<button type="button" class="persona' + (u.activo ? '' : ' inactiva') + '" data-i="' + i + '">' +
        '<span class="quien"><span class="av" aria-hidden="true">' + esc(iniciales(u.nombre)) + '</span><b>' + esc(u.nombre) + '</b>' +
        '<span class="det"><span class="solo-pc">' + esc(u.usuario) + (u.cargo ? ' · ' + esc(u.cargo) : '') + '</span>' +
        '<span class="solo-tel">' + esc(rol) + ' · ' + esc(u.usuario) + '</span></span></span>' +
        '<span class="solo-pc">' + esc(rol) + '</span>' +
        '<span class="solo-pc">' + esc(EQ[u.equipo] || '') + '</span>' +
        '<span class="solo-pc">' + esc(u.nombre_odoo || 'Sin asignar') + '</span>' +
        '<span class="solo-pc">' + (u.codigo_vendedor ? '#' + esc(u.codigo_vendedor) : '') + '</span>' +
        '<span class="est">' + est + '</span></button>';
    }).join('') + '</div>';
  }

  async function cargar(){
    try {
      const r = await llamar({ accion: 'listar' });
      usuarios = r.usuarios || [];
      pintar();
    } catch (e) {
      $('lista').innerHTML = '<div class="vacio"><b>No se pudo cargar la lista</b><p>' + esc(e.message) + '</p><button type="button" class="btn btn-chico" id="reintentar">Reintentar</button></div>';
      toast(e.message, 'error');
    }
  }

  function limpiarErrores(){ ['eNombre','eUsuarioF','eCodigo','ePin'].forEach((id) => { $(id).textContent = ''; }); }
  function abrir(u){
    editando = u || null;
    limpiarErrores();
    $('tHoja').textContent = u ? 'Editar usuario' : 'Nuevo usuario';
    $('fNombre').value = u ? u.nombre : '';
    $('fUsuario').value = u ? u.usuario : ''; $('fUsuario').disabled = !!u;
    $('fCargo').value = u ? (u.cargo || '') : '';
    $('fRol').value = u ? u.rol : 'lider';
    $('fEquipo').value = u ? u.equipo : 'ventas';
    $('fCodigo').value = u && u.codigo_vendedor ? u.codigo_vendedor : '';
    $('fOdoo').value = u ? (u.nombre_odoo || '') : '';
    $('fPin').value = '';
    $('zonaPin').classList.toggle('hidden', !!u);
    $('form').classList.remove('hidden');
    $('zonaEditar').classList.toggle('hidden', !u);
    $('pinListo').classList.add('hidden'); $('zonaListo').classList.add('hidden');
    desarmar();
    if(u){
      $('alternar').textContent = u.activo ? 'Desactivar' : 'Activar';
      $('alternar').className = 'btn btn-chico ' + (u.activo ? 'btn-peligro' : 'btn-2');
      $('alternar').classList.toggle('hidden', u.id === yo.id);
    }
    abrirHoja('hojaUsuario');
  }

  function leerForm(){
    let ok = true;
    const nombre = $('fNombre').value.trim();
    if(!nombre){ $('eNombre').textContent = 'Escribe el nombre'; ok = false; }
    const usuario = limpiarUsuario($('fUsuario').value);
    if(!editando && usuario.length < 3){ $('eUsuarioF').textContent = $('fUsuario').value.trim() ? 'Usa al menos 3 letras o números' : 'Escribe el usuario para entrar'; ok = false; }
    const cod = $('fCodigo').value.trim();
    if(cod && !/^[1-9]\d?$/.test(cod)){ $('eCodigo').textContent = 'Un número del 1 al 99'; ok = false; }
    const pin = $('fPin').value.trim();
    if(!editando && (!/^\d{6}$/.test(pin) || S.pinFacil(pin))){ $('ePin').textContent = /^\d{6}$/.test(pin) ? 'Ese PIN es muy fácil. Usa Generar' : 'Escribe 6 números o usa Generar'; ok = false; }
    if(!ok) return null;
    return { nombre, usuario, pin, cargo: $('fCargo').value.trim(), rol: $('fRol').value, equipo: $('fEquipo').value,
      codigo_vendedor: cod ? Number(cod) : null, nombre_odoo: $('fOdoo').value.trim() };
  }

  async function guardar(e){
    e.preventDefault();
    limpiarErrores();
    const d = leerForm(); if(!d) return;
    const b = $('guardar'); b.disabled = true; b.textContent = 'Guardando…';
    try {
      if(editando) await llamar(Object.assign({ accion: 'editar', id: editando.id }, d));
      else await llamar(Object.assign({ accion: 'crear' }, d));
      if(editando){ toast('Cambios guardados'); cerrarHoja(); }
      else {
        // El PIN temporal se muestra aquí una sola vez: después ya no se puede ver
        $('form').classList.add('hidden'); $('tHoja').textContent = 'Usuario creado';
        $('pinDe').textContent = 'Usuario: ' + d.usuario; $('pinNuevo').textContent = d.pin;
        $('pinListo').classList.remove('hidden'); $('zonaListo').classList.remove('hidden');
        toast('Usuario creado');
      }
      await cargar();
    } catch (err) {
      const m = err.message || '';
      if(m.includes('usuario ya existe')) $('eUsuarioF').textContent = m;
      else if(m.includes('número de vendedor')) $('eCodigo').textContent = m;
      toast(m, 'error');
    } finally { b.disabled = false; b.textContent = 'Guardar'; }
  }

  // Las acciones delicadas piden un segundo toque para confirmar
  let armado = null; let relojArmado = null;
  function desarmar(){
    clearTimeout(relojArmado);
    if(armado){ armado.textContent = armado.dataset.texto; armado = null; }
  }
  function confirmar(boton, pregunta){
    if(armado === boton){ desarmar(); return true; }
    desarmar();
    armado = boton; boton.dataset.texto = boton.textContent; boton.textContent = pregunta;
    relojArmado = setTimeout(desarmar, 4000);
    return false;
  }
  async function restablecer(){
    if(!editando) return;
    if(!confirmar($('restablecer'), '¿Seguro? Toca otra vez')) return;
    const b = $('restablecer'); b.disabled = true;
    const pin = pinAzar();
    try {
      await llamar({ accion: 'pin', id: editando.id, pin });
      $('pinDe').textContent = 'Usuario: ' + editando.usuario; $('pinNuevo').textContent = pin; $('pinListo').classList.remove('hidden');
      toast('PIN restablecido');
      cargar();
    } catch (err) { toast(err.message, 'error'); }
    finally { b.disabled = false; }
  }
  async function alternar(){
    if(!editando) return;
    if(editando.activo && !confirmar($('alternar'), '¿Seguro? Toca otra vez')) return;
    const b = $('alternar'); b.disabled = true;
    const eraActivo = editando.activo;
    try {
      await llamar({ accion: 'activo', id: editando.id, activo: !editando.activo });
      toast(eraActivo ? 'Acceso desactivado' : 'Acceso activado');
      cerrarHoja();
      await cargar();
    } catch (err) { toast(err.message, 'error'); }
    finally { b.disabled = false; }
  }

  $('nuevo').addEventListener('click', () => abrir(null));
  $('lista').addEventListener('click', (e) => {
    if(e.target.closest('#reintentar')){ $('lista').innerHTML = '<div class="esq"></div><div class="esq"></div>'; cargar(); return; }
    const f = e.target.closest('.persona'); if(f) abrir(usuarios[Number(f.dataset.i)]);
  });
  $('form').addEventListener('submit', guardar);
  $('generar').addEventListener('click', () => { $('fPin').value = pinAzar(); $('ePin').textContent = ''; });
  $('fUsuario').addEventListener('blur', () => { if(!editando) $('fUsuario').value = limpiarUsuario($('fUsuario').value); });
  $('restablecer').addEventListener('click', restablecer);
  $('alternar').addEventListener('click', alternar);
  $('hojaUsuario').addEventListener('hoja-cerrada', () => { editando = null; desarmar(); });

  (async function(){
    yo = await S.requerir(['admin']);
    if(!yo) return;
    cargar();
  })();
})();
