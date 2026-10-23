// Mundo de aliados de mentira (solicitudes, referidos, pagos), compartido por la prueba 20 y el modo práctica.
// Se llama con el mundo, el mapa de funciones simuladas y las dos cuentas de aliado (aliado y canales).
const { RPC } = require('./mundo');
const hoy = new Date().toISOString();
const err = (m) => ({ __error: { code: 'P0001', message: m } });

function mundoAliados(m, ALIADO, CANALES){
  const A = m.al = { n: 40, rifCaso: 'libre', subidas: [], analizar: 0,
    sols: [
      { id: 31, codigo: 'AL-0031', tipo: 'empresa', etiqueta: 'recaudos', cliente: 'Inversiones Ensayo <img src=x onerror="window.__xss=1">', cliente_id: 9001, rif: 'J000000021', aliado: 'Redes Norte Ejemplo', aliado_id: 1, creada_en: hoy, actualizada_en: hoy },
      { id: 29, codigo: 'AL-0029', tipo: 'empresa', etiqueta: 'excepcion', cliente: 'Comercial Ficticia 88, C.A.', cliente_id: 9002, rif: 'J000000022', aliado: 'Conecta Sur Ejemplo', aliado_id: 2, creada_en: hoy, actualizada_en: hoy, excepcion: { punto: 'Cédula vencida', motivo: 'Tiene cita para renovarla.' } },
      { id: 22, codigo: 'AL-0022', tipo: 'empresa', etiqueta: 'instalada', cliente: 'Óptica Imaginaria, C.A.', cliente_id: 9003, rif: 'J000000024', aliado: 'Redes Norte Ejemplo', aliado_id: 1, creada_en: hoy, actualizada_en: hoy, instalada_en: hoy, categoria: 'PYME-1GB' }
    ],
    refs: [{ id: 8, codigo: 'RF-0008', rif: 'J000000031', cliente: 'Restaurante Muestra, C.A.', aliado: 'Conecta Sur Ejemplo', etiqueta: 'referido', creado_en: hoy }, { id: 90, codigo: 'RF-0090', rif: 'J000000032', cliente: 'Bodega Revisable, C.A.', aliado: 'Conecta Sur Ejemplo', etiqueta: 'referido', creado_en: hoy }],
    sinp: [{ id: 5, origen: 'carga', cliente: 'Kiosco Supuesto, C.A.', rif: 'J000000041', aliado: 'Conecta Sur Ejemplo', instalada_en: hoy, categoria: 'PYME-1GB' }, { id: 6, origen: 'historico', cliente: 'Vivero Ejemplo', rif: '000000051', aliado: 'Pulse', instalada_en: '2026-03-04T12:00:00Z', categoria: 'PYME-1GB' }],
    docs: {}, estadoExtra: {} };
  const deAliado = (yo) => yo.rol === 'aliado' ? 1 : yo.canales ? 3 : null;
  const sol = (id) => A.sols.find((s) => s.id === Number(id));
  Object.assign(RPC, {
    aliado_inicio(m, yo){ if(!deAliado(yo)) return err('Tu usuario no está enlazado a un aliado. Avísale al administrador'); if(m.fallaInicio) return err('No se pudo leer'); return { aliado: yo.nombre, solicitudes: A.sols.filter((s) => s.aliado_id === deAliado(yo)), referidos: A.refs.filter((r) => r.aliado_id === deAliado(yo)) }; },
    aliados_registro(m, yo){ if(['admin', 'analista', 'lider', 'abogado'].indexOf(yo.rol) < 0) return err('No tienes permiso para hacer esto');
      const tu = (c) => yo.rol === 'lider' && c === 9003;
      return { solicitudes: A.sols.map((x) => Object.assign({ tu_cliente: tu(x.cliente_id) }, x)), referidos: A.refs.map((x) => Object.assign({ tu_cliente: false }, x)), sin_permiso: A.sinp.map((x) => Object.assign({ tu_cliente: false }, x)),
        viejas: [{ id: 41, cliente: 'Licorería Prueba', rif: 'J000000053', aliado: 'Conecta Sur Ejemplo', situacion: 'consulta' }], lideres: yo.rol === 'admin' ? ['Lucía Ferrer', 'Líder Dos'] : [], puedo: { decidir: yo.rol === 'admin', prueba: yo.rol === 'admin' } }; },
    aliados_bandeja(m, yo){ if(yo.rol !== 'admin') return err('No tienes permiso para hacer esto'); return { solicitudes: A.sols, referidos: A.refs, sin_permiso: A.sinp, viejas: [{ id: 'v1', cliente: 'Licorería Prueba', rif: 'J000000053', aliado: 'Conecta Sur', situacion: 'consulta' }], lideres: ['Lucía Ferrer', 'Líder Dos'] }; },
    solicitud_crear(m, yo, a){ const ya = A.sols.find((s) => s.aliado_id === deAliado(yo) && s.etiqueta === 'borrador' && !s.rif); if(ya){ ya.tipo = a.p_tipo; return { id: ya.id, codigo: ya.codigo }; }
      const id = ++A.n; A.sols.push({ id, codigo: 'AL-00' + id, tipo: a.p_tipo, etiqueta: 'borrador', aliado: yo.nombre, aliado_id: deAliado(yo), creada_en: hoy, actualizada_en: hoy }); return { id, codigo: 'AL-00' + id }; },
    solicitud_estado(m, yo, a){
      const s = sol(a.p_sol); if(!s) return err('No se encontró la solicitud');
      const solo = yo.rol !== 'admin' && s.aliado_id !== deAliado(yo);
      if(solo && ['lider', 'analista', 'abogado'].indexOf(yo.rol) < 0) return err('No tienes acceso a esta solicitud');
      const bit = yo.rol === 'aliado' ? undefined : [{ accion: 'aliado_decision', en: hoy, por: 'Marcos Rivas', despues: { texto: 'Aceptada mientras renueva.' } }];
      if(s.etiqueta === 'analizando'){ A.analizar++; if(A.analizar >= 2){ s.etiqueta = 'lista'; s.ia = { estado: 'lista', veredicto: 'apto', total: 4, avance: 4, puntos: [], marcas: [] }; } }
      const docs = (A.docs[s.id] || []).map((d, i) => ({ id: 500 + i, casilla: d.casilla, numero: d.numero, estado: 'por_revisar', archivos: [{ id: 700 + i, nombre: 'x.pdf', lectura: 'ok' }] }));
      if(s.id === 31) return Object.assign({}, s, { es_admin: yo.rol === 'admin', solo_ver: solo, bitacora: bit, docs: [{ id: 81, casilla: 'acta_constitutiva', numero: 0, archivos: [{ id: 1, lectura: 'ok' }] }, { id: 82, casilla: 'cedula', numero: 1, archivos: [{ id: 2, lectura: 'ok' }] }],
        ia: { estado: 'lista', veredicto: 'no_apto', total: 3, avance: 3, marcas: [{ documento: 81, propuesta: 'problema', nota: 'La junta venció en 2023. Busca el acta de asamblea que la ratificó.' }, { documento: 82, propuesta: 'bien', nota: 'Vigente.' }],
          puntos: [{ id: 'falta_rif_personal_1', titulo: 'Falta RIF personal', estado: 'bloquea', detalle: 'No está en el expediente.' }, { id: 'falta_correo_empresa_0', titulo: 'Falta correo de la empresa', estado: 'bloquea', detalle: 'Hay que escribirlo en el expediente.' }] },
        contacto: { correo: 'rep@ejemplo.test', telefono: '04140000000' }, hilo: [{ texto: 'Resultado: Recaudos incompletos.', color: 'rj', en: hoy }] });
      return Object.assign({ docs, ia: s.ia || (s.etiqueta === 'analizando' ? { estado: 'leyendo', total: 4, avance: 1 } : null), hilo: [{ texto: 'Envió la solicitud.', color: 'az', en: hoy }], es_admin: yo.rol === 'admin', solo_ver: solo, bitacora: bit }, s);
    },
    solicitud_contacto(m, yo, a){ A.contacto = a; return null; },
    solicitud_enviar(m, yo, a){ const s = sol(a.p_sol); s.etiqueta = 'analizando'; A.analizar = 0; return { corrida: 1 }; },
    solicitud_excepcion(m, yo, a){ const s = sol(a.p_sol); s.etiqueta = 'excepcion'; s.excepcion = { punto: a.p_punto, motivo: a.p_motivo }; return null; },
    solicitud_instalacion(m, yo, a){ const s = sol(a.p_sol); s.etiqueta = 'curso'; s.fecha_instalacion = a.p_fecha; return null; },
    solicitud_decidir(m, yo, a){ if(yo.rol !== 'admin') return err('No tienes permiso para hacer esto'); const s = sol(a.p_sol); s.etiqueta = a.p_modo === 'aprobar' ? 'lista' : a.p_modo === 'noprocede' ? 'noprocede' : 'recaudos'; s.respuesta = a.p_texto; return null; },
    referido_crear(m, yo, a){ if(A.refs.some((r) => r.solicitud === a.p_solicitud && a.p_solicitud)) return err('Ese cliente ya fue referido'); A.refs.push({ id: 9, codigo: 'RF-0009', rif: 'J000000014', cliente: 'Distribuidora Inventada', aliado_id: deAliado(yo), etiqueta: 'referido', creado_en: hoy, solicitud: a.p_solicitud }); return { id: 9, codigo: 'RF-0009' }; },
    referido_decidir(m, yo, a){ const r = A.refs.find((x) => x.id === a.p_ref); r.etiqueta = a.p_aceptar ? 'aceptado' : 'no_aceptado'; r.lider = a.p_lider; return null; },
    aliados_pagos(m, yo){ if(yo.rol !== 'admin' && !yo.canales) return err('No tienes permiso para hacer esto'); return { instalaciones: A.sols.filter((s) => s.etiqueta === 'instalada' && !s.pagada_en).map((s) => Object.assign({ equipo: 'EQ1', servicio: '824-00000001' }, s)), referidos: [{ id: 7, codigo: 'RF-0007', rif: 'J000000033', cliente: 'Gimnasio Ejemplo', aliado: 'Redes Norte Ejemplo', etiqueta: 'instalado', horas: -5, instalado_en: hoy }] }; },
    pago_marcar(m, yo, a){ if(a.p_tipo === 'instalacion') sol(a.p_id).pagada_en = hoy; return null; },
    aliados_por_mes(m, yo){ if(['admin', 'analista', 'lider', 'abogado'].indexOf(yo.rol) < 0) return err('No tienes permiso para hacer esto');
      return { total: 3, meses: [{ mes: '2026-10-01', total: 1, aliados: [{ aliado: 'Pulse', n: 1 }], filas: [{ dia: '2026-10-02', aliado: 'Pulse', cliente: 'Panadería Inventada', codigo: '001-00000099', categoria: 'PYME-1GB', con_permiso: false }] },
        { mes: '2026-02-01', total: 2, aliados: [{ aliado: 'Conecta Sur Ejemplo', n: 2 }], filas: [{ dia: '2026-02-10', aliado: 'Conecta Sur Ejemplo', cliente: 'Farmacia Ficticia', codigo: '001-00000098', categoria: 'PYME-1GB', con_permiso: true }, { dia: '2026-02-03', aliado: 'Conecta Sur Ejemplo', cliente: 'Taller Supuesto', codigo: '001-00000097', categoria: 'PYME-1GB', con_permiso: true }] }],
        cargas: [{ archivo: 'ordenes_enero.xlsx', en: hoy, solo_aliados: true }] }; },
    instalados_aliados(m, yo){ return [{ id: 1, cliente: 'Óptica Imaginaria, C.A.', rif: 'J000000024', aliado: 'Redes Norte Ejemplo', instalada_en: hoy, categoria: 'PYME-1GB', con_permiso: yo.rol === 'admin' ? true : null }]; },
    aliado_revisado(m, yo, a){ if(yo.rol !== 'admin') return err('No tienes permiso para hacer esto'); const x = (a.p_tipo === 'sol' ? A.sols : A.refs).find((y) => y.id === a.p_id); x.revisado = true; x.revisado_nota = a.p_nota; return null; },
    sin_permiso_revisar(m, yo, a){ A.sinp.find((p) => p.id === a.p_id).revisado_en = hoy; return null; },
    aliados_lista(m, yo){ return { aliados: [{ id: 1, nombre: 'REDES NORTE EJEMPLO', codigo: '027', perfil: null }, { id: 3, nombre: 'Canales', es_canales: true, perfil: null }], perfiles: [{ id: ALIADO.id, nombre: ALIADO.nombre, usuario: ALIADO.usuario, rol: 'aliado' }, { id: CANALES.id, nombre: CANALES.nombre, usuario: CANALES.usuario, rol: 'analista' }].filter((p) => !A.sinAnalista || p.rol !== 'analista') }; },
    aliado_enlazar(m, yo, a){ A.enlace = a; return null; },
    ajustes_app(){ return Object.assign({ whatsapp_admin: null }, A.ajustes || {}); },
    ajuste_guardar(m, yo, a){ if(yo.rol !== 'admin') return err('No tienes permiso para hacer esto'); const v = String(a.p_valor || '').replace(/\D/g, '');
      if(v.length < 10) return err('Escribe el número con su código, por ejemplo 0414 1234567'); A.ajustes = { whatsapp_admin: '58' + v.replace(/^0/, '') }; return null; }
  });
  const registrar = RPC.documentos_registrar;
  RPC.documentos_registrar = (m, yo, a) => { if(yo.rol !== 'aliado') return registrar(m, yo, a); const s = A.sols.find((x) => x.cliente_id === a.p_cliente); (A.docs[s.id] = A.docs[s.id] || []).push(a.p_items[0].casillas[0]); return 1; };
}

module.exports = { mundoAliados };
