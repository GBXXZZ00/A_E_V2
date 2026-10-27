// Enlaces viejos: cliente.html y dedicados.html ya no son pantallas; llevan a Clientes con lo que traía el enlace.
// Lote 27/10: panel.html tampoco (cada módulo tiene su Resumen); lleva a Inicio.
// Lote S: va en archivo aparte porque la política de seguridad (CSP) no deja correr código escrito dentro del HTML.
(function(){
  if(/panel\.html$/.test(location.pathname)){ location.replace('inicio.html'); return; }
  var u = new URLSearchParams(location.search); var n = new URLSearchParams();
  if(/dedicados\.html$/.test(location.pathname)){
    // Dedicados: tarjeta ISP, o la hoja del cliente si el enlace la traía
    if(Number(u.get('c'))){ n.set('c', u.get('c')); if(u.get('t')) n.set('t', u.get('t')); } else n.set('s', 'isp');
  } else {
    // El expediente se abre encima de la lista de Clientes
    if(u.get('id')) n.set('c', u.get('id')); ['t', 'revisar', 'pedir'].forEach(function(k){ if(u.get(k)) n.set(k, u.get(k)); });
  }
  location.replace('clientes.html' + (n.toString() ? '?' + n.toString() : ''));
})();
