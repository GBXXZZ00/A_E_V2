// Bienvenidas por enviar: instalaciones del corte con dueño (o de aliado) cuya carta no ha salido.
(function(){
  'use strict';
  const { $, esc, ic, rpc, toast, fecha, plural, abrirHoja, esqueleto, vacio, primerNombre } = window.Comun;
  let o = null; let filas = null;
  function hoja(){
    let h = $('hojaBienv');
    if(!h){
      h = document.createElement('section'); h.id = 'hojaBienv'; h.className = 'hoja lado corta';
      h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true'); h.setAttribute('aria-labelledby', 'tBienv'); h.setAttribute('aria-hidden', 'true');
      h.innerHTML = '<div class="asa" aria-hidden="true"></div><div class="ficha-cab"><div class="f-cab"><div class="tx"><h2 class="nom" id="tBienv">Bienvenidas por enviar</h2><p class="dat" id="subBienv">&nbsp;</p></div>' +
        '<button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div></div><div class="ficha-cuerpo" id="cuerpoBienv"></div>';
      document.body.appendChild(h); window.Comun.prepararHojas();
      h.addEventListener('click', (e) => {
        if(e.target.closest('#reintentarBienv')){ cargar(); return; }
        const b = e.target.closest('[data-bienv]'); if(!b) return;
        window.Ficha.abrir(Number(b.dataset.cliente), { yo: o.yo, enviar: Number(b.dataset.bienv), alCerrar: cargar });
      });
      h.addEventListener('hoja-cerrada', () => { const f = o && o.alCerrar; o = null; if(f) f(); });
    }
    return h;
  }
  function pintar(){
    $('subBienv').textContent = filas.length ? plural(filas.length, 'instalación', 'instalaciones') + ' de este corte. Toca una para enviarla' : '';
    $('cuerpoBienv').innerHTML = filas.length ? '<div class="grupo abierto" style="margin-top:12px">' + filas.map((f) =>
      '<button type="button" class="fila" data-bienv="' + esc(f.servicio_id) + '" data-cliente="' + esc(f.cliente_id) + '"><span class="tx"><b>' + esc(f.nombre) + '</b><small>' +
        esc(f.sucursal + '-' + f.codigo) + ' · ' + esc(fecha(f.instalada_en)) + ' · ' + esc(f.aliado ? 'Aliado' : primerNombre(f.lider) || 'Sin líder') + '</small></span>' +
        (f.sin_ip ? '<span class="m ambar">Sin IP</span>' : '') + ic('derecha', 'ch') + '</button>').join('') + '</div>'
      : vacio('Todo enviado', 'No quedan cartas de bienvenida por enviar en este corte.');
  }
  async function cargar(){
    if(!o) return;
    if(!filas) $('cuerpoBienv').innerHTML = esqueleto(5);
    try { filas = (await rpc('bienvenidas_pendientes')) || []; if(o) pintar(); }
    catch (e) { if(!filas) $('cuerpoBienv').innerHTML = '<div class="aviso" role="alert"><b>No se pudo cargar la lista</b><p>' + esc(e.message) + '</p><p style="margin-top:14px"><button type="button" class="btn btn-chico" id="reintentarBienv">Reintentar</button></p></div>'; toast(e.message, 'error'); }
  }
  window.Bienvenidas = { abrir(opciones){ hoja(); o = opciones || {}; filas = null; abrirHoja('hojaBienv'); cargar(); } };
})();
