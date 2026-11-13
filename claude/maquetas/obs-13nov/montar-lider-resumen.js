// Maqueta 13/11 (consejo): Comisiones del líder (PC y teléfono) y Resumen nuevo, montados sobre la app real del simulador.
// Datos inventados. Uso: servidor en la raíz y node claude/maquetas/obs-13nov/montar-lider-resumen.js /ruta/salida/
const { chromium, H, PC, TEL, contexto, entrar } = require('../../../pruebas/simulador');
const OUT = process.argv[2] || './img/';
const CSS = `
/* ---------- Líder ---------- */
.zz-nums{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin:14px 0 6px}
.zz-n{border:1.5px solid var(--line);border-radius:16px;padding:12px 14px;background:#fff;text-align:left;display:flex;flex-direction:column;gap:2px;min-height:76px}
.zz-n b{font-size:26px;font-weight:800;line-height:1.1}.zz-n span{font-size:13px;color:var(--text2);font-weight:600}
.zz-n.on{border-color:var(--text);box-shadow:0 0 0 1px var(--text) inset}
.zz-n.ve b{color:#0F6642}.zz-n.am b{color:#754B00}.zz-n.ro b{color:#A32117}.zz-n.az b{color:#1F45C4}
.zz-bus{display:flex;gap:8px;align-items:center;margin:12px 0 4px;flex-wrap:wrap}
.zz-bus .campo{height:44px;border-radius:99px;padding-left:16px;flex:1;min-width:220px}
.zz-pl{height:40px;padding:0 14px;border-radius:99px;border:1.5px solid var(--line);background:#fff;font-size:13.5px;font-weight:600;display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.zz-pl.on{background:var(--text);color:#fff;border-color:var(--text)}.zz-pl i{font-style:normal;opacity:.6;font-weight:700}
.zz-sec{margin-top:18px}
.zz-sec h3{flex-wrap:wrap;font-size:13px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;margin:0 0 6px;color:var(--text2);display:flex;gap:8px;align-items:center}
.zz-sec h3.ro{color:#A32117}.zz-sec h3 small{text-transform:none;letter-spacing:0;font-weight:500;color:var(--text2);font-size:12.5px}
.zz-f{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,2fr) auto;gap:16px;align-items:center;padding:14px 16px;border:1px solid var(--line);border-radius:16px;background:#fff;margin-bottom:8px}
.zz-f .cl b{display:block;font-size:15px}.zz-f .cl small{display:block;font-size:12.5px;color:var(--text2);margin-top:2px}
.zz-f .fa{display:flex;flex-wrap:wrap;gap:6px}
.zz-c{height:28px;padding:0 10px;border-radius:99px;font-size:12.5px;font-weight:700;display:inline-flex;align-items:center;white-space:nowrap}
.zz-c.am{background:#FBF1DC;color:#754B00}.zz-c.ro{background:#FCEDEB;color:#A32117}.zz-c.ve{background:#E7F5EE;color:#0F6642}.zz-c.az{background:#E8EEFF;color:#1F45C4}.zz-c.mo{background:#F0EBFA;color:#5B3AA6}.zz-c.gr{background:#F1F2F4;color:var(--text2);font-weight:600}
.zz-f .ac{display:flex;gap:8px;align-items:center}
.zz-btn{height:40px;padding:0 16px;border-radius:99px;background:#1B3A9E;color:#fff;font-weight:700;font-size:13.5px;border:0;white-space:nowrap}
.zz-btn.s{background:#F1F2F4;color:var(--text)}
@media (max-width:899px){
  #cxNuevo{display:none !important}
  .zz-fab{position:fixed;right:16px;bottom:calc(var(--nav-alto) + 16px);z-index:40;height:52px;padding:0 20px;border-radius:99px;background:#1B3A9E;color:#fff;font-weight:700;font-size:15px;border:0;box-shadow:0 8px 24px rgba(27,58,158,.3)}
  .zz-n:first-child{min-height:0 !important}
  .zz-sec h3 small{flex-basis:100%}
  .zz-nums{grid-template-columns:1fr 1fr;gap:8px}.zz-n{min-height:64px;padding:10px 12px}.zz-n b{font-size:22px}
  .zz-n:first-child{grid-column:1 / -1;flex-direction:row;align-items:baseline;gap:8px}
  .zz-bus{position:sticky;top:0;background:#fff;z-index:5;padding:8px 0;margin:8px 0 0}
  .zz-bus .campo{min-width:0}
  .zz-f{grid-template-columns:1fr;gap:10px}.zz-f .ac .zz-btn{width:100%;height:48px}.zz-f .ac{display:block}
}
/* ---------- Resumen ---------- */
.zz-r{display:flex;flex-direction:column;gap:14px;margin-top:14px}
.zz-box{border:1px solid var(--line);border-radius:20px;background:#fff;padding:18px 20px}
.zz-box h3{font-size:16px;font-weight:800;margin:0}.zz-box .sub{font-size:13px;color:var(--text2);margin:3px 0 14px}
.zz-gan{display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:0;border:1px solid var(--line);border-radius:20px;background:#FAFAFB;overflow:hidden}
.zz-gan>div{padding:14px 18px;border-left:1px solid var(--line)}.zz-gan>div:first-child{border-left:0}
.zz-gan small{display:block;font-size:12px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.05em}
.zz-gan b{display:block;font-size:16px;margin-top:4px}.zz-gan span{display:block;font-size:13px;color:var(--text2);margin-top:2px}
.zz-gan .t{grid-column:1 / -1;border-left:0;border-bottom:1px solid var(--line);padding:10px 18px;font-size:13px;font-weight:800;display:flex;gap:8px;align-items:center;background:#fff}
.zz-k{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:12px}
.zz-kc{border:1px solid var(--line);border-radius:20px;background:#fff;padding:16px 18px;display:flex;flex-direction:column;gap:4px}
.zz-kc .l{font-size:13px;color:var(--text2);font-weight:600}.zz-kc .v{font-size:34px;font-weight:800;line-height:1.1}.zz-kc .v small{font-size:16px;color:var(--text2);font-weight:700}
.zz-d{display:inline-flex;align-items:center;gap:4px;font-size:13px;font-weight:800;padding:2px 8px;border-radius:99px;width:max-content}
.zz-d.up{background:#E7F5EE;color:#0F6642}.zz-d.dn{background:#FCEDEB;color:#A32117}
.zz-kc .x{font-size:12.5px;color:var(--text2)}
.zz-mini{height:6px;border-radius:99px;background:#ECEEF1;overflow:hidden;margin-top:4px}.zz-mini i{display:block;height:100%;background:#0F6642;border-radius:99px}
.zz-g2{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:14px}
.zz-g3{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr) minmax(0,1fr);gap:14px}
.zz-eq{display:flex;flex-direction:column;gap:14px}
.zz-eq .fi .h{display:flex;justify-content:space-between;align-items:baseline;font-size:13.5px}.zz-eq .fi .h b{font-size:14px}
.zz-bar{height:12px;border-radius:99px;background:#F1F2F4;display:flex;overflow:hidden;margin-top:6px}.zz-bar i{display:block;height:100%}
.zz-bar.prev{height:6px;margin-top:4px}.zz-bar.prev i{background:#B8BEC6}
.zz-sep{border-top:1px dashed var(--line);padding-top:12px}
.zz-ley{display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:var(--text2);margin-top:12px}.zz-ley span{display:inline-flex;align-items:center;gap:6px}.zz-ley i{width:10px;height:10px;border-radius:3px;display:inline-block}
.zz-tabs2{display:inline-flex;background:#F3F4F6;border-radius:99px;padding:3px;float:right}.zz-tabs2 span{height:32px;padding:0 12px;border-radius:99px;display:inline-flex;align-items:center;font-size:12.5px;font-weight:700;color:var(--text2)}.zz-tabs2 span.on{background:#fff;color:var(--text);box-shadow:0 1px 3px rgba(17,19,21,.12)}
.zz-rk{display:flex;flex-direction:column;gap:8px}
.zz-rk .f{display:grid;grid-template-columns:22px 130px 1fr 190px;gap:10px;align-items:center;font-size:13.5px}
.zz-rk .f .n{color:var(--text2);font-weight:700}.zz-rk .f .r{white-space:nowrap;text-align:right;font-size:12.5px;color:var(--text2)}.zz-rk .f .r b{color:var(--text)}
.zz-rk .f.yo{background:#E8ECF9;border-radius:10px;padding:6px 8px;margin:0 -8px}
.zz-pi{display:flex;flex-direction:column;gap:10px}
.zz-pi .f{display:grid;grid-template-columns:130px 1fr 34px;gap:10px;align-items:center;font-size:13.5px}.zz-pi .f b{text-align:right}
.zz-pi .perd{display:flex;justify-content:space-between;align-items:center;background:#FCEDEB;color:#A32117;border-radius:12px;padding:10px 12px;font-size:13.5px;font-weight:700;margin-top:4px}
.zz-m .tot{font-size:30px;font-weight:800}.zz-m .tot small{font-size:14px;color:var(--text2);font-weight:600}
.zz-m .li{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-top:1px solid var(--line);font-size:13.5px}.zz-m .li{gap:12px}.zz-m .li span{display:flex;align-items:center;gap:8px}.zz-m .li i{width:10px;height:10px;border-radius:3px}
.zz-m .li b{font-size:14px}
@media (max-width:899px){ .zz-gan{grid-template-columns:1fr}.zz-gan>div{border-left:0;border-top:1px solid var(--line)} .zz-k{grid-template-columns:1fr 1fr} .zz-g2,.zz-g3{grid-template-columns:1fr} .zz-rk .f{grid-template-columns:22px 1fr auto} .zz-rk .f .bb{display:none} .zz-rk .f .r{font-size:12px} .zz-tabs2{float:none;margin-top:8px} }
`;
// ---------- datos inventados ----------
const FILAS = [
  ['pierde', 'Panadería Los Andes, C.A.', 'J-591000099 · 824-9910009 · instalada 12/10', ['<span class="zz-c ro">Faltan: acta constitutiva</span>', '<span class="zz-c am">Pago por revisar</span>'], 'docs'],
  ['falta', 'Vidrios El Faro, C.A.', 'J-591000011 · 824-99100001 · instalada 05/11', ['<span class="zz-c am">Faltan: cédula y RIF del representante</span>'], 'docs'],
  ['falta', 'Kiosco La Parada', 'V-99100022 · 824-99100002 · instalada 09/11', ['<span class="zz-c am">Legal la devolvió: RIF vencido</span>', '<span class="zz-c ro">Debe la instalación</span>'], 'docs'],
  ['falta', 'Ferretería El Puerto, C.A.', 'J-591000077 · 824-9910007 · instalada 10/11', ['<span class="zz-c az">En revisión con Legal</span>', '<span class="zz-c ro">Debe la instalación</span>'], 'ver'],
  ['falta', 'Óptica Central, C.A.', 'J-591000121 · 824-99100011 · migración confirmada 06/11', ['<span class="zz-c az">Migración</span>', '<span class="zz-c am">Faltan: RIF de la empresa</span>'], 'docs'],
  ['ok', 'Bodegón La Esquina', 'V-99100033 · 824-99100013 · migración confirmada 02/11', ['<span class="zz-c az">Migración</span>', '<span class="zz-c ve">Comisiona</span>'], ''],
  ['res', 'Lavandería Sol', 'V-99100044 · 824-99100014 · pasó a residencial el 08/11', ['<span class="zz-c ro">Pasó a residencial</span>', '<span class="zz-c gr">Cuenta en contra</span>'], ''],
  ['ok', 'Tornillos El Yunque, C.A.', 'J-591000044 · 824-99100004 · instalada 05/11', ['<span class="zz-c ve">Comisiona</span>', '<span class="zz-c gr">Carta: la envía Canales</span>'], ''],
];
const fila = (f) => '<div class="zz-f"><div class="cl"><b>' + f[1] + '</b><small>' + f[2] + '</small></div><div class="fa">' + f[3].join('') + '</div><div class="ac">' +
  (f[4] === 'docs' ? '<button class="zz-btn">Subir documentos</button>' : f[4] === 'ver' ? '<button class="zz-btn s">Ver</button>' : '') + '</div></div>';
const sec = (cls, t, sub, l) => '<div class="zz-sec"><h3 class="' + cls + '">' + t + ' · ' + l.length + (sub ? ' <small>' + sub + '</small>' : '') + '</h3>' + l.map(fila).join('') + '</div>';
const LIDER = '<div class="zz-nums"><button class="zz-n"><b>5</b><span>Instaladas del corte</span></button><button class="zz-n ve"><b>1</b><span>Comisionan</span></button><button class="zz-n am"><b>3</b><span>Deben documentos</span></button><button class="zz-n ro"><b>2</b><span>Deben el pago</span></button><button class="zz-n az"><b>2</b><span>Migraciones</span></button></div>' +
  '<div class="zz-bus"><input class="campo" placeholder="Buscar cliente o código" aria-label="Buscar cliente o código"><span class="zz-pl on">Todas <i>8</i></span><span class="zz-pl">Comisionan <i>1</i></span><span class="zz-pl">Faltan documentos <i>3</i></span><span class="zz-pl">Falta el pago <i>2</i></span><span class="zz-pl">Migraciones <i>2</i></span><span class="zz-pl" aria-label="Más">···</span></div>' +
  sec('ro', 'Se pierden el 18/11 si no cumplen', 'vienen del corte de octubre', FILAS.filter((f) => f[0] === 'pierde')) +
  sec('', 'Les falta algo', '', FILAS.filter((f) => f[0] === 'falta')) + sec('', 'Ya comisionan', '', FILAS.filter((f) => f[0] === 'ok')) + sec('ro', 'Pasaron a residencial', 'cuentan en contra', FILAS.filter((f) => f[0] === 'res'));
const flecha = (up, t) => '<span class="zz-d ' + (up ? 'up' : 'dn') + '">' + (up ? '↑' : '↓') + ' ' + t + '</span>';
const RES = '<div class="zz-r">' +
  '<div class="zz-gan"><div class="t">🏆 Ganadores de octubre <span style="font-weight:500;color:var(--text2)">· corte cerrado, por equipo</span></div><div><small>Ventas corporativas</small><b>Rosa Paredes</b><span>15 instaladas · 15 comisionan</span></div><div><small>Canales de atención</small><b>Pedro Salas</b><span>4 instaladas</span></div><div><small>Aliado comercial</small><b>Conexión Norte</b><span>2 instaladas</span></div></div>' +
  '<div class="zz-k"><div class="zz-kc"><span class="l">Instaladas del corte · Ventas corporativas</span><span class="v">44</span>' + flecha(false, '8 %') + '<span class="x">48 en octubre al día 26 del corte</span></div>' +
  '<div class="zz-kc"><span class="l">Ya comisionan</span><span class="v">4 <small>de 44</small></span><div class="zz-mini"><i style="width:9%"></i></div><span class="x">40 todavía sin legal o pago</span></div>' +
  '<div class="zz-kc"><span class="l">Órdenes atrasadas</span><span class="v" style="color:#754B00">8</span><span class="x">Del corte, sin instalar hace más de 1 día</span></div>' +
  '<div class="zz-kc"><span class="l">Días de orden a instalación</span><span class="v">2,6</span>' + flecha(false, '0,4 días') + '<span class="x">2,2 en octubre. Si sube, es peor</span></div></div>' +
  '<div class="zz-g2"><div class="zz-box"><span class="zz-tabs2"><span class="on">Líderes</span><span>Canales</span><span>Aliados comerciales</span></span><h3>Ranking del corte</h3><p class="sub">Instaladas por persona en este corte</p><div class="zz-rk">' +
    [['1', 'Rosa Paredes', 11, 1], ['2', 'Tomás Guerra', 11, 0], ['3', 'Lucía Ferrer', 8, 0], ['4', 'Ana Ríos', 7, 0], ['5', 'Carla Méndez', 4, 0], ['6', 'Nora Díaz', 3, 0]].map((r) => '<div class="f"><span class="n">' + r[0] + '</span><span>' + r[1] + '</span><span class="zz-bar bb"><i style="flex:' + r[3] + ';background:#0F6642"></i><i style="flex:' + (r[2] - r[3]) + ';background:#8FD1AE"></i><i style="flex:' + (11 - r[2]) + '"></i></span><span class="r"><b>' + r[2] + ' instaladas</b> · ' + r[3] + ' comisiona' + (r[3] === 1 ? '' : 'n') + '</span></div>').join('') +
    '</div><div class="zz-ley"><span><i style="background:#0F6642"></i>Comisiona</span><span><i style="background:#8FD1AE"></i>Instalada, falta legal o pago</span></div></div>' +
  '<div class="zz-box"><h3>Equipos</h3><p class="sub">Este corte contra octubre, al mismo día del corte</p><div class="zz-eq">' +
    [['Ventas corporativas', 44, 4, 48, '↓ 8 %', 'dn'], ['Canales de atención', 1, 0, 6, '↓ 83 %', 'dn']].map((e) => '<div class="fi"><div class="h"><b>' + e[0] + '</b><span><b>' + e[1] + '</b> · octubre ' + e[3] + ' <span class="zz-d ' + e[5] + '">' + e[4] + '</span></span></div><div class="zz-bar"><i style="flex:' + e[2] + ';background:#1F45C4"></i><i style="flex:' + (e[1] - e[2]) + ';background:#A9BCF5"></i><i style="flex:' + Math.max(0, 60 - e[1]) + '"></i></div><div class="zz-bar prev"><i style="flex:' + e[3] + '"></i><i style="flex:' + (60 - e[3]) + ';background:none"></i></div></div>').join('') +
    '<div class="fi zz-sep"><div class="h"><b>Aliados comerciales</b><span><b>12</b> · octubre 7 <span class="zz-d up">↑ 71 %</span></span></div><div class="zz-bar"><i style="flex:12;background:#4B5563"></i><i style="flex:48"></i></div><div class="zz-bar prev"><i style="flex:7"></i><i style="flex:53;background:none"></i></div></div>' +
    '<div class="fi"><div class="h"><b>Sin dueño</b><span><b>9</b> · no comisionan hasta asignarlas</span></div></div>' +
    '</div><div class="zz-ley"><span><i style="background:#1F45C4"></i>Comisiona</span><span><i style="background:#A9BCF5"></i>Pendiente</span><span><i style="background:#4B5563"></i>Aliados</span><span><i style="background:#B8BEC6"></i>Octubre al mismo día</span></div></div></div>' +
  '<div class="zz-g3"><div class="zz-box"><span class="zz-tabs2"><span class="on">Ritmo del corte</span><span>Cortes cerrados</span></span><h3>Instaladas por corte</h3><p class="sub">Ventas corporativas, día a día, contra los cortes anteriores</p>' +
    '<svg viewBox="0 0 420 190" style="width:100%;height:auto;display:block" role="img" aria-label="Ritmo del corte"><g stroke="#ECEEF1">' + [20, 60, 100, 140].map((y) => '<line x1="30" x2="410" y1="' + y + '" y2="' + y + '"/>').join('') + '</g>' +
    '<g font-size="10" fill="#69717C">' + [['60', 20], ['40', 60], ['20', 100], ['0', 140]].map((t) => '<text x="4" y="' + (t[1] + 3) + '">' + t[0] + '</text>').join('') + '<text x="30" y="160">día 1</text><text x="250" y="160">hoy, día 26</text><text x="380" y="160">día 31</text></g>' +
    '<polyline fill="none" stroke="#B8BEC6" stroke-width="2" stroke-dasharray="4 4" points="30,140 90,120 150,100 210,82 270,62 330,44 410,30"/>' +
    '<polyline fill="none" stroke="#69717C" stroke-width="2" points="30,140 90,118 150,96 210,78 270,58 330,40 410,24"/>' +
    '<polyline fill="none" stroke="#1F45C4" stroke-width="3.5" points="30,140 90,124 150,104 210,88 270,72"/><circle cx="270" cy="72" r="5" fill="#1F45C4"/><text x="278" y="70" font-size="12" font-weight="800" fill="#1F45C4">44 · ↓ 8 %</text></svg>' +
    '<div class="zz-ley"><span><i style="background:#1F45C4"></i>Noviembre (en curso)</span><span><i style="background:#69717C"></i>Octubre</span><span><i style="background:#B8BEC6"></i>Promedio de 3 cortes</span></div></div>' +
  '<div class="zz-box"><h3>Órdenes por instalar</h3><p class="sub">Del corte. A los 10 días se dan por perdidas</p><div class="zz-pi">' +
    [['Al día', 'menos de 1 día', 4, '#B8BEC6'], ['Atrasadas', '1 a 3 días', 5, '#E0A93B'], ['Muy atrasadas', '4 a 9 días', 3, '#E5776B']].map((r) => '<div class="f"><span><b style="text-align:left;display:block">' + r[0] + '</b><small style="color:var(--text2)">' + r[1] + '</small></span><span class="zz-bar"><i style="flex:' + r[2] + ';background:' + r[3] + '"></i><i style="flex:' + (8 - r[2]) + '"></i></span><b>' + r[2] + '</b></div>').join('') +
    '<div class="perd"><span>Perdidas · 10 días o más, o de antes del corte</span><span>13 ›</span></div></div></div>' +
  '<div class="zz-box zz-m"><h3>Dinero del corte</h3><p class="sub">30 $ por cliente con legal y pago, incluidas migraciones</p><div class="tot">480 $ <small>posibles</small></div>' +
    '<div class="zz-bar" style="height:14px;margin:10px 0 6px"><i style="flex:150;background:#0F6642"></i><i style="flex:300;background:#E0A93B"></i><i style="flex:30;background:#A32117"></i></div>' +
    '<div class="li"><span><i style="background:#0F6642"></i>Asegurado · 5 clientes</span><b style="color:#0F6642">150 $</b></div><div class="li"><span><i style="background:#E0A93B"></i>En juego · 10 pueden cumplir antes del 18/11</span><b style="color:#754B00">300 $</b></div><div class="li"><span><i style="background:#A32117"></i>Última oportunidad · 1 viene de octubre</span><b style="color:#A32117">30 $</b></div></div></div>' +
  '</div>';
(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const nav = await chromium.launch();
  for(const [n, dev] of [['pc', PC], ['tel', TEL]]){
    const { ctx } = await contexto(nav, dev); const p = await entrar(ctx, 'lucia', '739105');
    await p.goto(H + 'comisiones.html'); await p.waitForSelector('#lista .cx-grupo, #lista', { timeout: 15000 }); await p.waitForTimeout(1500); await p.addStyleTag({ content: CSS });
    await p.evaluate((h) => { document.querySelector('#rango').textContent = 'Tus instalaciones del corte. Cierra el 18/11: faltan 5 días.';
      document.querySelector('#segs').innerHTML = ''; document.querySelector('.cx-panel').outerHTML = ''; document.querySelector('#lista').innerHTML = h;
      const seg = document.querySelector('#segs'); seg.style.display = 'none'; document.body.insertAdjacentHTML('beforeend', '<button class="zz-fab">+ Cliente nuevo</button>'); const fab = document.querySelector('.zz-fab'); if(window.innerWidth >= 900) fab.remove(); }, LIDER);
    await p.waitForTimeout(400); await p.screenshot({ path: OUT + '20-lider-lista-' + n + '.png', fullPage: n === 'pc' });
    if(n === 'tel'){ await p.screenshot({ path: OUT + '20-lider-lista-tel-larga.png', fullPage: true }); }
    await ctx.close();
  }
  for(const [n, dev] of [['pc', PC], ['tel', TEL]]){
    const { ctx } = await contexto(nav, dev); const p = await entrar(ctx, 'marcos', '482913');
    await p.goto(H + 'comisiones.html'); await p.waitForTimeout(1500);
    await p.locator('button', { hasText: /^Resumen$/ }).first().click(); await p.waitForSelector('.cr-nums', { timeout: 15000 }); await p.waitForTimeout(800); await p.addStyleTag({ content: CSS });
    await p.evaluate((h) => { const nums = document.querySelector('.cr-nums'); const cont = nums.parentElement; const kids = Array.from(cont.children); const i = kids.findIndex((k) => k.contains(nums) || k === nums);
      // deja la cabecera (Lista/Resumen y corte) y cambia todo lo demás
      const desde = kids.findIndex((k) => /Líder de|cr-lider|cr-band/.test(k.className + ' ' + k.textContent.slice(0, 30)));
      kids.slice(desde >= 0 ? desde : i).forEach((k) => k.remove()); cont.insertAdjacentHTML('beforeend', h); }, RES);
    await p.waitForTimeout(400); await p.screenshot({ path: OUT + '21-resumen-' + n + '.png', fullPage: true });
    await ctx.close();
  }
  await nav.close();
})();
