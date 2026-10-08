// Funciones compartidas por todos los módulos.
(function(){
  'use strict';
  const $ = (id) => document.getElementById(id);

  // Todo texto que venga de un usuario o de la base pasa por aquí antes de entrar al HTML
  function esc(v){
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Toda comparación de texto pasa por aquí: minúsculas, sin tildes, sin espacios sobrantes
  function normalizeStr(v){
    return String(v === null || v === undefined ? '' : v)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
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

  // Hojas y cuadros: se abren con data-abre="idHoja" y se cierran con data-cierra o tocando el velo
  let velo = null; let abierta = null; let volverA = null;
  // Con una hoja abierta, lo de atrás no recibe foco; cerrada, la hoja tampoco
  function fondo(inerte){ Array.prototype.forEach.call(document.querySelectorAll('body > header, body > main'), (n) => { n.inert = inerte; }); }
  Array.prototype.forEach.call(document.querySelectorAll('.hoja'), (h) => { h.inert = true; });
  function abrirHoja(id){
    const h = $(id); if(!h) return;
    if(!velo){ velo = document.createElement('div'); velo.className = 'velo'; velo.dataset.cierra = '1'; document.body.appendChild(velo); }
    volverA = document.activeElement;
    abierta = h; h.inert = false; h.classList.add('ver'); velo.classList.add('ver'); h.setAttribute('aria-hidden', 'false');
    fondo(true);
    const foco = h.querySelector('[data-foco]') || h.querySelector('input,select,button');
    if(foco) setTimeout(() => foco.focus(), 60);
  }
  function cerrarHoja(){
    if(!abierta) return;
    const h = abierta;
    h.classList.remove('ver'); h.setAttribute('aria-hidden', 'true'); h.inert = true; velo.classList.remove('ver');
    abierta = null; fondo(false);
    h.dispatchEvent(new CustomEvent('hoja-cerrada'));
    if(volverA && volverA.focus) volverA.focus();
  }
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

  window.Comun = { $, esc, normalizeStr, toast, mensajeError, iniciales, abrirHoja, cerrarHoja };
})();
