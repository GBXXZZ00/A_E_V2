// Pantalla de acceso: equipo (solo la primera vez), usuario y PIN. También el cambio de PIN.
(function(){
  'use strict';
  const { $, toast, mensajeError } = window.Comun;
  const S = window.Sesion;
  const pasos = ['pasoEquipo', 'pasoUsuario', 'pasoPin'];
  let equipo = null;       // 'ventas' | 'aliados'
  let usuario = '';        // el que se escribió o el recordado
  let modo = 'entrar';     // 'entrar' | 'actual' | 'nuevo1' | 'nuevo2'
  let voluntario = false;  // cambio de PIN pedido desde Inicio
  let pin = '';
  let primerPin = '';
  let ocupado = false;
  let pinActual = '';

  function ver(id){ pasos.forEach((p) => $(p).classList.toggle('hidden', p !== id)); }
  function pie(texto, accion){
    const b = $('enlacePie');
    b.classList.toggle('hidden', !texto);
    b.textContent = texto || '';
    b.dataset.accion = accion || '';
  }
  function primerNombre(n){ return String(n || '').trim().split(/\s+/)[0] || ''; }
  function capital(t){ return t ? t.charAt(0).toUpperCase() + t.slice(1) : ''; }

  // ---------- Paso 1: equipo ----------
  function pasoEquipo(){
    ver('pasoEquipo'); pie('', '');
  }
  $('equipos').addEventListener('click', (e) => {
    const b = e.target.closest('.equipo'); if(!b) return;
    equipo = b.dataset.equipo; S.guardarEquipo(equipo);
    pasoUsuario();
  });

  // ---------- Paso 2: usuario ----------
  function pasoUsuario(){
    $('chipUsuario').textContent = S.EQUIPOS[equipo];
    $('eUsuario').textContent = '';
    ver('pasoUsuario'); pie('Cambiar de equipo', 'equipo');
    if(window.matchMedia('(pointer:fine)').matches) $('usuario').focus();
  }
  function seguir(){
    const u = window.Comun.normalizeStr($('usuario').value).replace(/[^a-z0-9]/g, '');
    if(u.length < 3){ $('eUsuario').textContent = 'Escribe tu usuario'; $('usuario').focus(); return; }
    usuario = u;
    pasoPin({ nombre: capital(u), cargo: '' });
  }
  $('seguir').addEventListener('click', seguir);
  $('usuario').addEventListener('keydown', (e) => { if(e.key === 'Enter') seguir(); });
  $('usuario').addEventListener('input', () => { $('eUsuario').textContent = ''; });

  // ---------- Paso 3: PIN ----------
  const teclado = $('teclado');
  ['1','2','3','4','5','6','7','8','9','','0','Borrar'].forEach((k) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tecla' + (k === '' ? ' vacia' : k === 'Borrar' ? ' borrar' : '');
    b.textContent = k; b.dataset.k = k;
    if(k === ''){ b.tabIndex = -1; b.setAttribute('aria-hidden', 'true'); }
    teclado.appendChild(b);
  });
  function pintar(){
    Array.prototype.forEach.call($('puntos').children, (i, n) => i.classList.toggle('on', n < pin.length));
    Array.prototype.forEach.call($('casillas').children, (i, n) => { i.classList.toggle('on', n < pin.length); i.classList.toggle('act', n === pin.length); });
    if($('pinCampo').value !== pin) $('pinCampo').value = pin;
  }
  function estado(texto, neutro){
    const e = $('estadoPin'); e.textContent = texto || ''; e.classList.toggle('neutro', !!neutro);
  }
  function bloquear(si){ ocupado = si; $('pasoPin').classList.toggle('ocupado', si); $('pinCampo').disabled = si; }
  function fallar(texto){
    pin = ''; pintar(); estado(texto);
    const z = window.matchMedia('(min-width:900px)').matches ? $('casillas') : $('puntos');
    z.classList.remove('sacudir'); void z.offsetWidth; z.classList.add('sacudir');
    enfocarPin();
  }
  function enfocarPin(){ if(window.matchMedia('(min-width:900px)').matches && !ocupado) $('pinCampo').focus(); }
  function ponerPin(v){
    if(ocupado) return;
    pin = String(v).replace(/\D/g, '').slice(0, 6);
    if(pin.length) estado('');
    pintar();
    if(pin.length === 6) alCompletar(pin);
  }
  teclado.addEventListener('click', (e) => {
    const b = e.target.closest('.tecla'); if(!b || !b.dataset.k) return;
    ponerPin(b.dataset.k === 'Borrar' ? pin.slice(0, -1) : pin + b.dataset.k);
  });
  $('pinCampo').addEventListener('input', (e) => ponerPin(e.target.value));

  function pasoPin(quien){
    modo = 'entrar'; pin = ''; primerPin = '';
    $('chipPin').textContent = S.EQUIPOS[equipo]; $('chipPin').classList.remove('hidden');
    $('tPin').textContent = 'Hola, ' + (primerNombre(quien.nombre) || capital(usuario));
    $('cargo').textContent = quien.cargo || ''; $('cargo').classList.toggle('hidden', !quien.cargo);
    $('subPin').textContent = 'Escribe tu PIN de 6 números.';
    estado(''); bloquear(false); pintar();
    ver('pasoPin'); pie('Entrar con otro usuario', 'otro');
    enfocarPin();
  }
  // Cambio pedido desde Inicio: primero se confirma el PIN actual
  function pasoPinActual(){
    modo = 'actual'; pin = ''; primerPin = '';
    $('chipPin').classList.add('hidden'); $('cargo').classList.add('hidden');
    $('tPin').textContent = 'Tu PIN actual'; $('subPin').textContent = 'Escríbelo para poder cambiarlo.';
    estado(''); bloquear(false); pintar();
    ver('pasoPin'); pie('Volver al inicio', 'inicio');
    enfocarPin();
  }
  function pasoNuevoPin(){
    modo = 'nuevo1'; pin = ''; primerPin = '';
    $('chipPin').classList.add('hidden'); $('cargo').classList.add('hidden');
    $('tPin').textContent = voluntario ? 'Nuevo PIN' : 'Crea tu PIN nuevo';
    $('subPin').textContent = voluntario ? 'Escribe 6 números que solo tú sepas.' : 'El que tienes es temporal. Escribe 6 números que solo tú sepas.';
    estado(''); bloquear(false); pintar();
    ver('pasoPin'); pie(voluntario ? 'Volver al inicio' : 'Salir', voluntario ? 'inicio' : 'salir');
    enfocarPin();
  }

  async function alCompletar(valor){
    if(modo === 'entrar') return entrar(valor);
    if(modo === 'actual'){
      bloquear(true); estado('Comprobando…', true);
      try { await S.verificarPin(usuario, valor); pinActual = valor; return pasoNuevoPin(); }
      catch (e) {
        bloquear(false);
        const m = String((e && e.message) || '').toLowerCase();
        return fallar(m.includes('invalid') ? 'Ese no es tu PIN actual' : mensajeError(e, 'No se pudo comprobar. Intenta de nuevo'));
      }
    }
    if(modo === 'nuevo1'){
      if(valor === pinActual) return fallar('Ese ya es tu PIN actual. Elige otro');
      if(S.pinFacil(valor)) return fallar('Ese PIN es muy fácil. Elige otro');
      primerPin = valor; modo = 'nuevo2'; pin = ''; pintar();
      $('tPin').textContent = 'Repite tu PIN nuevo'; $('subPin').textContent = 'Para confirmar que lo escribiste bien.';
      return;
    }
    if(valor !== primerPin){
      modo = 'nuevo1'; primerPin = '';
      $('tPin').textContent = voluntario ? 'Nuevo PIN' : 'Crea tu PIN nuevo'; $('subPin').textContent = 'Escribe 6 números que solo tú sepas.';
      return fallar('No coinciden. Empieza de nuevo');
    }
    bloquear(true); estado('Guardando…', true);
    try {
      await S.cambiarPin(valor);
      toast('Listo, tu PIN cambió');
      setTimeout(() => location.replace('inicio.html'), 700);
    } catch (e) {
      bloquear(false);
      const m = String((e && e.message) || '').toLowerCase();
      modo = 'nuevo1'; primerPin = '';
      $('tPin').textContent = voluntario ? 'Nuevo PIN' : 'Crea tu PIN nuevo';
      fallar(m.includes('same') || m.includes('different') ? 'Ese ya es tu PIN actual. Elige otro' : mensajeError(e, 'No se pudo cambiar. Intenta de nuevo'));
    }
  }

  async function entrar(valor){
    bloquear(true); estado('Entrando…', true);
    let dentro = false;
    try {
      await S.entrar(usuario, valor); dentro = true;
      const p = await S.perfil(true);
      if(!p || !p.activo){ await S.salir(); bloquear(false); return fallar('Tu cuenta está desactivada. Habla con el administrador'); }
      if(!S.puedeEntrar(p, equipo)){
        await S.salir(); bloquear(false);
        return fallar('Tu usuario entra por ' + S.EQUIPOS[p.equipo] + '. Cambia de equipo');
      }
      S.guardarUsuario(p);
      if(p.debe_cambiar_pin){ voluntario = false; pinActual = valor; return pasoNuevoPin(); }
      location.replace('inicio.html');
    } catch (e) {
      // Si el PIN era bueno pero falló lo que sigue, no se deja una sesión a medias
      if(dentro) await S.salir();
      bloquear(false);
      const m = String((e && e.message) || '').toLowerCase();
      if(m.includes('invalid login') || m.includes('invalid_credentials')) return fallar('Usuario o PIN incorrecto');
      if(m.includes('banned')) return fallar('Tu cuenta está desactivada. Habla con el administrador');
      if(m.includes('rate limit') || (e && e.status === 429)) return fallar('Demasiados intentos. Espera un momento');
      fallar(mensajeError(e, 'No se pudo entrar. Intenta de nuevo'));
    }
  }

  // ---------- Enlace del pie ----------
  $('enlacePie').addEventListener('click', async (e) => {
    const a = e.currentTarget.dataset.accion;
    if(a === 'equipo') return pasoEquipo();
    if(a === 'otro'){ S.guardarUsuario(null); usuario = ''; $('usuario').value = ''; return pasoUsuario(); }
    if(a === 'inicio') return location.replace('inicio.html');
    if(a === 'salir'){ await S.salir(); arrancar(); }
  });

  // ---------- Arranque ----------
  async function arrancar(){
    if(!window.db){ pasoEquipo(); toast('No se pudo cargar la app. Revisa tu internet y recarga', 'error'); return; }
    equipo = S.equipoGuardado();
    let p = null;
    try { p = await S.perfil(true); } catch (e) { p = null; }
    if(p && p.activo){
      usuario = p.usuario;
      if(p.debe_cambiar_pin){ voluntario = false; return pasoNuevoPin(); }
      if(location.hash === '#cambiar'){ voluntario = true; return pasoPinActual(); }
      return location.replace('inicio.html');
    }
    if(!equipo) return pasoEquipo();
    const u = S.usuarioGuardado();
    if(u){ usuario = u.usuario; return pasoPin(u); }
    pasoUsuario();
  }
  arrancar();
})();
