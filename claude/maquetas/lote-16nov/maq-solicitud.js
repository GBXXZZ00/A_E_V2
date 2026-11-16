// Maqueta 16/11: solicitud de migración que se abre ya llena desde "Registrar" (migración sin registrar). Montada sobre la app. Datos inventados.
const { chromium, H, TEL, PC, contexto, pin } = require('../../../pruebas/simulador');
const CSS = `
.ms-fondo{position:fixed;inset:0;background:rgba(17,19,21,.45);z-index:90;display:grid;place-items:center}
.ms{background:#fff;border-radius:20px;width:560px;max-height:92vh;overflow:auto;box-shadow:0 24px 60px rgba(17,19,21,.25);display:flex;flex-direction:column}
.ms-cab{padding:18px 22px 12px;border-bottom:1px solid var(--line)}.ms-cab b{font-size:19px;display:block}.ms-cab small{color:var(--text2);font-size:13px}
.ms-c{padding:14px 22px;display:flex;flex-direction:column;gap:14px}
.ms-p{display:flex;gap:10px;align-items:flex-start}.ms-n{width:22px;height:22px;border-radius:50%;background:#0F6642;color:#fff;font-size:12px;font-weight:700;display:grid;place-items:center;flex:none;margin-top:1px}
.ms-n.h{background:#1A3A9E}.ms-p>div{flex:1;min-width:0}.ms-p h4{margin:0 0 6px;font-size:14px}
.ms-box{border:1px solid var(--line);border-radius:12px;padding:10px 12px;font-size:13px}.ms-box b{display:block;font-size:13.5px}.ms-box small{color:var(--text2);font-size:12px}
.ms-box.am{background:#FDF8EC;border-color:#F1DFB4;color:#5C4300}
.ms-doc{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--line);font-size:13px}.ms-doc:first-child{border-top:0}
.ms-doc span{flex:1}.ms-doc small{display:block;color:var(--text2);font-size:11.5px}
.ms-ch,.ms-b{font-style:normal}
.ms-ch{height:24px;padding:0 9px;border-radius:99px;font-size:11.5px;font-weight:700;display:inline-flex;align-items:center}
.ms-ch.ve{background:#E3F4EA;color:#0F6642}.ms-ch.gr{background:#F0F1F3;color:#555C66}
.ms-b{height:34px;padding:0 14px;border-radius:99px;background:#F3F4F6;font-size:12.5px;font-weight:700;display:inline-flex;align-items:center}
.ms-ops{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ms-op{border:1.5px solid var(--line);border-radius:12px;padding:9px 11px}.ms-op b{display:block;font-size:13px}.ms-op small{font-size:11.5px;color:var(--text2)}.ms-op.on{border-color:#1A3A9E;background:#EEF2FC}
.ms-nota{font-size:12px;color:#5C4300;background:#FDF8EC;border-radius:10px;padding:8px 10px;margin-top:8px}.ms-nota.gr{background:#F5F6F8;color:var(--text2)}
.ms-seg{display:inline-flex;background:#F3F4F6;border-radius:99px;padding:3px;margin-bottom:8px}.ms-seg span{height:32px;padding:0 14px;border-radius:99px;display:inline-flex;align-items:center;font-size:13px;font-weight:600;color:var(--text2)}.ms-seg span.on{background:#fff;color:var(--text);box-shadow:0 1px 3px rgba(17,19,21,.12)}
.ms-campo label{display:block;font-size:12px;font-weight:600;margin-bottom:4px}.ms-in{height:42px;border:1.5px solid var(--line);border-radius:12px;display:flex;align-items:center;padding:0 12px;font-size:14px}
.ms-box.ve{border-color:#BFE3CF;background:#F4FBF7}.ms-dat{display:grid;grid-template-columns:1fr 1fr;gap:8px 14px;margin-top:8px;font-size:13px;font-weight:600}.ms-dat small{display:block;font-weight:500;color:var(--text2);font-size:11.5px}
.ms-st{display:flex;gap:6px;margin-top:12px}.ms-st span{flex:1;font-size:11.5px;font-weight:700;color:var(--text2);border-top:3px solid #E3E6EA;padding-top:6px;display:flex;gap:5px;align-items:center}.ms-st i{font-style:normal;width:16px;height:16px;border-radius:50%;background:#E3E6EA;display:grid;place-items:center;font-size:10px;color:#fff}.ms-st .ok{border-color:#0F6642;color:#0F6642}.ms-st .ok i{background:#0F6642}.ms-st .on{border-color:#1A3A9E;color:#1A3A9E}.ms-st .on i{background:#1A3A9E}
.ms-drop{border:2px dashed #B9C4E8;background:#F5F7FD;border-radius:14px;padding:18px;text-align:center;display:flex;flex-direction:column;gap:6px;align-items:center}.ms-drop b{font-size:14.5px}.ms-drop small{color:var(--text2);font-size:12.5px}
.ms-ok{text-align:center;padding:6px 0}.ms-okc{width:48px;height:48px;border-radius:50%;background:#E3F4EA;color:#0F6642;display:inline-grid;place-items:center;font-size:22px;font-weight:800}.ms-ok b{display:block;font-size:18px;margin-top:8px}.ms-ok p{margin:4px 0 0;font-size:13px;color:var(--text2)}
.ms-tl{display:flex;flex-direction:column;gap:10px}.ms-tl div{display:grid;grid-template-columns:24px 1fr;column-gap:10px;font-size:13px;color:var(--text2)}.ms-tl i{font-style:normal;grid-row:1/3;width:22px;height:22px;border-radius:50%;background:#EEF0F3;display:grid;place-items:center;font-size:11px;font-weight:700}.ms-tl b{color:var(--text);font-size:13.5px}.ms-tl small{font-size:12px}.ms-tl .ok i{background:#0F6642;color:#fff}.ms-tl .on i{background:#1A3A9E;color:#fff}
.ms-n.g{background:#C9CED6}
.ms-fondo{position:absolute !important;min-height:100%;align-items:start !important;padding:24px 0}.ms{max-height:none !important}
.ms-pie{position:sticky;bottom:0;background:#fff;border-top:1px solid var(--line);padding:12px 22px;display:flex;gap:10px}
.ms-pie span{flex:1;height:46px;border-radius:99px;display:grid;place-items:center;font-weight:700;font-size:14px;background:#F3F4F6}.ms-pie span.p{background:#1A3A9E;color:#fff}
@media (max-width:700px){.ms-ops{grid-template-columns:1fr}.ms-fondo{padding:60px 0 0}.ms-fondo{place-items:end stretch}.ms{width:100%;border-radius:22px 22px 0 0;max-height:94vh}.ms-cab,.ms-c,.ms-pie{padding-left:18px;padding-right:18px}}`;
const P3 = `<div class="ms-fondo"><div class="ms"><div class="ms-cab"><b>Registrar migración</b><small>Comercial de Prueba 7 · Migración a PYME · queda a nombre de COMERCIAL DE PRUEBA 7, C.A.</small><div class="ms-st"><span class="ok"><i>✓</i>Servicio</span><span class="ok"><i>✓</i>Titular</span><span class="on"><i>3</i>Documentos</span><span class=""><i>4</i>Enviar</span></div></div><div class="ms-c">
<div class="ms-drop"><b>Arrastra aquí los documentos</b><small>Todos juntos o uno por uno. También puedes tocar para elegirlos o tomar una foto.</small><span class="ms-b">Elegir archivos</span></div>
<div class="ms-box">
<div class="ms-doc"><span>RIF de la empresa<small>El que subiste en el paso 2</small></span><i class="ms-ch ve">Listo</i></div>
<div class="ms-doc"><span>Acta constitutiva<small>acta-comercial-prueba.pdf</small></span><i class="ms-ch ve">Listo</i></div>
<div class="ms-doc"><span>Cédula del representante legal<small>Arrástrala aquí o toca Subir</small></span><i class="ms-b">Subir</i></div>
<div class="ms-doc"><span>RIF del representante legal<small>Arrástralo aquí o toca Subir</small></span><i class="ms-b">Subir</i></div></div>
<div class="ms-nota gr">Faltan 2 de 4. Puedes guardar y terminar después: queda en tus pendientes.</div>
</div><div class="ms-pie"><span>Atrás</span><span class="p" style="opacity:.45">Siguiente</span></div></div></div>`;
const P4 = `<div class="ms-fondo"><div class="ms"><div class="ms-cab"><b>Migración enviada</b><small>Comercial de Prueba 7 · Migración a PYME</small></div><div class="ms-c">
<div class="ms-ok"><span class="ms-okc">✓</span><b>En verificación</b><p>El administrador revisa los documentos. Te avisamos apenas la apruebe o si hay que corregir algo.</p></div>
<div class="ms-tl"><div class="ok"><i>✓</i><b>Enviada</b><small>16 de noviembre, 12:55</small></div><div class="on"><i>2</i><b>Verificación del administrador</b><small>Revisa los documentos</small></div><div><i>3</i><b>Planilla y cambio en el sistema</b><small>Envías la planilla al cliente; tu analista hace el cambio</small></div><div><i>4</i><b>Confirmada y comisión</b><small>Entra a tu lista de Comisiones</small></div></div>
<div class="ms-box am"><b>Mientras tanto, adelanta la planilla</b>Ya está llena con el titular actual y el nuevo. Descárgala y envíasela al cliente para que la firme.<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><span class="ms-b" style="background:#fff">Descargar planilla</span><span class="ms-b" style="background:#fff">Enviar por WhatsApp</span></div></div>
</div><div class="ms-pie"><span class="p">Listo</span></div></div></div>`;
(async () => { const nav = await chromium.launch();
  for(const [d, dev] of [['tel', TEL], ['pc', PC]]) for(const [n, h] of [['p3', P3], ['p4', P4]]){
    const { ctx } = await contexto(nav, dev); const p = await ctx.newPage(); await p.goto(H + 'index.html'); await p.waitForSelector('#pasoEquipo:not(.hidden)');
    await p.click('[data-equipo="ventas"]'); await p.fill('#usuario', 'lucia'); await p.click('#seguir'); await pin(p, '739105', d === 'pc'); await p.waitForURL(/inicio/);
    await p.goto(H + 'migraciones.html'); await p.waitForTimeout(1200); await p.addStyleTag({ content: CSS });
    await p.evaluate((h) => { const x = document.createElement('div'); x.innerHTML = h; document.body.appendChild(x.firstChild); }, h);
    await p.screenshot({ path: __dirname + '/img/sol-' + n + '-' + d + '.png', fullPage: true }); await ctx.close(); }
  await nav.close();
  const { execSync } = require('child_process'); })();
