/* CE36B/CE36C · agregado público, solo evidencia documental.
 * Muestra saldos históricos de cartera, NO deuda exigible ni correcciones aprobadas.
 * La fuente privada SMC/DAF/TGR por cuota no está disponible: mostrar S/I.
 */
(() => {
  "use strict";
  const panel = document.getElementById("ce36b-panel");
  if (!panel) return;
  const byId = id => document.getElementById(id);
  const whole = n => Number.isSafeInteger(n) && n >= 0;
  const num = n => new Intl.NumberFormat("es-CL", {maximumFractionDigits: 0}).format(n);
  const money = n => "$" + num(n);
  const k = {folios:11715,saldo:207707569,julio:27,julioSaldo:478791,res941:1053,res941Saldo:18655586};
  let source;

  function validate(data) {
    if (!data || data.schema !== "da17_ce36b_conciliacion_2026s2_agregada_v1" ||
        data.corte_cartera !== "2026-10-28" || data.periodo !== "2026-S2" ||
        data.vencimiento_cuota_evaluada !== "2026-09-30" ||
        !data.universo || !data.cotejos || !data.control_documental ||
        !data.resultados_certificados || !Array.isArray(data.distribucion_julio) ||
        data.distribucion_julio.length !== 4) throw Error("Esquema/corte no acreditado");
    const c = data.cotejos;
    const a = data.universo;
    const r = data.control_documental;
    const dist = data.distribucion_julio;
    if (a.folios !== k.folios || a.saldo_listado_clp !== k.saldo ||
        a.folios_cuadrados_libro_morosos !== a.folios ||
        a.diferencia_saldos_libros_clp !== 0 ||
        c.res941.folios_cartera !== k.res941 ||
        c.res941.saldo_listado_clp !== k.res941Saldo ||
        c.res941.folios_bd8n !== 1051 ||
        c.res2628.folios_cartera !== 2 ||
        c.res2628.saldo_listado_clp !== 35466 ||
        c.lista_julio.folios_cartera !== k.julio ||
        c.lista_julio.saldo_listado_clp !== k.julioSaldo ||
        c.lista_julio.folios_bd8n !== 24 ||
        r.resolucion_1258_beneficiarios_indicados !== 16585 ||
        r.anexo_integro_res1258_validado !== false ||
        r.extracto_cuenta_corriente_smc_daf_tgr_por_cuota !== false ||
        r.carga_2628_confirmada_por_movimientos !== false ||
        r.cierres_juridico_contables_en_12_semestres !== 0 ||
        Object.values(data.resultados_certificados).some(value => value !== null)) {
      throw Error("No coincide cuadratura o se atribuye cierre no certificado");
    }
    const codes = ["941_Y_2628","SOLO_941","SOLO_2628","NINGUNA_DOS"];
    let total = 0, saldo = 0;
    dist.forEach((row,i) => {
      if (row.codigo !== codes[i] || !whole(row.folios) ||
          !whole(row.saldo_listado_clp) || typeof row.etiqueta !== "string") {
        throw Error("Distribución no exclusiva");
      }
      total += row.folios; saldo += row.saldo_listado_clp;
    });
    if (total !== k.julio || saldo !== k.julioSaldo ||
        dist[0].folios !== 1 || dist[1].folios !== 8 ||
        dist[2].folios !== 0 || dist[3].folios !== 18) {
      throw Error("La distribución julio no cuadra");
    }
    return data;
  }

  function node(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function updateFocus() {
    const selected = byId("ce36b-focus").value;
    const map = {
      julio: {count:source.cotejos.lista_julio.folios_cartera,clp:source.cotejos.lista_julio.saldo_listado_clp,
        msg:"Propuesta de julio: 27 folios con saldo histórico. Solo 9 están en nóminas 941/2628 examinadas; los otros 18 requieren anexo íntegro 1258."},
      res941: {count:source.cotejos.res941.folios_cartera,clp:source.cotejos.res941.saldo_listado_clp,
        msg:"Nómina 941: 1.053 folios coinciden con cartera 2026-S2; 1.051 tienen marca BD8N. Coincidencia documental, no descarga aplicada."},
      res2628: {count:source.cotejos.res2628.folios_cartera,clp:source.cotejos.res2628.saldo_listado_clp,
        msg:"Archivo de 2.832 exentos informado como cargado: 2 folios coinciden con cartera. Falta ver el movimiento individual por cuota."}
    };
    const current = map[selected] || map.julio;
    byId("ce36b-focus-number").textContent = num(current.count) + " folios · " + money(current.clp);
    byId("ce36b-focus-note").textContent = current.msg;
  }

  function show(data) {
    source = data;
    byId("ce36b-total").textContent = num(data.universo.folios);
    byId("ce36b-cuadre").textContent = num(data.universo.folios_cuadrados_libro_morosos) + " / " + num(data.universo.folios);
    byId("ce36b-saldo").textContent = money(data.universo.saldo_listado_clp);
    byId("ce36b-res941").textContent = num(data.cotejos.res941.folios_cartera);
    byId("ce36b-julio").textContent = num(data.cotejos.lista_julio.folios_cartera);
    byId("ce36b-2628").textContent = num(data.cotejos.res2628.folios_cartera);
    byId("ce36b-julio-total").textContent = num(data.cotejos.lista_julio.folios_cartera) + " folios · " + money(data.cotejos.lista_julio.saldo_listado_clp);
    const bars = byId("ce36b-july-bars"), body = byId("ce36b-july-table");
    bars.replaceChildren(); body.replaceChildren();
    for (const row of data.distribucion_julio) {
      const track = node("div", "ce36b-track");
      const fill = node("div", "ce36b-fill" + (row.codigo === "NINGUNA_DOS" ? " ce36b-open" : ""));
      fill.style.width = (row.folios / 27 * 100).toFixed(2) + "%";
      track.appendChild(fill);
      const line = node("div", "ce36b-bar-row");
      line.append(node("span", "ce36b-bar-label", row.etiqueta), track,
                  node("span", "ce36b-bar-value", num(row.folios)));
      line.setAttribute("role","listitem");
      line.setAttribute("aria-label", row.etiqueta + ": " + num(row.folios) + " folios; " +
        money(row.saldo_listado_clp) + " saldo listado");
      bars.appendChild(line);
      const tr = node("tr");
      [row.etiqueta,num(row.folios),money(row.saldo_listado_clp)].forEach(t => {
        tr.appendChild(node("td","",t));
      });
      body.appendChild(tr);
    }
    const choose = byId("ce36b-focus");
    choose.addEventListener("change",updateFocus);
    updateFocus();
    byId("ce36b-state").textContent =
      "Corte 28/10/2026 · 3.ª cuota vencida 30/09/2026 · 0/12 cierres contables. No se acreditó la cuenta corriente de movimientos SMC/DAF/TGR por cuota.";
    panel.dataset.ce36bStatus = "ready";
  }

  fetch("../data/ce36b_conciliacion_2026s2_agregada_v1.json", {cache:"no-cache"})
    .then(response => {if(!response.ok)throw Error("No se encontró agregado CE36B");return response.json();})
    .then(validate).then(show)
    .catch(err => {
      panel.dataset.ce36bStatus = "error";
      byId("ce36b-state").textContent = "CE36B no disponible: faltó validar la fuente agregada y sus controles.";
      ["ce36b-total","ce36b-cuadre","ce36b-saldo","ce36b-res941","ce36b-julio","ce36b-2628","ce36b-julio-total","ce36b-focus-number"].forEach(id => byId(id).textContent = "S/I");
      byId("ce36b-july-bars").replaceChildren();
      byId("ce36b-july-table").replaceChildren();
      console.warn("CE36B QA:",err.message);
    });
})();
