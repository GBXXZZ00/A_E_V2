// Funciones compartidas por todos los módulos.
(function(){
  'use strict';
  const $ = (id) => document.getElementById(id);
  const ZONA = 'America/Caracas';

  // Todo texto que venga de un usuario o de la base pasa por aquí antes de entrar al HTML
  function esc(v){
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Toda comparación de texto pasa por aquí: minúsculas, sin tildes, sin espacios sobrantes
  function normalizeStr(v){
    return String(v === null || v === undefined ? '' : v)
      .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  let zona = null;
  function toast(texto, tipo){
    if(!zona){
      zona = document.createElement('div');
      zona.className = 'toast-zona';
      document.body.appendChild(zona);
    }
    const t = document.createElement('div');
    t.className = 'toast' + (tipo === 'error' ? ' error' : '');
    t.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
    t.textContent = texto;
    zona.appendChild(t);
    requestAnimationFrame(() => t.classList.add('ver'));
    setTimeout(() => { t.classList.remove('ver'); setTimeout(() => t.remove(), 220); }, tipo === 'error' ? 4600 : 3000);
  }

  // Mensaje claro para la persona a partir de un error técnico
  function mensajeError(e, porDefecto){
    const m = String((e && (e.message || e.error_description || e.error)) || '').toLowerCase();
    if(!navigator.onLine || m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed') || m.includes('failed to send')) return 'Sin conexión. Revisa tu internet e intenta de nuevo';
    return porDefecto || 'Algo falló. Intenta de nuevo';
  }

  function iniciales(nombre){
    const p = String(nombre || '').trim().split(/\s+/).filter(Boolean);
    return ((p[0] || '').charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toUpperCase() || '?';
  }
  function primerNombre(n){ return String(n || '').trim().split(/\s+/)[0] || ''; }

  // ---------- Iconos (trazo, 24 x 24) ----------
  const ICONOS = {
    casa: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
    barras: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
    edificio: 'M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M2 21h20M8 7h4M8 11h4M8 15h4',
    abajo: 'm6 9 6 6 6-6', arriba: 'm6 15 6-6 6 6', derecha: 'm9 6 6 6-6 6',
    volver: 'M19 12H5M11 6l-6 6 6 6', x: 'M6 6l12 12M18 6 6 18',
    wa: 'M4 20l1.3-4A8 8 0 1 1 8 18.7z',
    tel: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z',
    correo: 'M3 6h18v12H3zM3 7l9 6 9-6',
    reloj: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
    alerta: 'M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
    devolver: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
    check: 'M20 6 9 17l-5-5',
    subir: 'M12 16V4M7 9l5-5 5 5M4 20h16',
    usuarios: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
    actualizar: 'M21 12a9 9 0 1 1-3-6.7M21 4v5h-5',
    candado: 'M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5z',
    salir: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
    herramienta: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z',
    wifi: 'M12 20h.01M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 14 0M2 9.5a15 15 0 0 1 20 0',
    cambio: 'M7 7h13l-4-4M17 17H4l4 4',
    servidor: 'M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01',
    enviar: 'M5 12h14M13 6l6 6-6 6',
    lupa: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5',
    doc: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6',
    mas: 'M12 5v14M5 12h14',
    lapiz: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
    estrella: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z'
  };
  function ic(nombre, clase){
    return '<svg class="i' + (clase ? ' ' + clase : '') + '" viewBox="0 0 24 24" aria-hidden="true"><path d="' + (ICONOS[nombre] || '') + '"/></svg>';
  }

  // ---------- Fechas (siempre hora de Caracas) ----------
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  // Devuelve {a, m, d, h, min, dia} de un instante (ISO con hora) o de una fecha sola (AAAA-MM-DD)
  function partes(v){
    if(!v) return null;
    const s = String(v);
    if(/^\d{4}-\d{2}-\d{2}$/.test(s)){
      const a = Number(s.slice(0, 4)), m = Number(s.slice(5, 7)), d = Number(s.slice(8, 10));
      return { a, m, d, h: 0, min: 0, dia: new Date(Date.UTC(a, m - 1, d)).getUTCDay() };
    }
    const f = new Date(s); if(isNaN(f)) return null;
    // Caracas va siempre 4 horas detrás de la hora universal, sin cambio de horario
    const c = new Date(f.getTime() - 4 * 3600 * 1000);
    return { a: c.getUTCFullYear(), m: c.getUTCMonth() + 1, d: c.getUTCDate(), h: c.getUTCHours(), min: c.getUTCMinutes(), dia: c.getUTCDay() };
  }
  function clave(p){ return p ? p.a + '-' + String(p.m).padStart(2, '0') + '-' + String(p.d).padStart(2, '0') : ''; }
  function hoyClave(){ return clave(partes(new Date().toISOString())); }
  function diasEntre(desde, hasta){
    const a = partes(desde), b = partes(hasta); if(!a || !b) return 0;
    return Math.round((Date.UTC(b.a, b.m - 1, b.d) - Date.UTC(a.a, a.m - 1, a.d)) / 86400000);
  }
  function fecha(v, conAnio){
    const p = partes(v); if(!p) return '';
    const anioActual = partes(new Date().toISOString()).a;
    return p.d + ' de ' + MESES[p.m - 1] + (conAnio || p.a !== anioActual ? ' de ' + p.a : '');
  }
  function fechaDia(v){ const p = partes(v); if(!p) return ''; const t = DIAS[p.dia] + ' ' + p.d + ' de ' + MESES[p.m - 1]; return t.charAt(0).toUpperCase() + t.slice(1); }
  function hora(v){ const p = partes(v); if(!p) return ''; return String(p.h).padStart(2, '0') + ':' + String(p.min).padStart(2, '0'); }
  function mes(v){ const p = partes(v); return p ? MESES[p.m - 1] : ''; }
  function mesAnio(v){ const p = partes(v); return p ? MESES[p.m - 1] + ' de ' + p.a : ''; }
  // "Hoy", "Ayer" o la fecha
  function dia(v){
    const n = diasEntre(v, new Date().toISOString());
    if(n === 0) return 'Hoy'; if(n === 1) return 'Ayer';
    return fecha(v);
  }
  function capital(t){ t = String(t || ''); return t.charAt(0).toUpperCase() + t.slice(1); }
  function plural(n, uno, varios){ return n + ' ' + (Number(n) === 1 ? uno : varios); }

  // ---------- Documentos de identidad y contacto ----------
  function docFmt(tipo, numero){
    const n = String(numero || ''); const t = String(tipo || '').toUpperCase();
    if(!n) return '';
    if(t !== 'V' && t !== 'E' && n.length === 9) return t + '-' + n.slice(0, 8) + '-' + n.slice(8);
    return t + '-' + n;
  }
  // Número para WhatsApp: solo dígitos y con el código de Venezuela
  function telWa(tel){
    let d = String(tel || '').replace(/\D/g, '');
    if(!d) return '';
    if(d.length === 11 && d.charAt(0) === '0') d = '58' + d.slice(1);
    else if(d.length === 10) d = '58' + d;
    return d.length >= 11 ? d : '';
  }
  function enlaceWa(tel, texto){ return 'https://wa.me/' + telWa(tel) + (texto ? '?text=' + encodeURIComponent(texto) : ''); }
  function enlaceTel(tel){ const d = String(tel || '').replace(/[^\d+]/g, ''); return d ? 'tel:' + d : ''; }
  function enlaceCorreo(correo, asunto, cuerpo){
    if(!correo) return '';
    const q = [];
    if(asunto) q.push('subject=' + encodeURIComponent(asunto));
    if(cuerpo) q.push('body=' + encodeURIComponent(cuerpo));
    return 'mailto:' + encodeURIComponent(correo).replace(/%40/g, '@') + (q.length ? '?' + q.join('&') : '');
  }

  // ---------- Listas cerradas ----------
  const ESTATUS = {
    grandes_negocios: { t: 'Grandes negocios', c: 'gris' },
    documentos_solicitados: { t: 'Documentos solicitados', c: 'azul' },
    documentos_pendientes: { t: 'Documentos pendientes', c: 'rojo' },
    documentos_en_revision: { t: 'Documentos en revisión', c: 'ambar' },
    documentos_recibidos: { t: 'Documentos recibidos', c: 'verde' },
    contrato_en_curso: { t: 'Contrato en curso', c: 'morado' },
    por_firmar: { t: 'Pendiente por firmar', c: 'morado' },
    contrato_firmado: { t: 'Contrato firmado', c: 'verde' }
  };
  const MOTIVOS = { vencido: 'Está vencido', ilegible: 'Ilegible o incompleto', no_corresponde: 'No corresponde a este cliente', falta_firma: 'Falta firma o sello', otro: 'Otro motivo' };
  const FEMENINAS = { cedula: 1, acta_constitutiva: 1, acta_asamblea: 1 };
  // "acta constitutiva vencida", "RIF personal ilegible o incompleto"
  function devueltoFrase(texto, casillaId, motivo){
    const fem = !!FEMENINAS[casillaId];
    switch(motivo){
      case 'vencido': return texto + (fem ? ' vencida' : ' vencido');
      case 'ilegible': return texto + ' ilegible o incompleto'.replace('incompleto', fem ? 'incompleta' : 'incompleto');
      case 'no_corresponde': return texto + ' que no corresponde a este cliente';
      case 'falta_firma': return texto + ' sin firma o sello';
      default: return texto;
    }
  }
  const SUCURSALES = { '824': 'Maracaibo', '005': 'San Francisco', '900': 'Dedicados' };
  function sucursal(s){ const k = String(s || ''); return SUCURSALES[k] ? k.replace(/^0+/, '') + ' ' + SUCURSALES[k] : (k ? 'Sucursal ' + k : ''); }
  function chipEstatus(e){ const x = ESTATUS[e] || { t: e || '', c: 'gris' }; return '<span class="chip punto ' + x.c + '">' + esc(x.t) + '</span>'; }
  function estadoServicio(e){
    const n = normalizeStr(e); if(!n) return '';
    const ok = n.indexOf('habilit') === 0 || n === 'activo';
    return '<span class="chip ' + (ok ? 'verde' : 'rojo') + '">' + esc(capital(n)) + '</span>';
  }
  // Nombre de una casilla del expediente
  function casilla(c, n){
    switch(c){
      case 'cedula': return 'Cédula' + (n > 1 ? ' del representante ' + n : '');
      case 'rif_personal': return 'RIF personal' + (n > 1 ? ' del representante ' + n : '');
      case 'rif_empresa': return 'RIF de la empresa';
      case 'acta_constitutiva': return 'Acta constitutiva';
      case 'acta_asamblea': return 'Acta de asamblea ' + (n || 1);
      case 'conatel': return 'Permiso de Conatel';
      case 'contrato_pyme': return 'Contrato PYME';
      case 'contrato_dedicado': return 'Contrato dedicado';
      case 'otro': return 'Otro documento' + (n ? ' ' + n : '');
      default: return c || '';
    }
  }
  function lista(arr){
    if(!arr.length) return '';
    if(arr.length === 1) return arr[0];
    return arr.slice(0, -1).join(', ') + ' y ' + arr[arr.length - 1];
  }
  // Resumen en una línea de lo que le falta a un expediente
  function faltaTexto(faltantes){
    const f = faltantes || [];
    const dev = f.filter((x) => x.e === 'devuelto');
    if(dev.length) return 'Devuelto: ' + devueltoFrase(dev[0].t, dev[0].k, dev[0].m) + (dev.length > 1 ? ' y ' + (dev.length - 1) + ' más' : '');
    const fal = f.filter((x) => x.e === 'falta');
    return fal.length ? 'Falta ' + lista(fal.map((x) => x.t)) : '';
  }

  // ---------- Supabase ----------
  // Llama una función del servidor. Devuelve los datos o lanza un Error con un mensaje para la persona.
  async function rpc(nombre, args){
    const db = window.db;
    if(!db) throw new Error('No se pudo cargar la app. Recarga la página');
    let r;
    try { r = await db.rpc(nombre, args || {}); }
    catch (e) { throw new Error(mensajeError(e)); }
    if(r.error){
      const e = r.error; const m = String(e.message || '');
      if(e.code === 'P0001'){
        if(m.indexOf('Tu sesión venció') === 0 && window.Sesion){ await window.Sesion.salir(); location.replace('index.html'); }
        throw new Error(m);
      }
      if(r.status === 401 || /jwt/i.test(m)){ if(window.Sesion){ await window.Sesion.salir(); location.replace('index.html'); } throw new Error('Tu sesión venció. Entra de nuevo'); }
      throw new Error(mensajeError(e));
    }
    return r.data;
  }

  // Lo último que se vio de una pantalla, para pintarla al instante mientras llega lo nuevo.
  // Vive solo mientras la pestaña esté abierta y se borra al salir.
  const cache = {
    leer(k){ try { const v = sessionStorage.getItem('ae_c_' + k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
    guardar(k, v){ try { sessionStorage.setItem('ae_c_' + k, JSON.stringify(v)); } catch (e) {} },
    borrarTodo(){ try { Object.keys(sessionStorage).filter((k) => k.indexOf('ae_c_') === 0).forEach((k) => sessionStorage.removeItem(k)); } catch (e) {} }
  };

  // Filas grises con la forma de lo que viene
  function esqueleto(n, tipo){
    let h = '';
    for(let i = 0; i < n; i++){
      h += tipo === 'tarjeta'
        ? '<div class="sk-tarj" aria-hidden="true"><span class="sk" style="width:62%;height:18px"></span><span class="sk" style="width:84%;height:12px"></span><span class="sk p"></span><span class="sk" style="width:100%;height:44px;border-radius:14px"></span></div>'
        : '<div class="sk-fila" aria-hidden="true"><span class="sk c"></span><span class="sk-tx"><span class="sk" style="width:' + (48 + (i * 13) % 30) + '%;height:14px"></span><span class="sk" style="width:' + (30 + (i * 7) % 25) + '%;height:11px"></span></span><span class="sk p"></span></div>';
    }
    return h;
  }
  function vacio(titulo, texto, extra){
    return '<div class="vacio"><b>' + esc(titulo) + '</b><p>' + esc(texto || '') + '</p>' + (extra || '') + '</div>';
  }

  // ---------- Hojas y cuadros ----------
  // Se abren con data-abre="idHoja" y se cierran con data-cierra o tocando el velo
  let velo = null; let abierta = null; let volverA = null;
  // Con una hoja abierta, lo de atrás no recibe foco; cerrada, la hoja tampoco
  function fondo(inerte){ Array.prototype.forEach.call(document.querySelectorAll('body > header, body > main, body > nav'), (n) => { n.inert = inerte; }); }
  // Las hojas se apilan: una acción dentro de una hoja abre otra encima y al cerrarla se vuelve a la anterior.
  const pila = [];   // [{ h, volver }]
  function prepararHojas(){ Array.prototype.forEach.call(document.querySelectorAll('.hoja'), (h) => { if(h !== abierta) h.inert = true; }); }
  prepararHojas();
  function acomodar(){
    abierta = pila.length ? pila[pila.length - 1].h : null;
    pila.forEach((x, i) => { x.h.style.zIndex = String(70 + i * 2); x.h.inert = i !== pila.length - 1; x.h.classList.toggle('debajo', i !== pila.length - 1); });
    if(velo){ velo.classList.toggle('ver', pila.length > 0); velo.style.zIndex = String(69 + (pila.length - 1) * 2); }
    document.body.classList.toggle('con-hoja', pila.length > 0);
    fondo(pila.length > 0);
  }
  // Se abre sobre la que ya esté; al cerrarla se vuelve a la anterior
  function abrirHoja(id, opciones){
    const h = $(id); if(!h) return;
    if(pila.some((x) => x.h === h)) return;
    if(!velo){ velo = document.createElement('div'); velo.className = 'velo'; velo.dataset.cierra = '1'; document.body.appendChild(velo); }
    pila.push({ h, volver: document.activeElement });
    // El botón Atrás del teléfono cierra la hoja en vez de sacar de la pantalla
    try { if(history.state && history.state.ae_hoja === pila.length) history.replaceState({ ae_hoja: pila.length }, ''); else history.pushState({ ae_hoja: pila.length }, ''); } catch (e) {}
    h.classList.add('ver'); h.setAttribute('aria-hidden', 'false');
    acomodar();
    const foco = h.querySelector('[data-foco]') || h.querySelector('input,select,textarea,button,a[href]');
    if(foco) setTimeout(() => { try { foco.focus({ preventScroll: true }); } catch (e) { foco.focus(); } }, 60);
  }
  function cerrarHoja(sinFoco, porAtras){
    if(!pila.length) return;
    if(!porAtras && history.state && history.state.ae_hoja === pila.length){ saltarAtras++; urlAlCerrar = location.href; try { history.back(); } catch (e) { saltarAtras--; } }
    const x = pila.pop(); const h = x.h;
    h.classList.remove('ver', 'debajo'); h.setAttribute('aria-hidden', 'true'); h.inert = true; h.style.zIndex = '';
    acomodar();
    h.dispatchEvent(new CustomEvent('hoja-cerrada'));
    if(sinFoco !== true && x.volver && x.volver.focus && document.contains(x.volver)) x.volver.focus();
  }
  let saltarAtras = 0;
  let urlAlCerrar = '';
  // Al cerrar con la equis se retrocede un paso del historial; la dirección (filtros, búsqueda) se conserva
  window.addEventListener('popstate', () => { if(saltarAtras > 0){ saltarAtras--; if(urlAlCerrar && urlAlCerrar !== location.href){ try { history.replaceState(history.state, '', urlAlCerrar); } catch (e) {} } return; }
    // Atrás o Adelante: quedan abiertas tantas hojas como diga esa entrada del historial
    const n = (history.state && history.state.ae_hoja) || 0; while(pila.length > n) cerrarHoja(false, true); });
  // Tras recargar con una hoja abierta no debe quedar un Atrás que no hace nada
  try { if(history.state && history.state.ae_hoja) history.replaceState(null, ''); } catch (e) {}
  function cerrarTodas(){
    const n = pila.length; if(!n) return;
    const enHistorial = history.state && history.state.ae_hoja === n;
    while(pila.length) cerrarHoja(true, true);
    if(enHistorial){ saltarAtras++; urlAlCerrar = location.href; try { history.go(-n); } catch (e) { saltarAtras--; } }
  }
  // Un enlace dentro de una hoja lleva a otra página: se reemplaza la entrada de la hoja para que Atrás funcione
  document.addEventListener('click', (e) => { const a = e.target.closest('.hoja a[href]'); if(!a || a.target || !pila.length || e.defaultPrevented) return;
    const h = a.getAttribute('href') || ''; if(!h || h.charAt(0) === '#' || /^(mailto:|tel:|https?:)/i.test(h)) return; e.preventDefault(); location.replace(a.href); });
  function hojaAbierta(){ return abierta ? abierta.id : null; }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-abre]'); if(a){ abrirHoja(a.dataset.abre); return; }
    if(e.target.closest('[data-cierra]')) cerrarHoja();
  });
  document.addEventListener('keydown', (e) => { if(e.key === 'Escape') cerrarHoja(); });

  // Al volver con el botón Atrás, la página se revisa de nuevo en vez de mostrarse desde la memoria
  window.addEventListener('pageshow', (e) => { if(e.persisted) location.reload(); });

  if('serviceWorker' in navigator && location.protocol === 'https:'){
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }

  window.Comun = { $, esc, normalizeStr, toast, mensajeError, iniciales, primerNombre, abrirHoja, cerrarHoja, cerrarTodas, hojaAbierta, hojasAbiertas: () => pila.map((x) => x.h.id), prepararHojas,
    ic, partes, hoyClave, diasEntre, fecha, fechaDia, hora, mes, mesAnio, dia, capital, plural, lista,
    docFmt, telWa, enlaceWa, enlaceTel, enlaceCorreo,
    ESTATUS, MOTIVOS, devueltoFrase, sucursal, chipEstatus, estadoServicio, casilla, faltaTexto,
    rpc, cache, esqueleto, vacio };
})();
