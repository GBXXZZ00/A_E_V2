// Lee una ubicación escrita o pegada: enlace de Google Maps, coordenadas decimales o grados/minutos/segundos.
// Devuelve { lat, lng }, { corto: url } si es un enlace corto que hay que abrir en el servidor, o { error }.
(function(){
  'use strict';
  const num = (t) => Number(String(t).replace(',', '.'));
  function valido(lat, lng){
    if(!isFinite(lat) || !isFinite(lng)) return null;
    // Vinieron al revés: fuera de rango, o la longitud de Venezuela escrita primero
    if((Math.abs(lat) > 90 && Math.abs(lng) <= 90) || (lat >= -75 && lat <= -58 && lng >= 0 && lng <= 14)){ const t = lat; lat = lng; lng = t; }
    if(Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return null;
    return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
  }
  // 10°03'36.4"N 72°33'08.6"W y variantes con º, ′, ″, espacios o el signo
  function gms(t){
    const parte = '(-?\\d{1,3})\\s*[°º˚]\\s*(?:(\\d{1,2}(?:[.,]\\d+)?)\\s*[\'′’]\\s*)?(?:(\\d{1,2}(?:[.,]\\d+)?)\\s*(?:"|″|”|\'\')\\s*)?([NSEWO])?';
    const m = new RegExp(parte + '[\\s,;]+' + parte, 'i').exec(t);
    if(!m) return null;
    const uno = (g, mi, s, h) => { let v = Math.abs(num(g)) + (mi ? num(mi) / 60 : 0) + (s ? num(s) / 3600 : 0); if(String(g).charAt(0) === '-' || /[SWO]/i.test(h || '')) v = -v; return { v, h: (h || '').toUpperCase() }; };
    let a = uno(m[1], m[2], m[3], m[4]); let b = uno(m[5], m[6], m[7], m[8]);
    if(/[EWO]/.test(a.h) && /[NS]/.test(b.h)){ const t2 = a; a = b; b = t2; }
    return valido(a.v, b.v);
  }
  function decimal(t){
    const m = /(-?\d{1,3}\.\d{2,})\s*[,;\s]\s*(-?\d{1,3}\.\d{2,})/.exec(t) || /(-?\d{1,3},\d{3,})\s*[;\s]\s*(-?\d{1,3},\d{3,})/.exec(t);
    return m ? valido(num(m[1]), num(m[2])) : null;
  }
  function desdeUrl(u){
    let s = u; try { s = decodeURIComponent(u); } catch (e) { /* queda como vino */ }
    // El lugar marcado pesa más que el centro de la vista
    let m = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(s); if(m) return valido(num(m[1]), num(m[2]));
    m = /[?&](?:q|query|ll|destination|daddr|center|sll)=(?:loc:)?\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/.exec(s); if(m) return valido(num(m[1]), num(m[2]));
    m = /\/(?:place|search|dir)\/(?:[^/]*\/)?(-?\d+(?:\.\d+)?)\s*,\s*\+?(-?\d+(?:\.\d+)?)/.exec(s); if(m) return valido(num(m[1]), num(m[2]));
    m = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(s); if(m) return valido(num(m[1]), num(m[2]));
    return gms(s) || decimal(s);
  }
  const CORTOS = /^https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs|maps\.google\.com\/\?cid|share\.google)/i;
  function leer(texto){
    const t = String(texto || '').trim();
    if(!t) return { error: 'Pega el enlace o escribe las coordenadas' };
    const url = (/https?:\/\/[^\s<>"']+/i.exec(t) || [])[0];
    if(url){
      const r = desdeUrl(url); if(r) return r;
      if(CORTOS.test(url)) return { corto: url.replace(/[).,;]+$/, '') };
      if(/google\.[a-z.]+\/maps|maps\.google\.|goo\.gl/i.test(url)) return { corto: url.replace(/[).,;]+$/, '') };
      return { error: 'Ese enlace no es de Google Maps. Pega el enlace de la ubicación o escribe las coordenadas' };
    }
    const r = gms(t) || decimal(t);
    return r || { error: 'No entendí esa ubicación. Escribe algo como 10.0601, -72.5524' };
  }
  window.Coordenadas = { leer, desdeUrl };
})();
