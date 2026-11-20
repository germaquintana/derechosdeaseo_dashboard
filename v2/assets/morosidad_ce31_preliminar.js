/* CE31 · Resumen directivo de Morosidad, solo datos ya publicados.
 * No importa CE28–CE30 privados ni afirma certificacion contable.
 * Rama de revision: no fusionar antes del gate editorial/privacidad.
 */
(() => {
  "use strict";
  const section = document.getElementById("ce31-director-panel");
  if (!section) return;

  const byId = id => document.getElementById(id);
  const integer = value => Number.isSafeInteger(value) && value >= 0;
  const format = value => new Intl.NumberFormat("es-CL", {maximumFractionDigits: 0}).format(value);
  const million = value => new Intl.NumberFormat("es-CL", {maximumFractionDigits: 1}).format(value / 1000000);
  // Criterio del responsable 20-11-2026: nómina SII anual para 2021 y 2022,
  // y continuidad 2026-S1→2026-S2 porque no se recibió una nómina nueva.
  // Fuente de referencia disponible ≠ cruce de cuota ni exención aplicada.
  const continuedSii = new Set(["2021-S2", "2022-S2", "2026-S2"]);
  const expectedPeriods = ["2021-S1","2021-S2","2022-S1","2022-S2","2023-S1","2023-S2","2024-S1","2024-S2","2025-S1","2025-S2","2026-S1","2026-S2"];
  const expected = {folios: 190838, saldo: 2832929422, corte: "2026-10-28"};
  let periods = [];

  function validate(doc) {
    if (!doc || doc.schema !== "da17_morosidad_cobertura_12_periodos_v1" ||
        doc.corte_cartera !== expected.corte || !Array.isArray(doc.periodos) ||
        doc.periodos.length !== 12 || !doc.resumen) throw Error("Esquema, corte o cobertura inválidos");
    const seen = new Set();
    let totalFolios = 0, totalSaldo = 0;
    const rows = doc.periodos.map(period => {
      const name = period && period.periodo;
      const f = period?.cartera?.folios, s = period?.cartera?.saldo_listado_clp;
      if (!expectedPeriods.includes(name) || seen.has(name) || !integer(f) || !integer(s)) {
        throw Error("Período, identidad o monto inválido");
      }
      seen.add(name); totalFolios += f; totalSaldo += s;
      const estadoFuente = continuedSii.has(name) ? "continuidad" : "propio";
      return {name, folios: f, saldo: s, estadoFuente};
    });
    if (totalFolios !== expected.folios || totalSaldo !== expected.saldo ||
        doc.resumen.folios_periodo_suma_sin_deduplicar !== totalFolios ||
        doc.resumen.saldo_clp_suma_sin_deduplicar !== totalSaldo ||
        seen.size !== 12 || rows.filter(x => x.estadoFuente === "propio").length !== 9 ||
        rows.filter(x => x.estadoFuente === "continuidad").length !== 3) {
      throw Error("Cuadratura o cobertura de SII no coincide con el control");
    }
    return rows.sort((a,b) => expectedPeriods.indexOf(a.name) - expectedPeriods.indexOf(b.name));
  }

  function create(tag, cls, value) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (value !== undefined) node.textContent = value;
    return node;
  }

  function render(filter) {
    const data = periods.filter(row => filter === "todos" ||
      (filter === "propio" && row.estadoFuente === "propio") ||
      (filter === "continuidad" && row.estadoFuente === "continuidad"));
    const chart = byId("ce31-bars");
    const table = byId("ce31-table");
    chart.replaceChildren(); table.replaceChildren();
    const maxSaldo = Math.max(...periods.map(row => row.saldo));
    for (const row of data) {
      const item = create("div", "ce31-bar-row");
      item.setAttribute("role", "listitem");
      const label = create("span", "ce31-period", row.name);
      const track = create("div", "ce31-bar-track");
      const bar = create("div", "ce31-bar-fill" + (row.estadoFuente === "continuidad" ? " ce31-bar-continuity" : ""));
      bar.style.width = (100 * row.saldo / maxSaldo).toFixed(3) + "%";
      bar.setAttribute("aria-hidden", "true");
      track.appendChild(bar);
      const amount = create("span", "ce31-amount", "$" + million(row.saldo) + " MM");
      item.append(label, track, amount);
      item.setAttribute("aria-label", row.name + ": $" + format(row.saldo) +
        " de saldo listado; nómina SII " + (row.estadoFuente === "propio" ? "del semestre identificada" :
          "del primer semestre de " + row.name.slice(0,4) + " aplicada por continuidad en " + row.name));
      chart.appendChild(item);

      const tr = create("tr");
      const cols = [row.name, format(row.folios), "$" + format(row.saldo),
        row.estadoFuente === "propio" ? "Nómina del semestre" :
        "Continuidad " + row.name.slice(0,4) + "-S1 usada en S2"];
      for (let i = 0; i < cols.length; i++) {
        const td = create("td", i === 3 ?
          (row.estadoFuente === "propio" ? "ce31-source-ok" : "ce31-source-continuity") : "", cols[i]);
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }
    byId("ce31-visible").textContent = data.length + " de 12 semestres";
    byId("ce31-filter-note").textContent = filter === "todos"
      ? "Los 12 semestres tienen nómina SII de referencia: 9 del propio semestre y 3 continuidades S1→S2 (2021, 2022, 2026), según el responsable. Falta conciliar la aplicación por cuota."
      : "Filtro de calidad documental; no modifica los importes ni certifica su exigibilidad.";
  }

  function show(rows) {
    periods = rows;
    byId("ce31-saldo").textContent = "$" + million(expected.saldo) + " MM";
    byId("ce31-folios").textContent = format(expected.folios);
    byId("ce31-sii").textContent = "12 / 12";
    byId("ce31-corregido").textContent = "S/I";
    const filter = byId("ce31-filter");
    filter.addEventListener("change", () => render(filter.value));
    render(filter.value);
    byId("ce31-message").textContent =
      "Corte 28/10/2026 · Cartera registrada; no deuda exigible certificada.";
    section.setAttribute("data-ce31-status", "ready");
  }

  fetch("../data/morosidad_cobertura_12_periodos_v1.json", {cache: "no-cache"})
    .then(response => {
      if (!response.ok) throw Error("No se pudo leer el agregado público");
      return response.json();
    })
    .then(validate)
    .then(show)
    .catch(error => {
      section.setAttribute("data-ce31-status", "error");
      byId("ce31-message").textContent =
        "Vista preliminar no disponible: no se validó la fuente pública y su cuadratura.";
      byId("ce31-saldo").textContent = "S/I";
      byId("ce31-folios").textContent = "S/I";
      byId("ce31-sii").textContent = "S/I";
      byId("ce31-corregido").textContent = "S/I";
      byId("ce31-visible").textContent = "Sin datos";
      console.warn("CE31 QA: ", error.message);
    });
})();
