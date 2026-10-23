// Arma assets/js/practica-mundo.js: el mismo mundo de mentira de las pruebas (mundo.js y mundo-aliados.js), para el navegador.
// Se corre después de cambiar mundo.js: node armar-practica.js. La prueba 48 avisa si quedó viejo.
const fs = require('fs');
const leer = (f) => fs.readFileSync(__dirname + '/' + f, 'utf8');
function armar(){
  return '// ARCHIVO ARMADO con pruebas/armar-practica.js. No editar a mano: cambia pruebas/mundo.js y vuelve a armarlo.\n' +
    '(function(){\n"use strict";\nvar M = {};\nfunction def(n, f){ M[n] = { f: f, e: null }; }\n' +
    'function require(n){ var k = String(n).replace("./", ""); var x = M[k]; if(!x) throw new Error("Falta " + n); if(!x.e){ var module = { exports: {} }; x.e = module.exports; x.f(module, module.exports, require); x.e = module.exports; } return x.e; }\n' +
    'def("mundo", function(module, exports, require){\n' + leer('mundo.js') + '\n});\n' +
    'def("mundo-aliados", function(module, exports, require){\n' + leer('mundo-aliados.js') + '\n});\n' +
    'window.PracticaMundo = { mundo: require("./mundo"), aliados: require("./mundo-aliados") };\n})();\n';
}
if(require.main === module){ fs.writeFileSync(__dirname + '/../assets/js/practica-mundo.js', armar()); console.log('Listo: assets/js/practica-mundo.js'); }
module.exports = { armar };
