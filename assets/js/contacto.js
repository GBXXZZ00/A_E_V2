// Lote A (21/10): "Contactar al responsable". Un solo botón que va a quien tiene el paso que falta (lo decide la base,
// public.contacto_destino): el aliado solo contacta al administrador; si el paso es del administrador, a él; si el paso es
// de quien mira, no sale (le toca su acción); si faltan cosas de dos personas, el administrador elige.
// Abre WhatsApp con el mensaje escrito según el caso (o el correo si no tiene WhatsApp) y queda en la bitácora.
(function(){
  'use strict';
  const { esc, ic, rpc, toast, primerNombre, enlaceWa, enlaceCorreo, casilla, fecha } = window.Comun;
  const ROL = { admin: 'administrador', lider: 'líder', analista: 'analista', abogado: 'Legal' };

  // Mensaje ya escrito: siempre se puede cambiar en WhatsApp antes de enviarlo
  function mensaje(d, p){
    const n = primerNombre(p.nombre) || ''; const c = d.cliente || 'el cliente'; const det = d.detalle || {};
    const cierra = det.cierra ? ' Cierra el corte el ' + fecha(det.cierra) + '.' : '';
    const dev = (det.devueltos || []).map((x) => casilla(x.casilla, x.numero).toLowerCase() + (x.motivo ? ' (' + x.motivo + ')' : '')).join(', ');
    const t = {
      docs_revisar: '¿me revisas los documentos de ' + c + '? Ya están en la app.',
      docs_faltan: 'a ' + c + ' le ' + (det.faltan > 1 ? 'faltan ' + det.faltan + ' documentos' : 'falta un documento') + ' en la app. ¿Me ayudas a conseguirlos?',
      devuelto: 'a ' + c + ' le devolvieron ' + (dev || 'documentos') + '. Hay que subirlos de nuevo.',
      contrato: '¿cómo va el contrato de ' + c + '?',
      firma: 'el contrato de ' + c + ' está listo para firmar. ¿Cuándo lo firman?',
      general: 'te escribo por ' + c + '.',
      cambio_revisar: '¿me revisas los documentos del cambio de ' + c + '?',
      cambio_emitir: 'el cambio de ' + c + ' ya está aprobado. Falta cargarlo en Proham (plan y categoría a la vez).',
      falta_plan: 'en el cambio de ' + c + ' falta cambiar el plan en Proham.',
      falta_categoria: 'en el cambio de ' + c + ' falta cambiar la categoría en Proham.',
      cambio_tad: 'el cambio de ' + c + ' ya está emitido; falta que salga en el TAD.',
      cambio_registro: 'el cambio de ' + c + ' salió en el TAD y no tiene registro en la app. ¿Lo revisas?',
      cambio_listo: 'te escribo por el cambio de ' + c + '.',
      com_pago: 'a ' + c + ' le falta el pago para comisionar.' + cierra,
      com_orden: 'a ' + c + ' le falta la orden para comisionar.' + cierra,
      com_general: 'te escribo por la comisión de ' + c + '.',
      aliado: 'te escribo por ' + c + '.'
    }[d.motivo];
    const legal = /^com_legal_/.test(d.motivo) ? 'a ' + c + ' le falta Legal para comisionar.' + cierra : '';
    return 'Hola ' + n + ', ' + (t || legal || 'te escribo por ' + c + '.');
  }
  function enlace(d, p){
    const m = mensaje(d, p);
    if(p.whatsapp) return { url: enlaceWa(p.whatsapp, m), medio: 'whatsapp' };
    if(p.correo) return { url: enlaceCorreo(p.correo, 'Airtek Empresas: ' + (d.cliente || ''), m), medio: 'correo' };
    return null;
  }
  const quien = (p) => primerNombre(p.nombre) + (ROL[p.rol] ? ' (' + ROL[p.rol] + ')' : '');

  // Marca donde va el botón: se llena sola al pintar la hoja
  const boton = (caso, id, falta) => id ? '<div class="ct-zona" data-ct-caso="' + esc(caso) + '" data-ct-id="' + esc(id) + '"' + (falta ? ' data-ct-falta="' + esc(falta) + '"' : '') + '></div>' : '';
  const DATOS = new WeakMap(); const MEMO = new Map();
  async function llenar(raiz){
    const zonas = (raiz || document).querySelectorAll('.ct-zona[data-ct-id]:not([data-ct-listo])');
    for(const z of zonas){
      z.setAttribute('data-ct-listo', '1');
      let d; const k = z.dataset.ctCaso + ':' + z.dataset.ctId + ':' + (z.dataset.ctFalta || '');
      try {
        // La cabecera se repinta seguido: se guarda un minuto
        const m = MEMO.get(k); if(m && Date.now() - m.en < 60000) d = await m.p;
        else { const pr = rpc('contacto_destino', { p_caso: z.dataset.ctCaso, p_id: Number(z.dataset.ctId), p_falta: z.dataset.ctFalta || null }); MEMO.set(k, { p: pr, en: Date.now() }); d = await pr; }
      }
      catch (e) { MEMO.delete(k); z.innerHTML = ''; continue; } // Sin red o sin permiso: el botón no sale y la hoja sigue
      DATOS.set(z, d);
      if(d.propio || !(d.destinos || []).length){ z.innerHTML = ''; continue; }
      const conDato = d.destinos.filter((p) => p.whatsapp || p.correo);
      if(!conDato.length){ z.innerHTML = '<p class="nota-chica">Para contactar a ' + esc(quien(d.destinos[0])) + ' falta su WhatsApp en Usuarios.</p>'; continue; }
      if(d.destinos.length === 1){
        const p = d.destinos[0]; const e = enlace(d, p);
        z.innerHTML = '<a class="btn btn-2 btn-chico ct-btn" href="' + esc(e.url) + '" target="_blank" rel="noopener" data-ct-para="' + esc(p.id) + '" data-ct-medio="' + e.medio + '">' + ic(e.medio === 'whatsapp' ? 'wa' : 'correo') + '<span>Contactar a ' + esc(primerNombre(p.nombre)) + '</span></a>';
      } else {
        z.innerHTML = '<button type="button" class="btn btn-2 btn-chico ct-btn" data-ct-elegir="1" aria-expanded="false">' + ic('wa') + '<span>Contactar</span></button><div class="ct-lista hidden"></div>';
      }
    }
  }
  document.addEventListener('click', (ev) => {
    const t = ev.target; let b;
    if((b = t.closest('[data-ct-elegir]'))){
      const z = b.closest('.ct-zona'); const d = DATOS.get(z); const l = z.querySelector('.ct-lista'); if(!d) return;
      const abierto = l.classList.toggle('hidden') === false; b.setAttribute('aria-expanded', String(abierto));
      if(abierto) l.innerHTML = d.destinos.map((p) => { const e = enlace(d, p);
        return e ? '<a class="fila ct-op" href="' + esc(e.url) + '" target="_blank" rel="noopener" data-ct-para="' + esc(p.id) + '" data-ct-medio="' + e.medio + '">' + ic(e.medio === 'whatsapp' ? 'wa' : 'correo') + '<span class="tx"><b>' + esc(quien(p)) + '</b><small>' + (e.medio === 'whatsapp' ? 'WhatsApp' : 'Correo') + '</small></span></a>'
          : '<p class="nota-chica">' + esc(quien(p)) + ': falta su WhatsApp en Usuarios.</p>'; }).join('');
      return;
    }
    if((b = t.closest('[data-ct-para]'))){
      const z = b.closest('.ct-zona'); const d = DATOS.get(z); if(!d) return;
      // Queda en la bitácora; si falla, el mensaje igual se abre
      rpc('contacto_anotar', { p_caso: z.dataset.ctCaso, p_id: Number(z.dataset.ctId), p_para: b.dataset.ctPara, p_medio: b.dataset.ctMedio, p_motivo: d.motivo || '' })
        .catch(() => toast('Se abrió el mensaje, pero no quedó anotado. Revisa tu internet', 'error'));
    }
  });
  window.Contacto = { boton, llenar, mensaje };
})();
