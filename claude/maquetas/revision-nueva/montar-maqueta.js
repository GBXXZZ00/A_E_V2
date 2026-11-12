// Maqueta v2 de la revisión nueva, montada sobre la app real del simulador. Datos inventados.
// Uso: servidor en la raíz (python3 -m http.server 8765) y desde esta carpeta: node montar-maqueta.js /ruta/salida/
const { chromium, H, PC, contexto, entrar } = require('../../../pruebas/simulador');
const OUT = process.argv[2] || './img-src/';
const CSS = `
.zz-ov{position:fixed;inset:0;z-index:400;display:grid;place-items:center}
.zz-ov:before{content:"";position:absolute;inset:0;background:rgba(17,19,21,.36);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
.zz-rv{position:relative;width:1300px;height:724px;background:#fff;border-radius:24px;box-shadow:0 24px 60px rgba(17,19,21,.25);display:grid;grid-template-rows:auto auto 1fr auto;overflow:hidden}
.zz-cab{display:flex;align-items:center;gap:14px;padding:16px 24px 12px}
.zz-cab h2{font-size:20px;font-weight:800;margin:0}.zz-cab small{display:block;font-size:13.5px;color:var(--text2);margin-top:3px}
.zz-cab .der{margin-left:auto;display:flex;gap:10px;align-items:center}
.zz-ia{margin:0 24px 14px;border-radius:14px;padding:12px 16px;display:flex;align-items:center;gap:14px;font-size:13.5px}
.zz-ia .tx{flex:1}.zz-ia b{font-size:14.5px;margin-right:6px}
.zz-ia.ok{background:#E7F5EE;color:#0F6642}.zz-ia.mal{background:#FFF6E3;color:#754B00}.zz-ia.lee{background:#E8EEFF;color:#1F45C4}.zz-ia.no{background:#F5F6F7;color:var(--text2)}
.zz-bar{width:180px;height:8px;border-radius:99px;background:rgba(31,69,196,.15);overflow:hidden;position:relative}
.zz-bar i{position:absolute;inset:0;background:#1F45C4;border-radius:99px;transform-origin:left}
.zz-c{display:grid;grid-template-columns:380px 1fr;min-height:0;border-top:1px solid var(--line)}
.zz-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 14px}.zz-tabs span{height:38px;padding:0 14px;border-radius:99px;border:1.5px solid var(--line);display:inline-flex;align-items:center;gap:8px;font-weight:600;font-size:13.5px;background:#fff}.zz-tabs span i{font-style:normal;font-size:11.5px;padding:1px 7px;border-radius:99px;background:var(--surface-2,#F5F6F7)}.zz-tabs span.on{background:var(--text);border-color:var(--text);color:#fff}.zz-tabs span.on i{background:rgba(255,255,255,.18)}
.zz-l{border-right:1px solid var(--line);overflow:auto;padding:8px 12px 14px}
.zz-gr{display:flex;align-items:center;justify-content:space-between;padding:14px 10px 6px;font-size:11.5px;font-weight:800;letter-spacing:.06em;color:var(--text3,#69717C);text-transform:uppercase}
.zz-d{display:flex;align-items:center;gap:12px;padding:12px 12px;border-radius:14px;margin-bottom:2px}
.zz-d.sel{background:#E8ECF9}
.zz-d .tx{flex:1;min-width:0}.zz-d b{display:block;font-size:15px}.zz-d small{display:block;font-size:12.5px;color:var(--text2);margin-top:2px}
.zz-e{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;flex:none;font-size:13px;font-weight:800}
.zz-e.b{background:#0F6642;color:#fff}.zz-e.d{background:#A32117;color:#fff}.zz-e.a{background:#FBF1DC;color:#754B00;border:1.5px solid #E0A93B}.zz-e.n{border:2px solid #C9CED6}.zz-e.y{background:#ECEEF1;color:var(--text2)}
.zz-v{display:flex;flex-direction:column;min-height:0;background:#F4F5F7}
.zz-vh{display:flex;align-items:center;gap:14px;padding:14px 20px;background:#fff;border-bottom:1px solid var(--line)}
.zz-vh h3{font-size:17px;font-weight:800;margin:0}.zz-vh small{display:block;font-size:13px;color:var(--text2);margin-top:3px}.zz-vh small.am{color:#754B00;font-weight:600}.zz-vh small.ve{color:#0F6642;font-weight:600}
.zz-vh .der{margin-left:auto;display:flex;gap:10px}
.zz-btnv{background:#0F6642 !important;border-color:#0F6642 !important;color:#fff !important}
.zz-btnr{background:#fff !important;color:#A32117 !important;border:1.5px solid #F0B4AE !important}
.zz-btnr.on{background:#A32117 !important;color:#fff !important;border-color:#A32117 !important}
.zz-nota{margin:12px 20px 0;border-radius:12px;padding:10px 14px;font-size:13.5px;background:#FFF6E3;color:#754B00}
.zz-nota.ok{background:#E7F5EE;color:#0F6642}
.zz-pdf{margin:12px 20px 0;flex:1;border-radius:10px;overflow:hidden;display:grid;grid-template-rows:38px 1fr;min-height:0;background:#525659}
.zz-pdf .tb{background:#323639;color:#E8EAED;display:flex;align-items:center;gap:14px;padding:0 14px;font-size:12.5px}
.zz-pdf .tb .der{margin-left:auto;display:flex;gap:14px}
.zz-pdf .pz{overflow:hidden;padding:16px 0;display:flex;justify-content:center}
.zz-pg{width:420px;background:#fff;border-radius:2px;padding:26px 30px;box-shadow:0 2px 10px rgba(0,0,0,.3)}
.zz-pg .t{font-size:12.5px;font-weight:800;text-align:center;letter-spacing:.06em;margin:0}
.zz-pg .l{height:7px;border-radius:3px;background:#E3E6EA;margin-top:10px}.zz-pg .l.c{width:70%}.zz-pg .l.m{width:85%}
.zz-dt{display:flex;gap:16px;align-items:center;padding:10px 20px 12px}
.zz-dt label{font-size:12.5px;font-weight:700;margin-right:6px}.zz-dt>div{display:flex;align-items:center}
.zz-dt .campo{height:40px;width:180px;font-size:13.5px;background:#fff}
.zz-dt .sub{font-size:13.5px;color:var(--text2);height:40px;display:flex;align-items:center}
.zz-mot{margin:12px 20px 0;background:#fff;border:1.5px solid #F0B4AE;border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;gap:10px}
.zz-mot p{margin:0;font-size:14px;font-weight:800}
.zz-mot .ops{display:flex;flex-wrap:wrap;gap:8px}
.zz-mot .ops span{height:34px;padding:0 14px;border-radius:99px;border:1.5px solid var(--line);display:grid;place-items:center;font-size:13px;font-weight:600}
.zz-mot .ops span.on{border-color:#A32117;color:#A32117;background:#FCEDEB}
.zz-mot .nt{min-height:42px;border:1.5px solid var(--line);border-radius:10px;font-size:13.5px;padding:10px 12px}
.zz-pie{display:flex;align-items:center;gap:14px;padding:14px 24px;border-top:1px solid var(--line)}
.zz-pie .zres{flex:1;font-size:14px;color:var(--text2)}.zz-pie .zres b{color:var(--text);font-size:14px}
.zz-peq{position:relative;width:620px;background:#fff;border-radius:24px;box-shadow:0 24px 60px rgba(17,19,21,.25);padding:28px;display:flex;flex-direction:column;gap:14px}
.zz-peq h2{font-size:22px;font-weight:800;margin:0}
.zz-peq .dat{border:1px solid var(--line);border-radius:14px}
.zz-peq .dat div{display:grid;grid-template-columns:120px 1fr;gap:10px;padding:12px 16px;border-top:1px solid var(--line);font-size:14px}
.zz-peq .dat div:first-child{border-top:0}.zz-peq .dat span{color:var(--text2)}
.zz-peq .msj{border:1.5px solid var(--line);border-radius:12px;padding:12px 14px;font-size:13.5px;line-height:1.5}
.zz-peq .acc{display:flex;gap:10px;justify-content:flex-end}
.zz-peq.ok{background:#EAF6EF;align-items:center;text-align:center}.zz-peq.am{background:#FFF6E3;align-items:center;text-align:center}
.zz-peq .ic{width:72px;height:72px;border-radius:50%;background:#fff;display:grid;place-items:center}
.zz-wa{background:#128C4B !important;border-color:#128C4B !important}
.zz-pt{display:inline-flex;gap:4px;margin-left:6px;vertical-align:middle}.zz-pt i{width:6px;height:6px;border-radius:50%;background:currentColor;animation:zzp 1s infinite}.zz-pt i:nth-child(2){animation-delay:.15s}.zz-pt i:nth-child(3){animation-delay:.3s}
@keyframes zzp{0%,100%{opacity:.25}40%{opacity:1}}
`;
const OK = '<svg class="i" viewBox="0 0 24 24" style="width:14px;height:14px"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const E = { b: '<span class="zz-e b">' + OK + '</span>', d: '<span class="zz-e d">!</span>', a: '<span class="zz-e a">!</span>', n: '<span class="zz-e n"></span>', y: '<span class="zz-e y">' + OK + '</span>' };
const d = (t, s, e, sel) => '<div class="zz-d' + (sel ? ' sel' : '') + '">' + E[e] + '<span class="tx"><b>' + t + '</b><small>' + s + '</small></span></div>';
const repCab = (n, firma) => '<div class="zz-gr">Representante ' + n + (firma ? '<span class="chip azul">Firma este</span>' : '<button class="mini" style="height:30px">Marcar que firma</button>') + '</div>';
const lista = (o) => repCab(1, true) + d('Cédula', o.ced || 'Cuadra · vigente hasta 2031', o.cedE || 'b', o.sel === 'ced') + d('RIF personal', o.rifp || 'Cuadra · mismo nombre', o.rifpE || 'b') + d('Teléfono y correo', o.cont || '0414-555 01 34 · gerente@vidrioselfaro.test', o.contE || 'n', o.sel === 'cont') +
  (o.rep2 === false ? '' : repCab(2, false) + d('Cédula', o.ced2 || 'Cuadra · vigente', o.ced2E || 'b', o.sel === 'ced2') + d('RIF personal', 'Cuadra · mismo nombre', 'b') + d('Teléfono y correo', '0412-300 22 10 · socio@vidrioselfaro.test', o.cont2E || 'b')) +
  '<div class="zz-gr">Empresa</div>' + d('RIF de la empresa', 'Aprobado antes', 'y') + d('Acta constitutiva', o.acta || 'La IA: junta vencida', o.actaE || 'a', o.sel === 'acta') + d('Acta de asamblea 1', o.asa || 'Falta la fecha del acta', o.asaE || 'n', o.sel === 'asa') + d('Correo de la empresa', 'admin@vidrioselfaro.test', o.corrE || 'b');
const pdf = (t, pag) => '<div class="zz-pdf"><div class="tb"><span>' + t + '.pdf</span><span class="der"><span>' + pag + '</span><span>−</span><span>100 %</span><span>+</span></span></div><div class="pz"><div class="zz-pg"><p class="t">' + t.toUpperCase() + '</p>' + Array.from({ length: 26 }, (_, i) => '<div class="l' + (i % 3 === 2 ? ' c' : i % 3 === 1 ? ' m' : '') + '"></div>').join('') + '</div></div></div>';
const IA = { mal: '<div class="zz-ia mal"><span class="tx"><b>La IA encontró 1 cosa</b>La junta directiva venció el 14/03/2017 (acta constitutiva, página 6). Lo demás cuadra.</span><button class="mini">Ver en el acta</button></div>',
  ok: '<div class="zz-ia ok"><span class="tx"><b>La IA revisó todo y cuadra</b>Documentos vigentes, junta vigente, el representante firma y el domicilio es el del RIF.</span></div>',
  lee: '<div class="zz-ia lee"><span class="tx"><b>La IA está leyendo<span class="zz-pt"><i></i><i></i><i></i></span></b>3 de 4 documentos. Puedes empezar a mirar; lo que encuentre aparece aquí.</span><span class="zz-bar"><i style="transform:scaleX(.72)"></i></span></div>',
  no: '<div class="zz-ia no"><span class="tx"><b>Estás revisando tú</b>La IA no ha leído estos documentos. Si quieres su ayuda, pásaselos (unos US$ 0,16).</span><button class="btn btn-chico btn-2">Que la revise la IA</button></div>' };
const dt = '<div class="zz-dt"><div><label>Fecha del acta</label><input class="campo" type="date" value="2012-03-14"></div><div><label>También trae</label><span class="sub" style="height:auto">Acta de asamblea 1</span></div><button class="mini" style="margin-left:auto">Reemplazar archivo</button></div>';
const rv = (o) => '<div class="zz-ov"><div class="zz-rv"><div class="zz-cab"><div><h2>' + (o.tit || 'Revisar expediente') + '</h2><small>Vidrios El Faro, C.A. · J-59100001-1 · Lucía Ferrer · ' + (o.sub || 'subió 4 documentos ayer') + '</small></div><div class="der"><a class="mini" href="#" style="display:inline-flex;align-items:center;gap:6px"><svg class="i" viewBox="0 0 24 24" style="width:16px;height:16px"><path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>Abrir carpeta en Drive</a><button class="cerrar" aria-label="Cerrar"><svg class="i" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div></div>' + o.ia +
  '<div class="zz-c"><div class="zz-l">' + o.lista + '</div><div class="zz-v"><div class="zz-vh"><div><h3>' + o.vt + '</h3><small>' + o.vs + '</small></div><div class="der">' + o.dec + '</div></div>' + (o.nota || '<div></div>') + (o.pdf) + (o.dt === undefined ? dt : o.dt) + '</div></div>' +
  '<div class="zz-pie"><span class="zres">' + o.res + '</span>' + o.btn + '</div></div></div>';
const DEC = (s) => '<button class="btn btn-chico zz-btnr' + (s === 'd' ? ' on' : '') + '">Devolver</button><button class="btn btn-chico ' + (s === 'b' ? 'zz-btnv' : 'btn-2') + '">' + (s === 'b' ? 'Bien ✓' : 'Bien') + '</button>';
(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const nav = await chromium.launch();
  const tomar = async (p, n) => { await p.waitForTimeout(450); await p.screenshot({ path: OUT + n + '.png' }); console.log('ok', n); };
  const { ctx, mundo } = await contexto(nav, PC);
  const p = await entrar(ctx, 'marcos', '482913');
  await p.goto(H + 'clientes.html?c=1001&t=documentos'); await p.waitForSelector('#revisarTodo', { timeout: 15000 }); await p.waitForTimeout(800);
  await p.addStyleTag({ content: CSS });
  const ficha = async (titulo, sub, extra) => p.evaluate(([t, s, x]) => {
    const b = document.querySelector('#paso'); if(b){ b.innerHTML = '<div style="flex:1"><b>' + t + '</b><small style="display:block">' + s + '</small>' + (x || '') + '</div>' + (t.indexOf('·') < 0 && /todavía/.test(s) ? '<button class="btn btn-chico btn-2">Que la revise la IA</button>' : '') + '<button class="btn btn-chico">Revisar</button>'; b.style.display = 'flex'; b.style.alignItems = 'center'; b.style.gap = '12px'; }
    const l = document.querySelector('#tab-documentos .rp-linea'); if(l){ const box = l.parentElement && l.parentElement.id !== 'tab-documentos' && !l.parentElement.classList.contains('doc-sec-c') ? l.parentElement : l; box.remove(); }
    const a = document.querySelector('#revisarTodo'); if(a) a.closest('.acc').remove();
    const ia = document.querySelector('.ia-bloque'); if(ia) ia.remove();
  }, [titulo, sub, extra]);
  await ficha('4 documentos por revisar', 'Nadie los ha revisado todavía. Tú decides: los revisas tú o se los pasas a la IA.'); await tomar(p, '01-ficha-decides');
  await ficha('4 documentos por revisar', 'Se los pasaste a la IA. Está leyendo: 3 de 4', '<span class="zz-bar" style="display:block;margin-top:8px;width:220px;background:rgba(117,75,0,.15)"><i style="transform:scaleX(.72);background:#C98A12"></i></span>');
  await tomar(p, '01a-ficha-ia-leyendo');
  await ficha('4 documentos por revisar', 'La IA ya los leyó: 3 cuadran y 1 tiene algo que mirar'); await tomar(p, '01-ficha-ia-lista');
  
  const poner = async (html) => { await p.evaluate((h) => { document.querySelectorAll('.zz-ov').forEach((x) => x.remove()); if(h) document.body.insertAdjacentHTML('beforeend', h); const l = document.querySelector('.zz-l'); const sl = document.querySelector('.zz-d.sel'); if(l && sl) l.scrollTop = Math.max(0, sl.offsetTop - 260); }, html); };
  await poner(rv({ ia: IA.mal, lista: lista({ sel: 'acta' }), vt: 'Acta constitutiva', vs: '<small class="am">La IA: la junta se nombró el 14/03/2012 por 5 años y venció el 14/03/2017. Abre en la página 6.</small>', dec: DEC(''), pdf: pdf('Acta constitutiva', '6 / 9'), res: '<b>3 bien</b> · faltan 2 por decidir', btn: '<button class="btn" disabled>Aprobar expediente</button>' }));
  await tomar(p, '02-revision');
  await poner(rv({ ia: IA.mal, lista: lista({ sel: 'acta', acta: 'Se devuelve: falta un acta', actaE: 'd' }), vt: 'Acta constitutiva', vs: 'Mismo archivo que el acta de asamblea 1 · página 6', dec: DEC('d'), nota: '<div class="zz-mot"><p>¿Por qué lo devuelves?</p><div class="ops"><span>Está vencido</span><span>Ilegible o incompleto</span><span>No es de esta empresa</span><span>Falta firma o sello</span><span class="on">Falta un acta</span><span>Otro</span></div><div class="nt">Falta el acta de asamblea de ratificación o cambio de junta directiva</div></div>', pdf: pdf('Acta constitutiva', '6 / 9'), dt: '', res: '<b>3 bien</b> · <b style="color:#A32117">1 se devuelve</b> · falta 1 · nada se envía hasta terminar', btn: '<button class="btn" disabled>Terminar y avisar a Lucía</button>' }));
  await tomar(p, '03-devolver');
  await poner(rv({ ia: IA.mal, lista: lista({ sel: 'cont', contE: 'd', cont: 'Se devuelve: el número no es del representante', acta: 'Se devuelve: falta un acta', actaE: 'd' }), vt: 'Teléfono y correo · Representante 1', vs: 'Se usan para la firma digital del contrato', dec: DEC('d'), nota: '<div class="zz-mot"><p>¿Qué problema tiene?</p><div class="ops"><span class="on">El número no es del representante</span><span>No contesta</span><span>El correo rebota</span><span>El correo no es de él</span><span>Otro</span></div><div class="nt">Contestó la secretaria; hace falta el celular del representante</div></div>', pdf: '<div style="margin:12px 20px 0;background:#fff;border:1px solid var(--line);border-radius:14px;padding:6px 0"><div class="zz-d"><span class="tx"><b>Teléfono</b><small>0414-555 01 34</small></span><button class="mini">Editar</button></div><div class="zz-d"><span class="tx"><b>Correo</b><small>gerente@vidrioselfaro.test</small></span><button class="mini">Editar</button></div></div><div style="flex:1"></div>', dt: '', res: '<b>4 bien</b> · <b style="color:#A32117">2 se devuelven</b> · nada se envía hasta terminar', btn: '<button class="btn">Terminar y avisar a Lucía</button>' }));
  await tomar(p, '03b-contacto-problema');
  await poner(rv({ ia: IA.mal, lista: lista({ sel: 'ced2', ced2: 'Cuadra · vigente' }), vt: 'Cédula · Representante 2', vs: '<small class="ve">La IA: vigente; está en la junta del acta constitutiva.</small>', dec: '<button class="btn btn-chico btn-2">Marcar que firma</button>' + DEC(''), pdf: pdf('Cedula', '1 / 1'), dt: '<div class="zz-dt"><span class="sub" style="height:auto">¿Este representante ya no aplica?</span><button class="mini">No está en la junta</button><button class="mini">Ya no aplica</button></div>', res: '<b>Firma el representante 1</b> · tócalo en el otro si cambia', btn: '<button class="btn" disabled>Aprobar expediente</button>' }));
  await tomar(p, '03c-quien-firma');
  await poner('<div class="zz-ov"><div class="zz-peq"><h2>Avisar a Lucía</h2><div class="dat"><div><span>Se aprueban</span><b>Cédula, RIF personal y Acta de asamblea 1</b></div><div><span>Se devuelve</span><b>Acta constitutiva: falta el acta de ratificación de la junta</b></div><div><span>Queda en</span><b>Documentos pendientes</b></div></div><p style="font-size:13.5px;font-weight:700;margin:0">Mensaje (puedes cambiarlo)</p><div class="msj">Hola Lucía. De Vidrios El Faro, C.A. falta el acta de asamblea de ratificación o cambio de junta directiva (la junta venció en 2017). Cuando la tengas, súbela a la app. Gracias.</div><div class="acc"><button class="btn btn-2">Solo guardar</button><button class="btn zz-wa">Guardar y enviar por WhatsApp</button></div></div></div>');
  await tomar(p, '04-avisar');
  await poner(rv({ ia: IA.ok, lista: lista({ sel: 'acta', acta: 'Cuadra · junta vigente hasta 2027', actaE: 'b', asa: 'Cuadra · fecha 14/03/2012', asaE: 'b' }), vt: 'Acta constitutiva', vs: '<small class="ve">La IA: junta vigente hasta 2027, el representante está en la junta y el domicilio coincide.</small>', dec: DEC('b'), pdf: pdf('Acta constitutiva', '1 / 9'), res: '<b>Todo bien</b> · al aprobar pasa a Documentos recibidos y Legal aprobado', btn: '<button class="btn zz-btnv">Aprobar expediente</button>' }));
  await tomar(p, '05-todo-bien');
  await poner('<div class="zz-ov"><div class="zz-peq ok"><span class="ic" style="color:#0F6642">' + OK.replace('width:14px;height:14px', 'width:30px;height:30px') + '</span><h2 style="color:#0F6642">Expediente aprobado</h2><p style="font-size:14.5px;color:var(--text2);margin:0">Legal queda aprobado y el cliente pasa a Documentos recibidos. A la abogada le aparece para elaborar el contrato.</p><div class="acc" style="justify-content:center;width:100%"><button class="btn btn-2">Avisar a Lucía</button><button class="btn">Siguiente cliente</button></div></div></div>');
  await tomar(p, '06-aprobado');
  await poner(rv({ ia: IA.lee, lista: lista({ sel: 'ced', acta: 'Leyendo…', actaE: 'n', asa: 'Leyendo…', ced: 'Cuadra · vigente hasta 2031' }), vt: 'Cédula', vs: '<small class="ve">La IA: vigente hasta 2031 y el nombre coincide con el RIF personal.</small>', dec: DEC(''), pdf: pdf('Cedula', '1 / 1'), dt: '', res: 'Puedes decidir ya · la IA completa lo que falta', btn: '<button class="btn" disabled>Aprobar expediente</button>' }));
  await tomar(p, '07-ia-leyendo');
  await poner(rv({ ia: IA.no, lista: lista({ sel: 'ced', ced: 'Sin leer', cedE: 'n', rifp: 'Sin leer', rifpE: 'n', acta: 'Sin leer', actaE: 'n', asa: 'Sin leer' }), vt: 'Cédula', vs: 'Representante 1 · subida ayer por Lucía', dec: DEC(''), pdf: pdf('Cedula', '1 / 1'), dt: '', res: 'Faltan 4 por decidir', btn: '<button class="btn" disabled>Aprobar expediente</button>' }));
  await tomar(p, '08-sin-ia');
  // Clientes: pestañas por estatus legal
  await poner('');
  await p.goto(H + 'clientes.html'); await p.waitForTimeout(1800); await p.addStyleTag({ content: CSS });
  const cuenta = {}; (mundo.datos.clientes || []).forEach((c) => { cuenta[c.estatus] = (cuenta[c.estatus] || 0) + 1; });
  await p.evaluate((cu) => {
    const f = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Filtros'); if(!f) return;
    const E = window.Comun.ESTATUS; const tot = Object.values(cu).reduce((a, b) => a + b, 0);
    const col = { gris: '#8A929C', azul: '#1F45C4', rojo: '#A32117', ambar: '#C98A12', verde: '#0F6642', morado: '#5B3AA6' };
    const tabs = '<span class="on">Todos <i>' + tot + '</i></span>' + Object.keys(E).map((k) => '<span><b style="width:8px;height:8px;border-radius:50%;background:' + (col[E[k].c] || '#8A929C') + ';display:inline-block"></b>' + E[k].t + ' <i>' + (cu[k] || 0) + '</i></span>').join('');
    f.parentElement.insertAdjacentHTML('beforebegin', '<p style="margin:14px 0 6px;font-size:12px;font-weight:700;letter-spacing:.06em;color:var(--text2);text-transform:uppercase">Estatus legal</p><div class="zz-tabs" role="tablist" aria-label="Estatus legal" style="margin-top:0">' + tabs + '</div>');
  }, cuenta);
  await tomar(p, '20-clientes-pestanas');
  await ctx.close();
  // Abogada
  const c2 = await contexto(nav, PC, mundo);
  mundo.personas.push({ id: '77777777-7777-4777-8777-777777777777', usuario: 'paula', pin: '615243', nombre: 'Paula Legal', rol: 'abogado', cargo: 'Legal', equipo: 'ventas', activo: true, debe_cambiar_pin: false });
  const cli = mundo.datos.clientes; cli[0].estatus = 'documentos_recibidos'; (cli[0].documentos || []).forEach((x) => { if(x.estado === 'por_revisar') x.estado = 'aprobado'; });
  const l = await entrar(c2.ctx, 'paula', '615243');
  await l.goto(H + 'clientes.html?c=' + cli[0].id + '&t=documentos'); await l.waitForSelector('#hojaFicha .lp', { timeout: 15000 }).catch(() => {}); await l.waitForTimeout(800);
  await l.addStyleTag({ content: CSS });
  await l.evaluate(() => { const lp = document.querySelector('#hojaFicha .lp'); if(!lp) return; const bs = lp.querySelectorAll('button'); const prim = Array.from(bs).find((b) => /Empecé/.test(b.textContent)); const pr = lp.querySelector('[data-problema]');
    if(prim){ const box = prim.parentElement; box.innerHTML = '<button class="btn" style="flex:1">Ver documentos y empezar</button>'; }
    const n = lp.querySelector('p, .nota-chica'); if(n) n.textContent = 'Primero miras los documentos; ahí mismo tocas "Empecé el contrato" o "Hay un problema".'; });
  await l.screenshot({ path: OUT + '10-abogada-ficha.png' }); console.log('ok 10');
  const listaA = (o) => lista(Object.assign({ ced: 'Aprobado por Marcos', cedE: 'b', rifp: 'Aprobado por Marcos', rifpE: 'b', acta: 'Aprobado por Marcos', actaE: 'b', asa: 'Aprobado por Marcos', asaE: 'b' }, o));
  const decA = (s) => '<button class="btn btn-chico zz-btnr' + (s === 'p' ? ' on' : '') + '">Tiene un problema</button>';
  const rvA = (o) => rv(Object.assign({ tit: 'Documentos para el contrato', sub: 'aprobado por Marcos el 12 nov', ia: '<div class="zz-ia ok"><span class="tx"><b>Expediente aprobado por Marcos</b>Míralos y empieza el contrato. Si algo te impide hacerlo, márcalo en ese documento.</span></div>', dt: '' }, o));
  const pon = async (h) => { await l.evaluate((x) => { document.querySelectorAll('.zz-ov').forEach((y) => y.remove()); document.body.insertAdjacentHTML('beforeend', x); const q = document.querySelector('.zz-l'); const sl = document.querySelector('.zz-d.sel'); if(q && sl) q.scrollTop = Math.max(0, sl.offsetTop - 260); }, h); await l.waitForTimeout(400); };
  await pon(rvA({ lista: listaA({ sel: 'acta' }), vt: 'Acta constitutiva', vs: 'Solo lectura · 9 páginas', dec: decA(''), pdf: pdf('Acta constitutiva', '2 / 9'), res: 'Todo aprobado · al empezar pasa a Contrato en curso', btn: '<button class="btn btn-2">Hay un problema</button><button class="btn">Empecé el contrato</button>' }));
  await l.screenshot({ path: OUT + '11-abogada-documentos.png' }); console.log('ok 11');
  await pon(rvA({ lista: listaA({ sel: 'acta', acta: 'Tiene un problema', actaE: 'd' }), vt: 'Acta constitutiva', vs: 'Solo lectura · página 2', dec: decA('p'), nota: '<div class="zz-mot"><p>¿Qué problema tiene?</p><div class="ops"><span>Está vencido</span><span>Ilegible</span><span class="on">Datos no coinciden</span><span>Falta un acta</span><span>Otro</span></div><div class="nt">El objeto de la empresa no incluye telecomunicaciones</div></div>', pdf: pdf('Acta constitutiva', '2 / 9'), res: '<b style="color:#A32117">1 con problema</b> · nada se envía hasta terminar', btn: '<button class="btn">Terminar y enviar a Marcos</button>' }));
  await l.screenshot({ path: OUT + '12-abogada-problema.png' }); console.log('ok 12');
  // Mi trabajo de la abogada: el filtro por tipo arriba vale para todas las secciones
  const hoy = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  mundo.datos.extra = [
    { tipo: 'elaborar_contrato', clave: 'e1', cliente_id: cli[0].id, titulo: cli[0].nombre, detalle: 'PYME · en Documentos recibidos', seg: 'PYME', para: 'abogado', vence: hoy(-2), desde: hoy(-5) + 'T12:00:00Z', ref: {} },
    { tipo: 'elaborar_contrato', clave: 'e2', cliente_id: cli[1].id, titulo: cli[1].nombre, detalle: 'Dedicado ISP · en Documentos recibidos', seg: 'Dedicado ISP', para: 'abogado', vence: hoy(1), desde: hoy(-1) + 'T12:00:00Z', ref: {} },
    { tipo: 'seguir_firma', clave: 'f1', cliente_id: cli[2].id, titulo: cli[2].nombre, detalle: 'Dedicado corporativo · enviado a firmar hace 4 días', seg: 'Dedicado corporativo', para: 'abogado', vence: hoy(0), desde: hoy(-4) + 'T12:00:00Z', ref: {} },
    { tipo: 'seguir_firma', clave: 'f2', cliente_id: cli[3].id, titulo: cli[3].nombre, detalle: 'PYME · enviado a firmar hace 2 días', seg: 'PYME', para: 'abogado', vence: hoy(2), desde: hoy(-2) + 'T12:00:00Z', ref: {} },
    { tipo: 'contrato_archivo', clave: 'a1', cliente_id: cli[4].id, titulo: cli[4].nombre, detalle: 'Dedicado ISP · firmado, falta subir el archivo', seg: 'Dedicado ISP', para: 'abogado', vence: hoy(0), desde: hoy(-1) + 'T12:00:00Z', ref: {} }];
  await l.goto(H + 'trabajo.html'); await l.waitForSelector('#cuerpo [data-hacer]', { timeout: 15000 }).catch(() => {}); await l.waitForTimeout(900); await l.addStyleTag({ content: CSS });
  await l.evaluate(() => {
    const cu = document.querySelector('#cuerpo'); if(!cu) return;
    const chipsViejos = Array.from(cu.querySelectorAll('button, span')).filter((b) => /^(Todos|ISP|Corporativo|VGT|PYME)\s*\d*$/.test(b.textContent.trim()));
    const fila = chipsViejos.length ? chipsViejos[0].parentElement : null; if(fila) fila.remove();
    const primera = cu.querySelector('section, details, .bz-sec, .sec') || cu.firstElementChild;
    const T = [['Todos', 5, 1], ['ISP', 2], ['Corporativo', 1], ['VGT', 0], ['PYME', 2]];
    primera.insertAdjacentHTML('beforebegin', '<div class="zz-tabs" role="tablist" aria-label="Tipo de cliente" style="margin-top:0">' + T.map((t) => '<span class="' + (t[2] ? 'on' : '') + '">' + t[0] + ' <i>' + t[1] + '</i></span>').join('') + '<span style="border:0;background:none;color:var(--text2);font-weight:500">Vale para todas las secciones de abajo</span></div>');
    cu.querySelectorAll('details').forEach((d) => d.open = true);
  });
  await l.waitForTimeout(400); await l.screenshot({ path: OUT + '21-abogada-mi-trabajo.png' }); console.log('ok 21');
  await l.setViewportSize({ width: 1366, height: 1300 }); await l.screenshot({ path: OUT + '21b-abogada-mi-trabajo-larga.png' }); await l.setViewportSize({ width: 1366, height: 768 });
  await nav.close();
})();
