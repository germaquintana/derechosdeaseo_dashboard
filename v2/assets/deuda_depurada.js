/* DA17-CE03: comparación de cartera registrada, coincidencias técnicas y deuda depurada.
   Funciona solo con agregados públicos; nunca clasifica por sí mismo una cuota ni ejecuta SMC. */
(() => {
  "use strict";
  const el = id => document.getElementById(id);
  if (!el("da-net-panel")) return;
  const fmt = new Intl.NumberFormat("es-CL", {maximumFractionDigits:0});
  const number = n => n == null ? "S/I" : fmt.format(n);
  const clp = n => n == null ? "S/I" : "$" + number(n);
  const keys = ["da-audit-year","da-audit-period","da-audit-state"];
  let periods = [], selected = [];
  function stateMatch(r, value) {
    return value === "todos" ||
      (value === "propia" && r.fuente_clasificacion === "CLASIFICACION_ORIGINAL_SEMESTRE") ||
      (value === "recalculada" && r.fuente_clasificacion === "RECRUCE_CORREGIDO_2025S1") ||
      (value === "referencial" && r.fuente_clasificacion === "CLASIFICACION_S1_REFERENCIAL") ||
      (value === "sincruce" && r.fuente_clasificacion === "SIN_CRUCE_ROL_SEMESTRE");
  }
  function filtered() {
    const year = el("da-audit-year").value;
    const period = el("da-audit-period").value;
    const state = el("da-audit-state").value;
    return periods.filter(r =>
      (year === "todos" || r.periodo.startsWith(year)) &&
      (period === "todos" || r.periodo === period) && stateMatch(r,state));
  }
  function classification(r) {
    const bruto = r.cartera.saldo_listado_clp, folios = r.cartera.folios_listados;
    const rolesMorosos=Number.isInteger(r.cartera.roles_unicos_morosos) ? r.cartera.roles_unicos_morosos : null;
    const tech = r.subconjunto_tecnico_smc;
    const candidato = tech === null ? null : tech.saldo_listado_clp;
    const candidatoFolios = tech === null ? null : tech.folios_suma_sin_solapamiento_grupos;
    if (candidato !== null && (candidato < 0 || candidato > bruto ||
      candidatoFolios < 0 || candidatoFolios > folios))
      throw new Error("El subtotal técnico excede la cartera de " + r.periodo);
    /* CORRECCIONES: solo con monto probado y cierre documental por período; 0/12 actuales. */
    const adjustment = r.descarga_smc_acreditada;
    const conciliado = r.conciliacion_juridico_contable_completa === true &&
      adjustment && Number.isFinite(adjustment.monto_clp) && adjustment.monto_clp >= 0 &&
      adjustment.monto_clp <= bruto;
    const corrected = conciliado ? bruto - adjustment.monto_clp : null;
    const correct = r.cobro_procedente_acreditado &&
      Number.isFinite(r.cobro_procedente_acreditado.saldo_listado_clp) ?
      r.cobro_procedente_acreditado.saldo_listado_clp : null;
    return {
      periodo:r.periodo, bruto, folios, rolesMorosos, candidato, candidatoFolios,
      sinSenal:candidato === null ? null : bruto-candidato,
      sinSenalFolios:candidatoFolios === null ? null : folios-candidatoFolios,
      sinCruce:candidato === null ? bruto : 0,
      sinCruceFolios:candidatoFolios === null ? folios : 0,
      ajuste:conciliado ? adjustment.monto_clp : null,
      corregido:corrected, correcto:correct,
      fuente:r.fuente_clasificacion,
      /* Para futura conciliación completa: ninguna cohorte focal se descuenta aquí. */
      corte:r.corte_cartera
    };
  }
  function sum(list,key) { return list.reduce((s,r)=>s+(r[key] ?? 0),0); }
  function allKnown(list,key) { return list.length && list.every(r=>r[key] !== null); }
  function sums(list) {
    const total = sum(list,"bruto");
    const brutoFolios = sum(list,"folios");
    return {
      total,brutoFolios,
      rolesMorosos:allKnown(list,"rolesMorosos") ? sum(list,"rolesMorosos") : null,
      candidatos:sum(list,"candidato"),
      candidatosFolios:sum(list,"candidatoFolios"),
      sinSenal:sum(list,"sinSenal"),
      sinSenalFolios:sum(list,"sinSenalFolios"),
      sinCruce:sum(list,"sinCruce"),
      sinCruceFolios:sum(list,"sinCruceFolios"),
      corregido:allKnown(list,"corregido") ? sum(list,"corregido") : null,
      ajuste:allKnown(list,"ajuste") ? sum(list,"ajuste") : null,
      correcto:allKnown(list,"correcto") ? sum(list,"correcto") : null
    };
  }
  function make(tag,cls,text) {
    const e=document.createElement(tag);
    if(cls)e.className=cls;
    if(text !== undefined)e.textContent=text;
    return e;
  }
  function drawTotals(rows) {
    const s=sums(rows);
    el("da-net-gross").textContent=rows.length ? clp(s.total) : "—";
    el("da-net-folios").textContent=rows.length ? number(s.brutoFolios)+" folios-período" : "Sin selección";
    el("da-net-roles").textContent=s.rolesMorosos == null ? "S/I" : number(s.rolesMorosos);
    el("da-net-roles-note").textContent=rows.length > 1 ? "Requiere deduplicar los ROL entre períodos." : "No hay conteo de ROL únicos morosos validado.";
    el("da-net-candidates").textContent=rows.length ? (rows.some(r=>r.candidato !== null) ? clp(s.candidatos) : "S/I") : "—";
    el("da-net-candidates-detail").textContent=rows.length ?
      "Candidatos identificados en "+number(rows.filter(r=>r.candidato !== null).length)+"/"+number(rows.length)+" semestres; NO descontables aún." : "Sin selección";
    el("da-net-correct").textContent=s.correcto == null ? "S/I" : clp(s.correcto);
    el("da-net-adjusted").textContent=s.corregido == null ? "S/I · pendiente" : clp(s.corregido);
    el("da-net-adjust-note").textContent=s.corregido == null ?
      "No se han acreditado por cuota las correcciones y la conciliación SMC/DAF: no existe saldo depurado comprobado." :
      "Saldo registrado menos correcciones documentadas, con conciliación completa de los períodos incluidos.";
    el("da-net-gross-bar").style.width=rows.length?"100%":"0%";
    el("da-net-gross-bar").setAttribute("aria-label",rows.length ? "Saldo registrado "+clp(s.total) : "Sin selección");
    const correctedBar=el("da-net-adjust-bar");
    correctedBar.replaceChildren();
    if(s.corregido == null) {
      correctedBar.append(make("span","da-net-unavailable","S/I · no calculable todavía"));
      correctedBar.style.width="100%";
      correctedBar.classList.add("da-net-unknown");
    } else {
      correctedBar.classList.remove("da-net-unknown");
      correctedBar.style.width=(s.total?Math.round(s.corregido/s.total*100):0)+"%";
      correctedBar.append(make("span","",""+clp(s.corregido)));
    }
    const known=rows.filter(r=>r.candidato !== null).length;
    el("da-net-scope").textContent=rows.length ?
      number(known)+"/"+number(rows.length)+" semestres con coincidencias clasificadas; "+
      number(rows.length-known)+" sin cruce por obligación. Los candidatos de S2 referenciales conservan esa advertencia." :
      "No hay semestres para estos filtros.";
  }
  function drawBars(rows) {
    const parent=el("da-net-bars");
    parent.replaceChildren();
    const unit=el("da-net-unit").value;
    const grossKey=unit==="folios"?"folios":"bruto";
    const candidateKey=unit==="folios"?"candidatoFolios":"candidato";
    const otherKey=unit==="folios"?"sinSenalFolios":"sinSenal";
    const grossTotal=Math.max(1,...rows.map(r=>r[grossKey]));
    const unitText=unit==="folios"?"folios-período del extracto (cuota real pendiente)":"CLP de saldo listado";
    el("da-net-chart-caption").textContent="Composición técnica · "+unitText+". No se puede inferir qué parte es deuda correctamente emitida ni corregida.";
    for(const r of rows){
      const line=make("div","da-net-bar-row");
      const title=make("div","da-net-bar-title",r.periodo);
      if(r.fuente==="CLASIFICACION_S1_REFERENCIAL")title.append(make("small",""," · referencial"));
      const bar=make("div","da-net-bar-bg");
      const c=r[candidateKey],o=r[otherKey],unknown=c==null?r[grossKey]:0;
      const pieces=[
        [c??0,"da-net-segment-candidate","Coincidencia técnica"],
        [o??0,"da-net-segment-other","Sin coincidencia técnica"],
        [unknown,"da-net-segment-pending","Sin clasificación"]
      ];
      for(const [value,css,titleText] of pieces){
        if(!value)continue;
        const span=make("span",css);
        span.style.width=(value/r[grossKey]*100)+"%";
        span.title=titleText+": "+number(value)+" "+unitText;
        bar.append(span);
      }
      bar.style.width=(r[grossKey]===0?0:Math.max(1,r[grossKey]/grossTotal*100))+"%";
      bar.setAttribute("role","img");
      bar.setAttribute("aria-label",r.periodo+": "+number(r[grossKey])+" "+unitText+
        "; candidatos "+(c==null?"sin información":number(c))+
        "; sin coincidencia "+(o==null?"sin información":number(o))+
        "; sin clasificación "+number(unknown));
      line.append(title,bar,make("div","da-net-bar-value",number(r[grossKey])));
      parent.append(line);
    }
    if(!rows.length)parent.append(make("p","","Sin resultados para estos filtros."));
  }
  function td(tr,t){const c=tr.insertCell();c.textContent=t;return c;}
  function drawTable(rows) {
    const body=el("da-net-table");body.replaceChildren();
    for(const r of rows){
      const tr=body.insertRow();
      td(tr,r.periodo+(r.fuente==="CLASIFICACION_S1_REFERENCIAL"?" *":""));
      td(tr,number(r.folios));
      td(tr,number(r.rolesMorosos));
      td(tr,clp(r.bruto));
      td(tr,clp(r.candidato));
      td(tr,clp(r.sinSenal));
      td(tr,r.candidato===null?clp(r.sinCruce):"—");
      td(tr,clp(r.correcto));
      td(tr,clp(r.ajuste));
      td(tr,clp(r.corregido));
    }
    if(!rows.length){const tr=body.insertRow();const c=td(tr,"No hay resultados.");c.colSpan=10;}
  }
  function exportCsv() {
    const fields=["periodo","folios_periodo_listados","rol_morosos_unicos","saldo_moroso_registrado_clp",
      "coincidencias_tecnicas_clp","sin_coincidencia_tecnica_clp",
      "sin_cruce_clp","cobro_correcto_acreditado_clp","correccion_conciliada_clp",
      "saldo_corregido_verificado_clp","fuente_clasificacion","corte"];
    const esc=v=>'"'+String(v==null?"":v).replaceAll('"','""')+'"';
    const lines=[fields];
    for(const r of selected)lines.push([r.periodo,r.folios,r.rolesMorosos,r.bruto,r.candidato,r.sinSenal,
      r.candidato===null?r.sinCruce:null,r.correcto,r.ajuste,r.corregido,r.fuente,r.corte]);
    const csv="\uFEFF"+lines.map(r=>r.map(esc).join(";")).join("\r\n");
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
    const a=document.createElement("a");a.href=url;a.download="derechos_aseo_deuda_registrada_vs_depurada_ce03.csv";
    a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function render() {
    try{
      selected=filtered().map(classification);
      drawTotals(selected);drawBars(selected);drawTable(selected);
      el("da-net-error").hidden=true;
    }catch(e){el("da-net-error").hidden=false;el("da-net-error").textContent=e.message;}
  }
  async function init(){
    try{
      const response=await fetch("../data/cartera_exenciones_auditoria_v1.json",{cache:"no-store"});
      if(!response.ok)throw new Error("Fuente de cartera no disponible");
      const data=await response.json();
      if(data.periodos.length!==12 ||
        data.periodos.reduce((s,r)=>s+r.cartera.saldo_listado_clp,0)!==2832929422)
        throw new Error("La fuente no coincide con el consolidado aprobado");
      periods=data.periodos;
      for(const key of keys)el(key).addEventListener("change",render);
      el("da-net-unit").addEventListener("change",render);
      el("da-net-export").addEventListener("click",exportCsv);
      render();window.__daBalanceReady=true;
    }catch(e){el("da-net-error").hidden=false;el("da-net-error").textContent=e.message;window.__daBalanceReady=false;}
  }
  init();
})();