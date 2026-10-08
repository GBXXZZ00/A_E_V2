// Contacto con el cliente: hoja para pedir o recordar documentos por WhatsApp o correo, y botones rápidos.
// Cada contacto queda anotado en el hilo del cliente.
(function(){
  'use strict';
  const { $, esc, ic, rpc, toast, lista, enlaceWa, enlaceTel, enlaceCorreo, telWa, devueltoFrase, abrirHoja, cerrarHoja, prepararHojas } = window.Comun;
  let actual = null;   // { cliente, yo, motivo, canal, alHacer }

  function saludo(){ const h = new Date().getHours(); return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'; }
  function motivoDe(c){
    const f = c.falta || [];
    if(c.estatus === 'por_firmar' || c.estatus === 'contrato_en_curso') return 'firma';
    if(c.estatus === 'grandes_negocios' && !f.some((x) => x.e === 'devuelto')) return 'pedir';
    return 'recordar';
  }
  // Texto que se propone. La persona lo puede cambiar antes de enviarlo.
  function mensaje(c, yo, motivo){
    const f = c.falta || []; const quien = saludo() + '. Le escribe ' + yo + ', de Airtek. ';
    const dev = f.filter((x) => x.e === 'devuelto'); const fal = f.filter((x) => x.e === 'falta').map((x) => x.dato ? (x.k === 'telefono' ? 'un número de contacto' : x.k === 'correo' ? 'un correo' : 'el ' + x.t) : 'su ' + x.t + (x.k === 'rif_personal' || x.k === 'rif_empresa' ? ' vigente' : ''));
    if(motivo === 'firma') return quien + 'Su contrato de servicio está listo. Le agradecemos firmarlo y enviarlo por esta vía para completar su expediente. Gracias.';
    if(dev.length){
      return quien + 'Revisamos sus documentos y necesitamos que nos envíe de nuevo: ' + lista(dev.map(conMotivo)) + '.' +
        (fal.length ? ' También nos falta ' + lista(fal) + '.' : '') + ' Puede enviarlos por aquí. Gracias.';
    }
    if(!fal.length) return quien + 'Queremos confirmar con usted los datos de su servicio. Gracias.';
    if(motivo === 'recordar') return quien + 'Le recordamos que para formalizar su servicio todavía necesitamos ' + lista(fal) + '. Puede enviarlos por aquí. Gracias.';
    return quien + 'Para formalizar su servicio necesitamos ' + lista(fal) + '. Puede enviarlos por aquí. Gracias.';
  }

  // "el acta constitutiva (está vencida)"
  function conMotivo(x){
    const fem = x.k === 'cedula' || x.k === 'acta_constitutiva' || x.k === 'acta_asamblea';
    const art = x.k === 'cedula' ? 'la ' : 'el ';
    const m = { vencido: fem ? 'está vencida' : 'está vencido', ilegible: 'no se lee bien o llegó ' + (fem ? 'incompleta' : 'incompleto'), no_corresponde: 'no corresponde a este cliente', falta_firma: 'le falta firma o sello' }[x.m];
    return art + x.t + (m ? ' (' + m + ')' : '');
  }

  function hoja(){
    let h = $('hojaPedir');
    if(!h){
      h = document.createElement('section'); h.id = 'hojaPedir'; h.className = 'hoja';
      h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true'); h.setAttribute('aria-labelledby', 'tPedir'); h.setAttribute('aria-hidden', 'true');
      document.body.appendChild(h); prepararHojas();
      h.addEventListener('click', alTocar);
      h.addEventListener('input', (e) => { if(e.target.id === 'pedirMsj') enlace(); });
    }
    return h;
  }
  function enlace(){
    if(!actual) return;
    const c = actual.cliente; const t = $('pedirMsj').value.trim(); const a = $('pedirIr');
    if(actual.canal === 'whatsapp'){
      a.href = enlaceWa(c.tel, t); a.innerHTML = ic('wa') + 'Abrir WhatsApp';
      $('pedirAyuda').textContent = telWa(c.tel) ? 'Se abre el chat con ' + c.tel + '.' : 'No hay teléfono guardado: WhatsApp te deja elegir el contacto.';
    } else {
      a.href = c.correo ? enlaceCorreo(c.correo, 'Documentos para su servicio Airtek', t) : '#';
      a.innerHTML = ic('correo') + 'Abrir el correo';
      $('pedirAyuda').textContent = c.correo ? 'Se abre un correo para ' + c.correo + '.' : 'Este cliente no tiene correo guardado. Usa WhatsApp o agrégalo en Documentos.';
    }
    a.classList.toggle('btn-2', actual.canal === 'correo' && !c.correo);
  }
  function pintar(){
    const { cliente: c, motivo } = actual; const f = c.falta || [];
    const titulo = motivo === 'firma' ? 'Recordar la firma' : motivo === 'pedir' ? 'Pedir documentos' : 'Recordar al cliente';
    hoja().innerHTML =
      '<div class="cab"><div><h2 id="tPedir">' + titulo + '</h2><p class="sub-hoja">' + esc(c.nombre) + (c.es_natural ? ' · Persona natural' : '') + '</p></div>' +
        '<button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div>' +
      '<div class="selector" role="tablist" aria-label="Por dónde"><button type="button" role="tab" data-canal="whatsapp" class="' + (actual.canal === 'whatsapp' ? 'on' : '') + '" aria-selected="' + (actual.canal === 'whatsapp') + '">' + ic('wa', 'ch') + 'WhatsApp</button>' +
        '<button type="button" role="tab" data-canal="correo" class="' + (actual.canal === 'correo' ? 'on' : '') + '" aria-selected="' + (actual.canal === 'correo') + '">' + ic('correo', 'ch') + 'Correo</button></div>' +
      (f.length && motivo !== 'firma' ? '<span class="rotulo arriba">Le falta</span><div class="chips-fila" id="pedirFalta">' +
        f.map((x) => '<span class="chip ' + (x.e === 'devuelto' ? 'rojo' : '') + '">' + esc(window.Comun.capital(x.e === 'devuelto' ? devueltoFrase(x.t, x.k, x.m) : x.t)) + '</span>').join('') + '</div>' : '') +
      '<label class="rotulo arriba" for="pedirMsj">Mensaje</label>' +
      '<textarea class="area" id="pedirMsj" maxlength="900" data-foco>' + esc(mensaje(c, actual.yo, motivo)) + '</textarea>' +
      '<p class="nota" id="pedirAyuda"></p>' +
      '<div class="acciones"><a class="btn btn-ancho" id="pedirIr" href="#" target="_blank" rel="noopener"></a></div>' +
      '<p class="pie-nota">' + (motivo === 'pedir' ? 'Al abrirlo pasa a Documentos solicitados y queda en el hilo.' : 'Al abrirlo queda anotado en el hilo.') + '</p>';
    enlace();
  }
  function alTocar(e){
    const b = e.target.closest('[data-canal]');
    if(b){ actual.canal = b.dataset.canal; const t = $('pedirMsj').value; pintar(); $('pedirMsj').value = t; enlace(); return; }
    const ir = e.target.closest('#pedirIr'); if(!ir || actual.enviado) return;
    if(actual.canal === 'correo' && !actual.cliente.correo){ e.preventDefault(); toast('Este cliente no tiene correo guardado', 'error'); return; }
    // El enlace se abre solo; aquí se deja el registro sin esperar para no frenar a la persona
    const a = actual; a.enviado = true;
    rpc('cliente_contacto', { p_cliente: a.cliente.id, p_canal: a.canal, p_motivo: a.motivo })
      .then((estatus) => { if(a.alHacer) a.alHacer(estatus); })
      .catch((err) => toast('No se pudo anotar el contacto. ' + err.message, 'error'));
    toast(a.motivo === 'pedir' ? 'Anotado. Pasa a Documentos solicitados' : 'Anotado en el hilo');
    setTimeout(cerrarHoja, 80);
  }

  // cliente: { id, nombre, es_natural, estatus, falta, tel, correo }
  function abrir(cliente, opciones){
    const o = opciones || {};
    actual = { cliente, yo: o.yo || '', motivo: o.motivo || motivoDe(cliente), canal: 'whatsapp', alHacer: o.alHacer || null };
    pintar(); abrirHoja('hojaPedir');
  }

  // Tres botones de contacto rápido. Cada toque queda anotado.
  function iconos(c){
    const wa = telWa(c.tel) ? enlaceWa(c.tel) : ''; const tel = enlaceTel(c.tel); const co = c.correo ? enlaceCorreo(c.correo) : '';
    const uno = (canal, clase, icono, href, rotulo) => href
      ? '<a class="ib ' + clase + '" href="' + esc(href) + '"' + (canal === 'whatsapp' ? ' target="_blank" rel="noopener"' : '') + ' data-contacto="' + canal + '" data-cliente="' + esc(c.id) + '" aria-label="' + rotulo + '">' + ic(icono) + '</a>'
      : '<button type="button" class="ib sin" data-sin="' + (canal === 'correo' ? 'correo' : 'teléfono') + '" aria-label="' + rotulo + ' (sin dato)">' + ic(icono) + '</button>';
    return uno('whatsapp', 'wa', 'wa', wa, 'WhatsApp') + uno('llamada', '', 'tel', tel, 'Llamar') + uno('correo', '', 'correo', co, 'Correo');
  }
  let alContactar = null; const reciente = {};
  document.addEventListener('click', (e) => {
    const s = e.target.closest('[data-sin]'); if(s){ toast('Este cliente no tiene ' + s.dataset.sin + ' guardado', 'error'); return; }
    const a = e.target.closest('[data-contacto]'); if(!a) return;
    const clave = a.dataset.cliente + ':' + a.dataset.contacto; const ahora = Date.now();
    if(reciente[clave] && ahora - reciente[clave] < 4000) return;   // dos toques seguidos cuentan como uno
    reciente[clave] = ahora;
    rpc('cliente_contacto', { p_cliente: Number(a.dataset.cliente), p_canal: a.dataset.contacto, p_motivo: 'contacto' })
      .then(() => { if(alContactar) alContactar(Number(a.dataset.cliente)); }).catch((err) => toast('No se pudo anotar el contacto. ' + err.message, 'error'));
  });

  window.Pedir = { abrir, iconos, motivoDe, mensaje, alContactar: (f) => { alContactar = f; } };
})();
