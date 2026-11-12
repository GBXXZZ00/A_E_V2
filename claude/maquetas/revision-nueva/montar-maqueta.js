// Uso: servidor en la raíz (python3 -m http.server 8765) y desde esta carpeta: node montar-maqueta.js. Cambia OUT a una carpeta tuya.
// Maqueta de la revisión nueva, montada sobre la app real del simulador (no es prueba). Datos inventados.
const { chromium, H, PC, contexto, entrar } = require('../../../pruebas/simulador');
const OUT = '/home/claude/gen/rn/';
const CSS = `
.zz-ov{position:fixed;inset:0;z-index:400;display:grid;place-items:center}
.zz-ov:before{content:"";position:absolute;inset:0;background:rgba(17,19,21,.34);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
.zz-rv{position:relative;width:1240px;height:704px;background:#fff;border-radius:24px;box-shadow:0 24px 60px rgba(17,19,21,.25);display:grid;grid-template-rows:auto 1fr auto;overflow:hidden}
.zz-cab{display:flex;align-items:center;gap:14px;padding:14px 20px;border-bottom:1px solid var(--line)}
.zz-cab h2{font-size:19px;font-weight:800;margin:0}.zz-cab small{display:block;font-size:13px;color:var(--text2);margin-top:2px}
.zz-cab .der{margin-left:auto;display:flex;gap:8px;align-items:center}
.zz-c{display:grid;grid-template-columns:440px 1fr;min-height:0}
.zz-l{border-right:1px solid var(--line);overflow:auto;padding-bottom:10px}
.zz-ia{margin:12px 14px 4px;border-radius:14px;padding:12px 14px;font-size:13px;line-height:1.45}
.zz-ia b{display:block;font-size:13.5px;margin-bottom:2px}
.zz-ia.ok{background:var(--verde-bg,#E7F5EE);color:var(--verde,#0F6642)}.zz-ia.mal{background:#FFF6E3;color:#754B00}
.zz-ia .acc{display:flex;gap:8px;margin-top:8px}
.zz-gr{display:flex;align-items:center;justify-content:space-between;padding:12px 16px 4px;font-size:11px;font-weight:800;letter-spacing:.06em;color:var(--text3,#69717C);text-transform:uppercase}
.zz-d{display:grid;grid-template-columns:34px 1fr auto;gap:10px;align-items:center;padding:8px 12px;margin:0 6px;border-radius:12px}
.zz-d.sel{background:#E8ECF9}
.zz-d .mi{width:34px;height:42px;border-radius:6px;background:#ECEEF1;border:1px solid var(--line);position:relative;overflow:hidden}
.zz-d .mi:after{content:"";position:absolute;left:5px;right:5px;top:8px;height:24px;background:repeating-linear-gradient(#C9CED6 0 2px,transparent 2px 6px)}
.zz-d .mi.dato{background:#E7F5EE;border-color:#BFE3CF}.zz-d .mi.dato:after{display:none}
.zz-d b{display:block;font-size:13.5px}.zz-d small{display:block;font-size:12px;color:var(--text2)}
.zz-d small.zm{color:#754B00;font-weight:600}.zz-d small.zr{color:#A32117;font-weight:600}
.zz-sw{display:flex;border:1.5px solid var(--line);border-radius:99px;padding:3px;gap:2px}
.zz-sw span{height:30px;padding:0 12px;border-radius:99px;display:grid;place-items:center;font-size:12.5px;font-weight:700;color:var(--text2)}
.zz-sw .b.on{background:#0F6642;color:#fff}.zz-sw .d.on{background:#A32117;color:#fff}
.zz-dev{margin:2px 14px 8px 56px;border:1.5px solid #F0B4AE;background:#FFF8F7;border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:8px}
.zz-dev .zmot{display:flex;flex-wrap:wrap;gap:6px}
.zz-dev .zmot span{height:28px;padding:0 10px;border-radius:99px;border:1.5px solid var(--line);background:#fff;display:grid;place-items:center;font-size:12px;font-weight:600}
.zz-dev .zmot span.on{border-color:#A32117;color:#A32117;background:#FCEDEB}
.zz-dev .nt{min-height:36px;border:1.5px solid var(--line);border-radius:10px;background:#fff;font-size:12.5px;padding:8px 10px}
.zz-v{background:#F4F5F7;display:grid;grid-template-rows:auto 1fr auto;min-height:0}
.zz-vb{display:flex;align-items:center;gap:10px;padding:10px 16px;background:#fff;border-bottom:1px solid var(--line);font-size:13px}
.zz-vb b{font-size:14px}.zz-vb .der{margin-left:auto;display:flex;gap:6px;align-items:center;color:var(--text2)}
.zz-pg{margin:14px auto;width:400px;background:#fff;box-shadow:0 4px 18px rgba(17,19,21,.10);border-radius:4px;padding:24px 28px;position:relative;overflow:hidden}
.zz-pg .t{font-size:12.5px;font-weight:800;text-align:center;letter-spacing:.06em;margin:0}
.zz-pg .l{height:7px;border-radius:3px;background:#E3E6EA;margin-top:9px}.zz-pg .l.c{width:70%}.zz-pg .l.m{width:85%}
.zz-pg .mk{position:absolute;left:20px;right:20px;border:2.5px solid #E0A93B;background:rgba(251,241,220,.5);border-radius:6px}
.zz-pg .et{position:absolute;right:24px;background:#E0A93B;color:#fff;font-size:11px;font-weight:800;padding:3px 8px;border-radius:6px}
.zz-dt{background:#fff;border-top:1px solid var(--line);padding:10px 16px;display:flex;gap:16px;align-items:flex-end}
.zz-dt label{display:block;font-size:12px;font-weight:700;margin-bottom:4px}
.zz-dt .campo{height:38px;width:170px;font-size:13px}
.zz-pie{display:flex;align-items:center;gap:12px;padding:12px 20px;border-top:1px solid var(--line)}
.zz-pie .zres{flex:1;font-size:13.5px;color:var(--text2)}.zz-pie .zres b{color:var(--text);font-size:13.5px}
.zz-cab .mini,.zz-vb .mini{white-space:nowrap}
.zz-peq{position:relative;width:600px;background:#fff;border-radius:24px;box-shadow:0 24px 60px rgba(17,19,21,.25);padding:24px 26px;display:flex;flex-direction:column;gap:12px}
.zz-peq h2{font-size:21px;font-weight:800;margin:0}
.zz-peq .dat{border:1px solid var(--line);border-radius:14px}
.zz-peq .dat div{display:grid;grid-template-columns:120px 1fr;gap:10px;padding:10px 14px;border-top:1px solid var(--line);font-size:13.5px}
.zz-peq .dat div:first-child{border-top:0}.zz-peq .dat span{color:var(--text2)}
.zz-peq .msj{border:1.5px solid var(--line);border-radius:12px;padding:10px 12px;font-size:13px;line-height:1.5}
.zz-peq .acc{display:flex;gap:10px;justify-content:flex-end}
.zz-peq.ok{background:#EAF6EF;align-items:center;text-align:center}.zz-peq.am{background:#FFF6E3;align-items:center;text-align:center}
.zz-peq .ic{width:68px;height:68px;border-radius:50%;background:#fff;display:grid;place-items:center}
.zz-btnv{background:#0F6642 !important;border-color:#0F6642 !important}
.zz-wa{background:#128C4B !important;border-color:#128C4B !important}
.zz-sub{font-size:13px;color:var(--text2)}
`;
const OK = '<svg class="i" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const sw = (e, b = 'Bien', d = 'Devolver') => '<div class="zz-sw"><span class="b' + (e === 'b' ? ' on' : '') + '">' + b + '</span><span class="d' + (e === 'd' ? ' on' : '') + '">' + d + '</span></div>';
const d = (t, s, e, o = {}) => '<div class="zz-d' + (o.sel ? ' sel' : '') + '"><span class="mi' + (o.dato ? ' dato' : '') + '"></span><span><b>' + t + '</b><small class="' + (o.c || '') + '">' + s + '</small></span>' + (o.dato ? '<span class="chip verde">Bien</span>' : o.ya ? '<span class="chip">Aprobado antes</span>' : sw(e, o.b, o.dd)) + '</div>';
const pg = (t, mk) => '<div class="zz-pg"><p class="t">' + t + '</p>' + Array.from({ length: 24 }, (_, i) => '<div class="l' + (i % 3 === 2 ? ' c' : i % 3 === 1 ? ' m' : '') + '"></div>').join('') + (mk ? '<div class="mk" style="top:' + mk[0] + 'px;height:' + mk[1] + 'px"></div><span class="et" style="top:' + (mk[0] - 22) + 'px">' + mk[2] + '</span>' : '') + '</div>';
const lista = (est) => '<div class="zz-gr">Representante 1<span class="chip azul">Firma este</span></div>' +
  d('Contacto', '0414-555 01 34 · gerente@vidrioselfaro.test', '', { dato: true }) +
  d('Cédula', 'La IA: vigente hasta 2031, mismo nombre', est.ced || 'b') + d('RIF personal', 'La IA: vigente, mismo nombre que la cédula', est.rifp || 'b') +
  '<div class="zz-gr">Empresa</div>' + d('Correo de la empresa', 'admin@vidrioselfaro.test', '', { dato: true }) + d('RIF de la empresa', 'Vence el 14 de marzo de 2027', '', { ya: true }) +
  d('Acta constitutiva', est.actaT || 'La IA: junta vencida, página 6', est.acta || '', { sel: est.sel === 'acta', c: est.actaC === undefined ? 'zm' : est.actaC }) + (est.dev || '') +
  d('Acta de asamblea 1', est.asaT || 'Mismo archivo que el acta constitutiva · falta la fecha', est.asa || '', { sel: est.sel === 'asa', c: est.asaC === undefined ? 'zm' : est.asaC });
const IA_MAL = '<div class="zz-ia mal"><b>La IA encontró 1 cosa</b>La junta directiva venció el 14/03/2017 (acta constitutiva, página 6). Lo demás cuadra.<div class="acc"><button class="mini">Ver en el acta</button><button class="mini">Aprobar igual (excepción)</button></div></div>';
const IA_OK = '<div class="zz-ia ok"><b>La IA revisó todo: cuadra</b>Documentos vigentes, junta vigente, el representante está en la junta y el domicilio es el del RIF.</div>';
const rv = (o) => '<div class="zz-ov"><div class="zz-rv"><div class="zz-cab"><div><h2>' + (o.tit || 'Revisar expediente') + ' · Vidrios El Faro, C.A.</h2><small>J-59100001-1 · Lucía Ferrer · ' + (o.sub || 'subió 4 documentos ayer') + '</small></div><div class="der"><a class="mini" href="#">Abrir carpeta en Drive</a><button class="cerrar" aria-label="Cerrar"><svg class="i" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div></div>' +
  '<div class="zz-c"><div class="zz-l">' + o.ia + o.lista + '</div><div class="zz-v"><div class="zz-vb"><span><b>' + o.vt + '</b> · ' + o.vs + '</span><span class="der">Página ' + (o.pag || '6 de 9') + '<button class="mini">‹</button><button class="mini">›</button><a class="mini" href="#">Abrir archivo</a></span></div>' + o.doc +
  '<div class="zz-dt">' + (o.dt || '<div><label>Fecha del acta</label><input class="campo" type="date" value="2012-03-14"></div><div><label>También trae</label><div class="zz-sub" style="height:38px;display:flex;align-items:center">Acta de asamblea 1</div></div><button class="mini" style="margin-left:auto">Reemplazar archivo</button>') + '</div></div></div>' +
  '<div class="zz-pie"><span class="zres">' + o.res + '</span>' + o.btn + '</div></div></div>';
(async () => {
  const nav = await chromium.launch();
  const tomar = async (p, n, full) => { await p.waitForTimeout(450); await p.screenshot({ path: OUT + n + '.png', fullPage: !!full }); console.log('ok', n); };
  const { ctx, mundo } = await contexto(nav, PC);
  const p = await entrar(ctx, 'marcos', '482913');
  await p.goto(H + 'clientes.html?c=1001&t=documentos'); await p.waitForSelector('#revisarTodo', { timeout: 15000 }); await p.waitForTimeout(800);
  await p.addStyleTag({ content: CSS });
  // Ficha nueva: un solo llamado a revisar
  await p.evaluate(() => {
    const b = document.querySelector('#paso'); if(b){ b.className = 'paso ambar'; const t = b.querySelector('b, strong') || b.firstElementChild; b.innerHTML = '<div style="flex:1"><b>4 documentos por revisar</b><small style="display:block">La IA ya los leyó: 3 cuadran y 1 tiene algo que mirar</small></div><button class="btn btn-chico">Revisar</button>'; b.style.display = 'flex'; b.style.alignItems = 'center'; b.style.gap = '12px'; }
    const l = document.querySelector('#tab-documentos .rp-linea'); if(l){ const box = l.parentElement && l.parentElement.id !== 'tab-documentos' && !l.parentElement.classList.contains('doc-sec-c') ? l.parentElement : l; box.remove(); }
    const a = document.querySelector('#revisarTodo'); if(a) a.closest('.acc').remove();
    const ia = document.querySelector('.ia-bloque'); if(ia) ia.remove();
  });
  await tomar(p, '01-ficha');
  await p.setViewportSize({ width: 1366, height: 1900 }); await tomar(p, '01b-ficha-larga'); await p.setViewportSize({ width: 1366, height: 768 });
  const poner = async (html) => { await p.evaluate((h) => { document.querySelectorAll('.zz-ov').forEach((x) => x.remove()); document.body.insertAdjacentHTML('beforeend', h); const l = document.querySelector('.zz-l'); const sel = document.querySelector('.zz-d.sel'); if(l && sel) l.scrollTop = Math.max(0, sel.offsetTop - 150); }, html); };
  const DOC = pg('ACTA CONSTITUTIVA', [262, 64, 'Junta: 5 años desde 14/03/2012']);
  await poner(rv({ ia: IA_MAL, lista: lista({ sel: 'acta' }), vt: 'Acta constitutiva', vs: 'la IA marcó la página 6', doc: DOC, res: '<b>3 bien</b> · faltan 2 por decidir', btn: '<button class="btn" disabled>Aprobar expediente</button>' }));
  await tomar(p, '02-revision');
  const DEV = '<div class="zz-dev"><div class="zmot"><span>Está vencido</span><span>Ilegible</span><span>No es de esta empresa</span><span>Falta firma o sello</span><span class="on">Falta un acta</span><span>Otro</span></div><div class="nt">Falta el acta de asamblea de ratificación o cambio de junta directiva</div></div>';
  await poner(rv({ ia: IA_MAL, lista: lista({ sel: 'acta', acta: 'd', actaT: 'Se devuelve: falta acta de ratificación', actaC: 'zr', dev: DEV, asa: 'b', asaT: 'Fecha puesta: 14/03/2012', asaC: '' }), vt: 'Acta constitutiva', vs: 'la IA marcó la página 6', doc: DOC, res: '<b>4 bien</b> · <b style="color:#A32117">1 se devuelve</b>', btn: '<button class="btn">Terminar y avisar a Lucía</button>' }));
  await tomar(p, '03-devolver');
  await poner('<div class="zz-ov"><div class="zz-peq"><h2>Avisar a Lucía</h2><div class="dat"><div><span>Se aprueban</span><b>Cédula, RIF personal y Acta de asamblea 1</b></div><div><span>Se devuelve</span><b>Acta constitutiva: falta el acta de ratificación de la junta</b></div><div><span>Queda en</span><b>Documentos pendientes</b></div></div><p style="font-size:13px;font-weight:700;margin:0">Mensaje (puedes cambiarlo)</p><div class="msj">Hola Lucía. De Vidrios El Faro, C.A. falta el acta de asamblea de ratificación o cambio de junta directiva (la junta venció en 2017). Cuando la tengas, súbela a la app. Gracias.</div><div class="acc"><button class="btn btn-2">Solo guardar</button><button class="btn zz-wa">Guardar y enviar por WhatsApp</button></div></div></div>');
  await tomar(p, '04-avisar');
  await poner(rv({ ia: IA_OK, lista: lista({ sel: 'acta', acta: 'b', actaT: 'La IA: junta vigente hasta 2027', actaC: '', asa: 'b', asaT: 'Fecha puesta: 14/03/2012', asaC: '' }), vt: 'Acta constitutiva', vs: 'página 6', doc: pg('ACTA CONSTITUTIVA'), res: '<b>Todo bien</b> · la IA no encontró nada', btn: '<button class="btn zz-btnv">Aprobar expediente</button>' }));
  await tomar(p, '05-todo-bien');
  await poner('<div class="zz-ov"><div class="zz-peq ok"><span class="ic" style="color:#0F6642">' + OK.replace('class="i"', 'class="i" style="width:30px;height:30px"') + '</span><h2 style="color:#0F6642">Expediente aprobado</h2><p class="zz-sub" style="font-size:14px;margin:0">Legal queda aprobado y el cliente pasa a Documentos recibidos. A la abogada le aparece para elaborar el contrato.</p><div class="acc" style="justify-content:center;width:100%"><button class="btn btn-2">Avisar a Lucía</button><button class="btn">Siguiente cliente</button></div></div></div>');
  await tomar(p, '06-aprobado');
  await poner('');
  await ctx.close();
  // Abogada
  const c2 = await contexto(nav, PC, mundo);
  mundo.personas.push({ id: '77777777-7777-4777-8777-777777777777', usuario: 'paula', pin: '615243', nombre: 'Paula Legal', rol: 'abogado', cargo: 'Legal', equipo: 'ventas', activo: true, debe_cambiar_pin: false });
  const cli = mundo.datos.clientes; cli[0].estatus = 'documentos_recibidos'; (cli[0].documentos || []).forEach((x) => { if(x.estado === 'por_revisar') x.estado = 'aprobado'; });
  const l = await entrar(c2.ctx, 'paula', '615243');
  await l.goto(H + 'clientes.html?c=' + cli[0].id + '&t=documentos'); await l.waitForSelector('#hojaFicha .lp', { timeout: 15000 }).catch(() => {}); await l.waitForTimeout(800);
  await l.addStyleTag({ content: CSS });
  await l.screenshot({ path: OUT + '10-abogada-ficha.png' }); console.log('ok 10');
  const DEVA = '<div class="zz-dev"><div class="zmot"><span>Está vencido</span><span>Ilegible</span><span class="on">Datos no coinciden</span><span>Falta un acta</span><span>Otro</span></div><div class="nt">El objeto de la empresa no incluye telecomunicaciones</div></div>';
  const listaA = lista({ sel: 'acta', ced: 'b', rifp: 'b', acta: 'd', actaT: 'Tiene un problema', actaC: 'zr', dev: DEVA, asa: 'b', asaT: 'Aprobada', asaC: '' }).replace(/>Bien<\/span><span class="d/g, '>Bien</span><span class="d').replace(/>Devolver</g, '>Problema<').replace(/La IA: [^<]*/g, 'Aprobado');
  await l.evaluate((h) => document.body.insertAdjacentHTML('beforeend', h), rv({ tit: 'Hay un problema', sub: 'aprobado por Marcos el 12 nov', ia: '<div class="zz-ia ok"><b>Aprobado por Marcos el 12 nov</b>Marca solo lo que te impide hacer el contrato.</div>', lista: listaA + '<div class="zz-gr">¿Falta algo que no está?</div><div class="zz-d"><span class="mi" style="border:2px dashed #E0A93B;background:#FFFBF2"></span><span><b>Pedir otro documento</b><small>Elige cuál de la lista</small></span><button class="mini">Agregar</button></div>', vt: 'Acta constitutiva', vs: 'página 2', pag: '2 de 9', doc: pg('ACTA CONSTITUTIVA', [120, 70, 'Objeto de la empresa']), dt: '<span class="zz-sub">Solo lectura: lo aprobó Marcos.</span>', res: '<b>1 con problema</b> · el contrato se detiene', btn: '<button class="btn">Enviar a Marcos</button>' }));
  await l.evaluate(() => { const x = document.querySelector('.zz-l'); const sel = document.querySelector('.zz-d.sel'); if(x && sel) x.scrollTop = Math.max(0, sel.offsetTop - 150); }); await l.waitForTimeout(400); await l.screenshot({ path: OUT + '11-abogada-problema.png' }); console.log('ok 11');
  await nav.close();
})();
