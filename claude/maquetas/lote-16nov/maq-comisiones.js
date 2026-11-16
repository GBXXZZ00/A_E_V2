// Maqueta 16/11: dentro del plegable del líder en Comisiones, "Por instalar" (órdenes de hasta 5 días) y "Migraciones" (también las sin registrar), con sus filtros.
// Montada sobre la app del simulador clonando las filas reales. Datos inventados.
const { chromium, H, TEL, PC, contexto, pin } = require('../../../pruebas/simulador');
const CSS = `.mq-sec{font-weight:700}.mq-sec.am{background:#FDF8EC !important;color:#8A5A00 !important}.mq-sec.az{background:#EEF2FC !important;color:#1A3A9E !important}
.mq-sec .mq-pl{float:right;font-weight:600;font-size:12px;color:inherit;opacity:.8}
.mq-ch{display:inline-flex;align-items:center;height:24px;padding:0 9px;border-radius:99px;font-size:11.5px;font-weight:700;white-space:nowrap}
.mq-ch.am{background:#FDF3DC;color:#8A5A00}.mq-ch.ro{background:#FBE5E3;color:#A32116}.mq-ch.az{background:#E8EDFB;color:#1A3A9E}.mq-ch.ve{background:#E3F4EA;color:#0F6642}`;
function montar(){
  const g = document.querySelector('#lista .grupo.cx-grupo.abierto') || document.querySelector('#lista .grupo.cx-grupo') || document.querySelector('#lista');
  const cuerpo = g.querySelector('.grupo-cuerpo') || g; const base = cuerpo.querySelector('button.cx-fila2, button.cx-lf'); const sec0 = cuerpo.querySelector('.cx-sec'); if(!base || !sec0) return 'sin filas';
  const sec = (t, c, der) => { const s = sec0.cloneNode(false); s.className = 'cx-sec mq-sec ' + c; s.innerHTML = t + (der ? '<span class="mq-pl">' + der + '</span>' : ''); return s; };
  const fila = (f, hace, cli, doc, ord, est, chip) => { const r = base.cloneNode(true); const q = (c) => r.querySelector(c);
    if(q('.cx-lf-f')) q('.cx-lf-f').innerHTML = '<b>' + f + '</b><small>' + hace + '</small>';
    if(q('.cx-lf-c')) q('.cx-lf-c').innerHTML = '<b>' + cli + '</b><small>' + doc + '</small>';
    if(q('.cx-lf-o')) q('.cx-lf-o').textContent = ord; if(q('.cx-lf-p')) q('.cx-lf-p').innerHTML = est; if(q('.cx-lf-k')) q('.cx-lf-k').innerHTML = chip; return r; };
  const ref = sec0; const ins = (n) => cuerpo.insertBefore(n, ref);
  ins(sec('Por instalar · órdenes de hasta 5 días · 3', 'am', 'Las de más de 5 días están en Por instalar'));
  ins(fila('Orden 15/11', 'hace 1 día', 'Ferretería Ensayo, C.A.', 'J-591000201 · sin código todavía', '410031', 'Sin instalar · lleva 1 d 3 h', '<span class="mq-ch am">Faltan 2 documentos</span>'));
  ins(fila('Orden 13/11', 'hace 3 días', 'Panadería Ejemplo, C.A.', 'J-000000011 · sin código todavía', '410024', 'Sin instalar · lleva 3 d 6 h', '<span class="mq-ch ve">Documentos completos</span>'));
  ins(fila('Orden 12/11', 'hace 4 días', 'Cliente provisional · Óptica Demo', 'Sin RIF · súbelo para adelantar', '410019', '<b style="color:#A32116">Sin instalar · lleva 4 d 9 h</b>', '<span class="mq-ch ro">Sin documentos</span>'));
  ins(sec('Migraciones · 2', 'az', 'Ya hechas en el sistema'));
  ins(fila('31/10', 'hace 16 días', 'Comercial de Prueba 7, C.A.', 'J-591000077 · 824-9910007', 'PROMO → PYME', 'Migración sin registrar', '<span class="mq-ch am">Faltan documentos</span>'));
  ins(fila('02/11', 'hace 14 días', 'Tornillos El Yunque, C.A.', 'J-591000044 · 824-99100004', '1 GB → PYME', 'Migración confirmada', '<span class="mq-ch az">Comisión por decidir</span>'));
  const fs = document.querySelector('#filtros'); if(fs){ const b = [...fs.querySelectorAll('button')]; const mig = b.find((x) => /Migraciones/.test(x.textContent)); const nb = (mig || b[b.length - 1]).cloneNode(true);
    nb.classList.remove('on'); nb.innerHTML = 'Por instalar <em>3</em>'; fs.insertBefore(nb, mig || null); if(mig) mig.innerHTML = 'Migraciones <em>2</em>'; }
  const st = g.querySelector('.stats'); if(st){ const a = document.createElement('span'); a.className = st.firstElementChild ? st.firstElementChild.className : ''; a.textContent = '3 por instalar'; st.insertBefore(a, st.firstChild); }
  return 'ok'; }
(async () => { const nav = await chromium.launch();
  for(const [quien, u, c] of [['admin', 'marcos', '482913'], ['lider', 'lucia', '739105']]) for(const [d, dev] of [['pc', PC], ['tel', TEL]]){
    const { ctx } = await contexto(nav, dev); const p = await ctx.newPage(); await p.goto(H + 'index.html'); await p.waitForSelector('#pasoEquipo:not(.hidden)');
    await p.click('[data-equipo="ventas"]'); await p.fill('#usuario', u); await p.click('#seguir'); await pin(p, c, d === 'pc'); await p.waitForURL(/inicio/);
    await p.goto(H + 'comisiones.html'); await p.waitForTimeout(1800); await p.addStyleTag({ content: CSS });
    const r = await p.evaluate(montar); if(r !== 'ok') console.log(quien, d, r);
    if(d === 'pc') await p.setViewportSize({ width: 1366, height: 900 });
    await p.screenshot({ path: __dirname + '/img/comisiones-' + quien + '-' + d + '.png', fullPage: d === 'tel' }); await ctx.close(); }
  await nav.close(); console.log('listo'); })();
