// Usuarios (solo administrador): crear, editar, restablecer PIN y activar o desactivar.
(function(){
  'use strict';
  const { $, esc, toast, mensajeError, iniciales, normalizeStr, abrirHoja, cerrarHoja, cache, esqueleto, rpc, plural } = window.Comun;
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

  // Lote 27/10: quién tiene los avisos activos en algún equipo (solo lo ve el administrador)
  let AV = null;
  const avisoChip = (u) => !AV ? '' : AV[u.id] ? '<span class="chip verde">Activos' + (AV[u.id].n > 1 ? ' (' + AV[u.id].n + ')' : '') + '</span>' : '<span class="chip gris">Sin activar</span>';
  // Lote 28/10: equipo de comisiones (Ventas corporativas, Canales de atención o Aliado); por defecto sale del rol
  const EQC = { corporativas: 'Ventas corporativas', canales: 'Canales de atención', aliados: 'Aliado' };
  let EQP = null;
  async function cargarEquipos(){ try { EQP = await rpc('perfiles_equipos', {}); pintar(); } catch (e) { EQP = null; toast('No se pudo ver el equipo de cada usuario. ' + e.message, 'error'); } }
  const equipoCom = (u) => { const x = EQP && EQP[u.id]; return x ? (EQC[x.efectivo] || '') + (x.equipo ? '' : ' (por su rol)') : ''; };
  async function cargarAvisos(){ try { AV = await rpc('avisos_activos', {}); pintar(); } catch (e) { AV = null; toast('No se pudo ver quién tiene los avisos activos. ' + e.message, 'error'); } }
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
      const rol = u.gerencia ? 'Gerencia (solo lectura)' : u.rol === 'analista' && u.senior ? 'Analista Senior' : u.rol === 'analista' && u.coordinador ? 'Coordinador de analistas' : (S.ROLES[u.rol] || u.rol);
      return '<button type="button" class="persona' + (u.activo ? '' : ' inactiva') + '" data-i="' + i + '">' +
        '<span class="quien"><span class="av" aria-hidden="true">' + esc(iniciales(u.nombre)) + '</span><b>' + esc(u.nombre) + '</b>' +
        '<span class="det"><span class="solo-pc">' + esc(u.usuario) + (u.cargo ? ' · ' + esc(u.cargo) : '') + '</span>' +
        '<span class="solo-tel">' + esc(rol) + ' · ' + esc(u.usuario) + (AV && u.activo ? ' · ' + (AV[u.id] ? 'avisos activos' : 'sin avisos') : '') + '</span></span></span>' +
        '<span class="solo-pc">' + esc(rol) + '</span>' +
        '<span class="solo-pc">' + esc(EQ[u.equipo] || '') + '</span>' +
        '<span class="solo-pc">' + esc(['lider', 'analista'].indexOf(u.rol) >= 0 && !u.gerencia ? equipoCom(u) : '') + '</span>' +
        '<span class="solo-pc">' + esc(u.nombre_odoo || 'Sin asignar') + '</span>' +
        '<span class="solo-pc">' + (u.codigo_vendedor ? '#' + esc(u.codigo_vendedor) : '') + '</span>' +
        '<span class="solo-pc">' + avisoChip(u) + '</span>' +
        '<span class="est">' + est + '</span></button>';
    }).join('') + '</div>';
  }

  // Primero se pinta lo último que se vio (o filas grises) y después llega lo nuevo
  async function cargar(){
    const guardado = cache.leer('usuarios');
    if(!usuarios.length){
      if(guardado && guardado.length){ usuarios = guardado; pintar(); $('resumen').innerHTML = '<span class="cargando-linea"><i></i>Actualizando la lista</span>'; }
      else { $('resumen').innerHTML = '<span class="cargando-linea"><i></i>Cargando la lista</span>'; $('lista').innerHTML = '<div class="lista">' + esqueleto(5) + '</div>'; }
    }
    try {
      const r = await llamar({ accion: 'listar' });
      usuarios = r.usuarios || [];
      cache.guardar('usuarios', usuarios);
      pintar(); cargarAvisos(); cargarEquipos();
    } catch (e) {
      if(guardado && guardado.length){ pintar(); }
      else { $('resumen').textContent = ''; $('lista').innerHTML = '<div class="vacio"><b>No se pudo cargar la lista</b><p>' + esc(e.message) + '</p><button type="button" class="btn btn-chico" id="reintentar">Reintentar</button></div>'; }
      toast(e.message, 'error');
    }
  }

  function limpiarErrores(){ ['eNombre','eUsuarioF','eCodigo','ePin','eWhatsapp','eCorreo','eEquipoCom'].forEach((id) => { $(id).textContent = ''; }); }
  function abrir(u){
    editando = u || null;
    limpiarErrores();
    $('tHoja').textContent = u ? 'Editar usuario' : 'Nuevo usuario';
    $('fNombre').value = u ? u.nombre : '';
    $('fUsuario').value = u ? u.usuario : ''; $('fUsuario').disabled = !!u;
    $('fCargo').value = u ? (u.cargo || '') : '';
    $('fRol').value = u ? (u.gerencia ? 'gerencia' : u.rol === 'analista' && u.senior ? 'analista_senior' : u.rol === 'analista' && u.coordinador ? 'analista_coord' : u.rol) : 'lider';
    $('fWhatsapp').value = u ? (u.whatsapp || '') : ''; $('fCorreo').value = u ? (u.correo || '') : '';
    $('fEquipo').value = u ? u.equipo : 'ventas';
    $('fEquipoCom').value = u && EQP && EQP[u.id] ? (EQP[u.id].equipo || '') : '';
    zonaAnalista(u);
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
    const wa = $('fWhatsapp').value.replace(/\D/g, '');
    if(wa && (wa.length < 10 || wa.length > 15)){ $('eWhatsapp').textContent = 'Escribe el número completo, con el código del operador'; ok = false; }
    const correo = $('fCorreo').value.trim().toLowerCase();
    if(correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)){ $('eCorreo').textContent = 'Ese correo no parece válido'; ok = false; }
    if(!ok) return null;
    const rolForm = $('fRol').value;
    return { nombre, usuario, pin, cargo: $('fCargo').value.trim(), rol: rolForm === 'analista_senior' || rolForm === 'analista_coord' ? 'analista' : rolForm, senior: rolForm === 'analista_senior', coordinador: rolForm === 'analista_coord', whatsapp: wa, correo, equipo: $('fEquipo').value,
      codigo_vendedor: cod ? Number(cod) : null, nombre_odoo: $('fOdoo').value.trim() };
  }

  let LA = null;   // { lideres: {id: analista}, analistas: [...] }
  async function zonaAnalista(u){
    const z = $('zonaAnalista'); const es = !!u && $('fRol').value === 'lider'; z.classList.toggle('hidden', !es); $('eAnalista').textContent = '';
    if(!es) return;
    if(!LA){ try { LA = await window.Comun.rpc('lideres_analistas', {}); } catch (e) { $('eAnalista').textContent = e.message; return; } }
    const v = LA.lideres[u.id] || '';
    $('fAnalista').innerHTML = '<option value="">' + (LA.analistas.length ? 'Sin analista' : 'No hay analistas todavía') + '</option>' + LA.analistas.map((a) => '<option value="' + window.Comun.esc(a.id) + '"' + (a.id === v ? ' selected' : '') + '>' + window.Comun.esc(a.nombre) + '</option>').join('');
  }
  async function guardar(e){
    e.preventDefault();
    limpiarErrores();
    const d = leerForm(); if(!d) return;
    const b = $('guardar'); b.disabled = true; b.textContent = 'Guardando…';
    try {
      let r = null;
      if(editando){
        r = await llamar(Object.assign({ accion: 'editar', id: editando.id }, d));
        // Lote 6: el analista del líder (le llegan los pendientes de sus clientes)
        if(d.rol === 'lider' && LA && $('fAnalista').value !== (LA.lideres[editando.id] || '')){
          try { await window.Comun.rpc('lider_analista', { p_lider: editando.id, p_analista: $('fAnalista').value || null }); LA.lideres[editando.id] = $('fAnalista').value || null; }
          catch (x) { $('eAnalista').textContent = x.message; b.disabled = false; b.textContent = 'Guardar'; return; }
        }
        const eq = $('fEquipoCom').value || null;
        const eqAntes = EQP ? ((EQP[editando.id] || {}).equipo || null) : undefined;   // sin la lista de equipos, se guarda si eligió uno
        if(eqAntes !== eq && !(eqAntes === undefined && eq === null)){
          try { await rpc('perfil_equipo_guardar', { p_perfil: editando.id, p_equipo: eq }); EQP = null; cargarEquipos(); }   // el equipo efectivo lo calcula el servidor
          catch (x) { $('eEquipoCom').textContent = x.message; b.disabled = false; b.textContent = 'Guardar'; return; }
        }
      }
      else r = await llamar(Object.assign({ accion: 'crear' }, d));
      // Un líder nuevo o editado se queda con los clientes que tienen su nombre y no tenían cuenta
      const enl = r && r.enlazados > 0 ? '. ' + plural(r.enlazados, 'cliente enlazado', 'clientes enlazados') + ' a su cuenta' : '';
      if(editando){ toast('Cambios guardados' + enl); cerrarHoja(); }
      else {
        // El PIN temporal se muestra aquí una sola vez: después ya no se puede ver
        $('form').classList.add('hidden'); $('tHoja').textContent = 'Usuario creado';
        $('pinDe').textContent = 'Usuario: ' + d.usuario; $('pinNuevo').textContent = d.pin;
        $('pinListo').classList.remove('hidden'); $('zonaListo').classList.remove('hidden');
        toast('Usuario creado' + enl);
      }
      await cargar();
    } catch (err) {
      const m = err.message || '';
      if(m.includes('usuario ya existe')) $('eUsuarioF').textContent = m;
      else if(m.includes('número de vendedor')) $('eCodigo').textContent = m;
      else if(m.includes('WhatsApp')) $('eWhatsapp').textContent = m;
      else if(m.includes('correo')) $('eCorreo').textContent = m;
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
      const rp = await llamar({ accion: 'pin', id: editando.id, pin });
      $('pinDe').textContent = 'Usuario: ' + editando.usuario; $('pinNuevo').textContent = pin; $('pinListo').classList.remove('hidden');
      // Lote S: si no se pudieron cerrar sus sesiones abiertas, se dice
      if(rp && rp.aviso) toast('PIN restablecido. ' + rp.aviso, 'error'); else toast('PIN restablecido');
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
      const r = await llamar({ accion: 'activo', id: editando.id, activo: !editando.activo });
      if(r && r.aviso) toast(r.aviso, 'error');
      else toast((eraActivo ? 'Acceso desactivado' : 'Acceso activado') + (r && r.enlazados > 0 ? '. ' + plural(r.enlazados, 'cliente enlazado', 'clientes enlazados') + ' a su cuenta' : ''));
      cerrarHoja();
      await cargar();
    } catch (err) { toast(err.message, 'error'); }
    finally { b.disabled = false; }
  }

  $('nuevo').addEventListener('click', () => abrir(null));
  $('lista').addEventListener('click', (e) => {
    if(e.target.closest('#reintentar')){ usuarios = []; cargar(); return; }
    const f = e.target.closest('.persona'); if(f) abrir(usuarios[Number(f.dataset.i)]);
  });
  $('form').addEventListener('submit', guardar);
  $('generar').addEventListener('click', () => { $('fPin').value = pinAzar(); $('ePin').textContent = ''; });
  $('fUsuario').addEventListener('blur', () => { if(!editando) $('fUsuario').value = limpiarUsuario($('fUsuario').value); });
  [['fWhatsapp', 'eWhatsapp'], ['fCorreo', 'eCorreo']].forEach((x) => $(x[0]).addEventListener('input', () => { $(x[1]).textContent = ''; }));
  $('restablecer').addEventListener('click', restablecer);
  $('alternar').addEventListener('click', alternar);
  $('hojaUsuario').addEventListener('hoja-cerrada', () => { editando = null; desarmar(); });

  // ---------- Quienes crean órdenes por otros (por su nombre en Odoo) ----------
  let creadores = null;
  async function cargarCreadores(){
    const z = $('listaCreadores');
    if(!creadores){ const g = cache.leer('creadores'); if(g){ creadores = g; pintarCreadores(); } else z.innerHTML = '<div class="lista">' + esqueleto(3) + '</div>'; }
    try { creadores = await rpc('creadores_odoo'); cache.guardar('creadores', creadores); pintarCreadores(); }
    catch (e) { if(!creadores) z.innerHTML = '<div class="vacio"><b>No se pudo cargar</b><p>' + esc(e.message) + '</p><button type="button" class="btn btn-chico" id="reintentarCreadores">Reintentar</button></div>'; toast(e.message, 'error'); }
  }
  function pintarCreadores(){
    const z = $('listaCreadores');
    if(!creadores.length){ z.innerHTML = '<div class="vacio"><b>Sin órdenes recientes</b><p>Cuando cargues Odoo en Actualizar, aquí salen quienes crean las órdenes.</p></div>'; return; }
    z.innerHTML = '<div class="lista">' + creadores.map((c) => '<div class="interr"><span class="tx">' + esc(c.nombre) + '<small>' + (c.ordenes ? c.ordenes + (c.ordenes === 1 ? ' orden' : ' órdenes') + ' en 120 días' : 'Sin órdenes recientes') + '</small></span>' +
      '<button type="button" class="sw" role="switch" aria-checked="' + !!c.marcado + '" data-creador="' + esc(c.nombre) + '" aria-label="' + esc(c.nombre) + ' crea órdenes por otros"></button></div>').join('') + '</div>';
  }
  document.addEventListener('click', async (e) => {
    if(e.target.closest('#reintentarCreadores')){ cargarCreadores(); return; }
    const b = e.target.closest('[data-creador]'); if(!b || b.disabled) return;
    const valor = b.getAttribute('aria-checked') !== 'true'; b.disabled = true;
    try {
      await rpc('creador_por_otros', { p_nombre: b.dataset.creador, p_valor: valor });
      const c = creadores.find((x) => x.nombre === b.dataset.creador); if(c) c.marcado = valor;
      b.setAttribute('aria-checked', String(valor)); cache.guardar('creadores', creadores);
      toast(valor ? 'Marcado. Sus órdenes sin código quedan por asignar' : 'Quitado. Sus órdenes vuelven a asignarse solas');
    } catch (err) { toast(err.message, 'error'); }
    b.disabled = false;
  });

  window.Armazon.arrancar(['admin'], { activo: null, volver: { enlace: 'inicio.html', texto: 'Inicio' } }, (p) => { yo = p; cargar(); cargarCreadores(); }, (p) => { yo = p; });
  // Todo líder ve sus clientes, sean PYME, dedicados o combinados: ya no hay marca de "Líder de dedicados"
  $('fRol').addEventListener('change', () => zonaAnalista(editando));
})();
