// Maqueta 13/11 (corregida): la lista del líder con el diseño actual intacto. Solo cambia: filtros (sin Equipo, sin Por dueño,
// con Faltan documentos y Falta el pago a la vista), migraciones dentro de la lista con la etiqueta "Migración" y sin la tarjeta "Cambios de categoría".
// Datos inventados. Uso: servidor en la raíz y node claude/maquetas/obs-13nov/montar-lider-lista.js /ruta/salida/
const { chromium, H, PC, TEL, contexto, entrar } = require('../../../pruebas/simulador');
const OUT = process.argv[2] || './img/';
const CSS = `
.cx-panel{border:0 !important;padding:0 !important;background:none !important;box-shadow:none !important;margin:8px 0 14px !important;display:flex;flex-direction:column;gap:12px}
.zz-t1{display:flex;align-items:center;gap:8px}.zz-t1 .cx-buscar{flex:1;min-width:0;margin:0 !important}
.zz-ic{width:44px;height:44px;border-radius:50%;border:1.5px solid var(--line);background:#fff;display:grid;place-items:center;font-weight:800;font-size:16px;letter-spacing:1px;flex:none}
.zz-t2{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
@media (max-width:899px){ .zz-t2{flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px} .zz-t2 > *{flex:none} }
`;
(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const nav = await chromium.launch();
  for(const [n, dev] of [['pc', PC], ['tel', TEL]]){
    const { ctx } = await contexto(nav, dev); const p = await entrar(ctx, 'lucia', '739105');
    await p.goto(H + 'comisiones.html'); await p.waitForSelector('.cx-grupo', { timeout: 15000 }); await p.waitForTimeout(1200); await p.addStyleTag({ content: CSS });
    await p.evaluate(() => {
      // Tarjetas: se quita "Cambios de categoría" (las migraciones van en la lista)
      const segs = Array.from(document.querySelectorAll('#segs > *')); const cc = segs.find((x) => /Cambios de categor/.test(x.textContent)); if(cc) cc.remove();
      // Filtros del líder: buscador y ···; debajo los de estado con Faltan documentos, Falta el pago y Migraciones a la vista
      const pan = document.querySelector('.cx-panel'); const bus = pan.querySelector('.cx-buscar'); const fil = document.querySelector('#filtros');
      const proto = fil.querySelector('button:not(.on)'); const on = fil.querySelector('button.on');
      const mk = (t, nn, act) => { const b = (act ? on : proto).cloneNode(true); b.innerHTML = t + ' <span style="opacity:.6;margin-left:4px">' + nn + '</span>'; return b; };
      fil.innerHTML = ''; [['Todas', 5, 1], ['Comisionan', 2], ['Faltan documentos', 2], ['Falta el pago', 1], ['Carta por enviar', 3], ['Migraciones', 2]].forEach((x) => fil.appendChild(mk(x[0], x[1], x[2])));
      const t1 = document.createElement('div'); t1.className = 'zz-t1'; t1.appendChild(bus); t1.insertAdjacentHTML('beforeend', '<button class="zz-ic" aria-label="Más: fechas y del corte anterior">···</button>');
      const t2 = document.createElement('div'); t2.className = 'zz-t2'; t2.appendChild(fil);
      pan.innerHTML = ''; pan.appendChild(t1); pan.appendChild(t2);
      // Migraciones dentro de la lista, con el mismo diseño de fila y la etiqueta "Migración"
      const g = document.querySelector('.cx-grupo'); const fila = g.querySelector('.cx-fila2[data-com]'); if(!fila) return;
      const sec = Array.from(g.querySelectorAll('.sub-bloque')).find((x) => /Instaladas en este corte/.test(x.textContent)) || fila;
      const nueva = (nom, docu, tag, tx, pts) => { const c = fila.cloneNode(true);
        const b = c.querySelector('.cx-lf-c > b'); if(b) b.textContent = nom; const sm = c.querySelector('.cx-lf-c small'); if(sm) sm.textContent = docu;
        let et = c.querySelector('.cx-et'); if(!et){ et = document.createElement('span'); et.className = 'cx-et'; (c.querySelector('.cx-lf-c') || c).appendChild(et); } et.innerHTML = tag;
        const t = c.querySelector('.cx-lf-p small'); if(t) t.textContent = tx; c.querySelectorAll('.cx-3p i').forEach((i, k) => { i.className = pts[k] ? 'ok' : 'no'; }); return c; };
      const a = nueva('Óptica Central, C.A.', 'J-591000121 · 824-99100011', '<span class="chip azul">Migración</span>', 'Falta legal', [0, 1, 1]);
      const b = nueva('Bodegón La Esquina', 'V-99100033 · 824-99100013', '<span class="chip azul">Migración</span>', 'Comisiona', [1, 1, 1]);
      sec.after(a); a.after(b);
    });
    await p.waitForTimeout(400);
    await p.screenshot({ path: OUT + '20-lider-lista-' + n + '.png', fullPage: n === 'pc' });
    if(n === 'tel'){ await p.evaluate(() => { const f = document.querySelector('.cx-panel'); window.scrollTo(0, f.getBoundingClientRect().top + window.scrollY - 90); }); await p.waitForTimeout(300); await p.screenshot({ path: OUT + '20b-lider-lista-tel-lista.png' }); }
    await ctx.close();
  }
  await nav.close();
})();
