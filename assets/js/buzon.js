// Lote 28/10: grupos del buzón (Mi trabajo) por rol, compartidos con Inicio ("Mis pendientes, agrupados").
// Cada ítem cae en el primer grupo que tiene su tipo; lo que no tiene grupo va a "Otras tareas".
(function(){
  'use strict';
  const C = window.Comun;
  const I = {
    doc: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h4', firma: 'M3 17c3 0 4-6 7-6s2 6 5 6 4-3 6-3M3 21h18',
    inst: 'M12 2v6M5 9h14l-1 11H6zM9 13v4M15 13v4', meta: 'M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zM12 12h.01',
    emitir: 'M22 2L11 13M22 2l-7 20-4-9-9-4z', sobre: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6',
    ip: 'M5 12h14M12 5v14M4 4h16v16H4z', pago: 'M2 7h20v12H2zM2 11h20M6 15h3', lupa: 'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM21 21l-4.3-4.3',
    contrato: 'M6 2h9l5 5v15H6zM14 2v6h6M9 14l2 2 4-4', decidir: 'M12 3v18M3 7l9-4 9 4M5 7l-2 6a4 4 0 0 0 4 0zM19 7l-2 6a4 4 0 0 0 4 0z',
    alerta: 'M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01', mas: 'M12 5v14M5 12h14',
    nota: 'M6 3h9l4 4v14H6zM9 12h7M9 16h5', dev: 'M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3'
  };
  // [id, título, línea, icono, tono, tipos]
  const VENDE = [['dev', 'Devueltos', 'Sube otra vez lo que se devolvió', 'dev', 'r', ['devuelto']],
    ['falta', 'Faltan para comisionar', 'Ventas del corte que no cumplen', 'meta', 'a', ['venta_falta']],
    ['inst', 'Por instalar', 'Órdenes de más de 24 horas y clientes nuevos', 'inst', 'v', ['orden_atrasada', 'cliente_nuevo']]];
  const ROL = {
    lider: [['doc', 'Conseguir documentos', 'Faltan o sin gestionar', 'doc', 'b', ['devuelto', 'docs_faltan', 'sin_gestion', 'vgt', 'poliza', 'referido', 'rif_verificar']],
      ['fir', 'Hacer firmar', 'Contratos y planillas', 'firma', 'm', ['por_firmar', 'planilla']],
      ['ins', 'Por instalar', 'Órdenes de más de 24 horas', 'inst', 'v', ['orden_atrasada', 'por_instalar']],
      ['ges', 'Gestiones asignadas', 'Metas con plazo', 'meta', 'a', ['gestion']]],
    analista: [['carta', 'Cartas y proformas', 'De todos los equipos · obligatorio para Canales', 'sobre', 'a', ['carta_enviar', 'por_enviar']],
      ['ip', 'IP por escribir', 'Sin IP no sale la carta', 'ip', 'm', ['sin_ip', 'ip_confirmar']],
      ['pago', 'Apoyo con pago', 'Del corte, por dueño', 'pago', 'r', ['revisar_pago']],
      ['emi', 'Emitir en Proham', 'Cambios con documentos aprobados', 'emitir', 'b', ['cambio_emitir']]],
    abogado: [['con', 'Contratos', 'Por elaborar, por firmar y por subir', 'contrato', 'b', ['elaborar_contrato', 'seguir_firma', 'contrato_archivo']],
      ['ven', 'Vencimientos', 'Contratos, juntas y pólizas', 'alerta', 'a', ['contrato_vence']]],
    admin: [['rev', 'Revisar documentos', 'Líderes, aliados y correo', 'lupa', 'b', ['revisar_docs', 'cambio_revisar']],
      ['dec', 'Por decidir', 'Corte, comisiones y sin registro', 'decidir', 'r', ['cerrar_corte', 'certificar', 'por_asignar', 'sin_registro', 'sin_cliente', 'sin_servicio', 'rif_verificar', 'por_instalar', 'sin_ip']],
      ['ali', 'Aliados', 'Permisos y bloqueos', 'inst', 'm', ['aliado_permisos', 'aliado_sin_permiso']],
      ['ale', 'Alertas', 'Cargas raras y órdenes atrasadas', 'alerta', 'a', ['alerta_carga', 'ordenes_atrasadas']]]
  };
  ROL.coord = ROL.analista;
  // Qué se hace con cada tipo: [acción, botón]
  const ACC = {
    docs_faltan: ['Conseguir documentos', 'Pedir'], devuelto: ['Corregir lo devuelto', 'Subir otra'], sin_gestion: ['Pedir documentos', 'Pedir'], vgt: ['Completar requisitos VGT', 'Subir'],
    poliza: ['Renovar póliza', 'Pedir'], referido: ['Contactar referido', 'Contactar'], rif_verificar: ['Verificar RIF', 'Revisar'], por_firmar: ['Hacer firmar contrato', 'Enviar'],
    planilla: ['Documentos del cambio', 'Subir'], por_instalar: ['Instalación pendiente', 'Ver orden'], orden_atrasada: ['Orden sin instalar', 'Subir documentos'], gestion: ['Dar seguimiento', 'Registrar'],
    cambio_emitir: ['Emitir en Proham', 'Ir al cambio'], por_enviar: ['Enviar carta y proforma', 'Enviar'], carta_enviar: ['Enviar carta y proforma', 'Enviar'], sin_ip: ['Falta la IP', 'Escribir IP'], ip_confirmar: ['Confirmar IP', 'Confirmar'],
    revisar_pago: ['Revisar pago', 'Ir'], elaborar_contrato: ['Elaborar contrato', 'Subir contrato'], seguir_firma: ['Seguir firma', 'Subir firmado'], contrato_archivo: ['Subir contrato firmado', 'Subir'],
    contrato_vence: ['Contrato por vencer', 'Ir'], revisar_docs: ['Revisar expediente', 'Revisar'], cambio_revisar: ['Aprobar documentos del cambio', 'Ir al cambio'],
    cerrar_corte: ['Cerrar corte', 'Revisar y cerrar'], certificar: ['Para certificar', 'Ir'], por_asignar: ['Asignar orden', 'Asignar'], sin_registro: ['Cambio sin registro', 'Asignar líder'],
    sin_cliente: ['Instalación sin cliente', 'Ir'], sin_servicio: ['Instalación sin servicio', 'Ir'], aliado_permisos: ['Permisos de aliados', 'Revisar'], aliado_sin_permiso: ['Instalado sin permiso', 'Revisar'],
    alerta_carga: ['Carga rara', 'Revisar'], ordenes_atrasadas: ['Órdenes atrasadas', 'Ir'], venta_falta: ['Falta para comisionar', 'Ir'], cliente_nuevo: ['Cliente nuevo por instalar', 'Ir']
  };
  const color = (f, hoy) => (!f.vence ? 'ok' : f.vence < hoy ? 'venc' : f.vence === hoy ? 'hoy' : 'ok');
  function grupos(D){
    const vista = D.vista || 'lider'; const def = (D.vende ? VENDE.map((g) => g.concat(['ventas'])) : []).concat((ROL[vista] || ROL.lider).filter((g) => !(D.vende && g[0] === 'ins')).map((g) => g.concat(['rol'])));   // quien vende ya tiene Por instalar en Mis ventas
    const gs = def.map((g) => ({ id: g[0], titulo: g[1], sub: g[2], icono: g[3], tono: g[4], tipos: g[5], parte: g[6], items: [] }));
    const resto = [];
    (D.items || []).forEach((f) => { const g = gs.find((x) => x.tipos.indexOf(f.tipo) >= 0); if(g) g.items.push(f); else resto.push(f); });
    if(resto.length) gs.push({ id: 'otros', titulo: 'Otras tareas', sub: 'Lo demás que te toca', icono: 'mas', tono: 'g', tipos: [], parte: 'rol', items: resto });
    gs.forEach((g) => { g.venc = g.items.filter((f) => color(f, D.hoy) === 'venc').length; g.hoy = g.items.filter((f) => color(f, D.hoy) === 'hoy').length; });
    // Un grupo de rol vacío se queda (dice "Nada pendiente"); uno de ventas vacío también: así el índice no cambia de forma
    return gs;
  }
  const icono = (k, tono) => '<span class="mt-ico t-' + (tono || 'g') + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + (I[k] || I.mas) + '"/></svg></span>';
  window.Buzon = { I, ACC, grupos, color, icono, diasDesde: (t, hoy) => Math.max(0, C.diasEntre(String(t || '').slice(0, 10), hoy) || 0) };
})();
