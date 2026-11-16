/* Derechos de Aseo Recoleta · diagnóstico agregado de posibles exenciones en cartera.
   No consulta, modifica ni descarga cuotas del sistema SMC. */
(function () {
  "use strict";
  const find = id => document.getElementById(id);
  if (!find("da-audit-roles")) return;
  const format = new Intl.NumberFormat("es-CL", {maximumFractionDigits: 0});
  const money = new Intl.NumberFormat("es-CL", {minimumFractionDigits: 3, maximumFractionDigits: 3});
  const num = n => n == null ? "S/I" : format.format(n);
  const mm = n => n == null ? "S/I" : money.format(n / 1000000000);
  const groups = {
    smc: {title:"BD9N + BD5N · cartera municipal",extract:r=>r.subconjunto_tecnico_smc,
      folios:x=>x.folios_suma_sin_solapamiento_grupos,saldo:x=>x.saldo_listado_clp},
    rsh: {title:"BD9N · candidatura RSH",extract:r=>r.grupos.rsh_municipal_bd9n,
      folios:x=>x.folios,saldo:x=>x.saldo_listado_clp},
    avaluo: {title:"BD5N · filtro de avalúo de todos los destinos",extract:r=>r.grupos["avalúo_todos_destinos_bd5n"],
      folios:x=>x.folios,saldo:x=>x.saldo_listado_clp},
    tgr: {title:"BD4N_RSH · canal TGR, no SMC",extract:r=>r.grupos.tgr_rsh_no_smc_bd4n_rsh,
      folios:x=>x.folios,saldo:x=>x.saldo_listado_clp}
  };
  const statuses = {
    CLASIFICACION_ORIGINAL_SEMESTRE: ["BD del semestre", ""],
    RECRUCE_CORREGIDO_2025S1: ["Recruce corregido", ""],
    CLASIFICACION_S1_REFERENCIAL: ["S1 referencial", "warning"],
    SIN_CRUCE_ROL_SEMESTRE: ["Sin cruce individual", "pending"]
  };
  const focalTitles = {
    nomina_tarifa_cero_res1363: "Nómina Res. 1363: tarifa cero",
    tarifa_cero_SII: "Coincidencia con nómina de tarifa cero SII",
    tarifa_cero_v2: "Alerta por nómina de tarifa cero V2",
    nomina_tarifa_cero: "Coincidencia con nómina de tarifa cero",
    legal_H_225_preliminar: "Posible causal habitacional ≤225 UTM",
    nomina_a_eximir_2026_s1_focal: "Nómina focal 2026-S1: análisis rol–cuota"
  };
  let dataset = null;
  let visible = [];
  const selectors = ["da-audit-year", "da-audit-type", "da-audit-state", "da-audit-period"];
  function stateMatch(r, value) {
    if (value === "todos") return true;
    if (value === "propia") return r.fuente_clasificacion === "CLASIFICACION_ORIGINAL_SEMESTRE";
    if (value === "recalculada") return r.fuente_clasificacion === "RECRUCE_CORREGIDO_2025S1";
    if (value === "referencial") return r.fuente_clasificacion === "CLASIFICACION_S1_REFERENCIAL";
    if (value === "sincruce") return r.fuente_clasificacion === "SIN_CRUCE_ROL_SEMESTRE";
    return false;
  }
  function cell(row, text) {
    const el = row.insertCell();
    el.textContent = text == null ? "S/I" : String(text);
    return el;
  }
  function addClass(el, names) {
    names.split(" ").forEach(n=>n && el.classList.add(n));
    return el;
  }
  function filtered() {
    const year = find("da-audit-year").value;
    const status = find("da-audit-state").value;
    const period = find("da-audit-period").value;
    return dataset.periodos.filter(r=>(year==="todos"||r.periodo.startsWith(year)) &&
      (period==="todos"||period===r.periodo) && stateMatch(r,status));
  }
  function render() {
    if (!dataset) return;
    const type = find("da-audit-type").value;
    const grp = groups[type];
    visible = filtered();
    const withData = visible.filter(r=>grp.extract(r)!==null);
    const folios = withData.reduce((s,r)=>s+grp.folios(grp.extract(r)),0);
    const balance = withData.reduce((s,r)=>s+grp.saldo(grp.extract(r)),0);
    find("da-audit-coverage").textContent = withData.length + " / " + visible.length;
    find("da-audit-coverage-note").textContent = "Fuente completa por canal: pendiente; " +
      visible.filter(r=>r.fuente_clasificacion==="CLASIFICACION_S1_REFERENCIAL").length +
      " período(s) referenciales";
    find("da-audit-folios").textContent = withData.length ? num(folios) : "S/I";
    find("da-audit-balance").textContent = withData.length ? mm(balance)+" MM$" : "S/I";
    find("da-audit-confirmed").textContent = "Sin determinar";
    find("da-audit-chart-label").textContent = grp.title + " · folios-período";
    drawChart(visible,grp);
    drawTable(visible);
    drawFocal(visible);
  }
  function drawChart(rows,group) {
    const place = find("da-audit-chart");
    place.replaceChildren();
    const vals = rows.map(r=>{const x=group.extract(r);return x==null?null:group.folios(x)});
    const max = Math.max(1,...vals.filter(x=>x!==null));
    for(let i=0;i<rows.length;i++){
      const r=rows[i],v=vals[i],q=addClass(document.createElement("div"),"da-audit-bar-item");
      if(r.fuente_clasificacion==="CLASIFICACION_S1_REFERENCIAL")q.classList.add("da-referential");
      if(r.fuente_clasificacion==="RECRUCE_CORREGIDO_2025S1")q.classList.add("da-recalculated");
      const count=addClass(document.createElement("span"),"da-audit-bar-count");
      count.textContent=v==null?"S/I":num(v);q.append(count);
      const bg=addClass(document.createElement("div"),"da-audit-bar-graphic");
      if(v===null){const si=addClass(document.createElement("span"),"da-audit-bar-si");si.textContent="S/I";bg.append(si);}
      else {const bar=addClass(document.createElement("span"),"da-audit-bar-fill");
        bar.style.height=(v===0?0:Math.max(1,Math.round(v/max*174)))+"px";
        bg.append(bar);
      }
      q.append(bg);
      const label=addClass(document.createElement("span"),"da-audit-bar-label");label.textContent=r.periodo;q.append(label);
      const desc=r.nota || "";q.title=r.periodo+": "+(v==null?"Sin cruce":num(v)+" folios")+". "+desc;
      place.append(q);
    }
    if(!rows.length){const p=document.createElement("p");p.textContent="No hay períodos con estos filtros.";place.append(p);}
  }
  function drawTable(rows) {
    const body=find("da-audit-table");
    body.replaceChildren();
    const fields=["rsh_municipal_bd9n","avalúo_todos_destinos_bd5n","tgr_rsh_no_smc_bd4n_rsh"];
    for(const d of rows){
      const tr=body.insertRow();tr.title=d.nota;
      cell(tr,d.periodo);
      const s=cell(tr,"");const st=statuses[d.fuente_clasificacion]||["Pendiente","pending"];
      const span=document.createElement("span");addClass(span,"da-smallstatus "+st[1]);span.textContent=st[0];s.append(span);
      cell(tr,num(d.cartera.folios_listados));
      for(const f of fields){const q=d.grupos[f];cell(tr,q==null?"S/I":num(q.folios));}
      cell(tr,d.subconjunto_tecnico_smc==null?"S/I":num(d.subconjunto_tecnico_smc.folios_suma_sin_solapamiento_grupos));
      cell(tr,d.subconjunto_tecnico_smc==null?"S/I":mm(d.subconjunto_tecnico_smc.saldo_listado_clp));
    }
    if(!rows.length){const tr=body.insertRow();const td=cell(tr,"Sin resultados para los filtros.");td.colSpan=8;}
  }
  function drawFocal(rows) {
    const el=find("da-audit-alerts");
    el.replaceChildren();
    let count=0;
    for(const r of rows){
      for(const a of r.alertas_focales_independientes){
        count+=1;
        const box=addClass(document.createElement("div"),"da-audit-alert");
        const bold=document.createElement("b");
        bold.textContent=r.periodo+" · "+(focalTitles[a.tipo]||"Alerta documental");
        box.append(bold);
        const p=document.createElement("div");
        if(a.tipo==="nomina_a_eximir_2026_s1_focal"){
          p.textContent=num(a.roles)+" roles analizados · "+num(a.cuotas_presentes_en_morosos)+
            " combinaciones rol-cuota en morosos · "+num(a.cuotas_ausentes_de_morosos)+
            " ausentes del extracto · $"+num(a.saldo_reajuste_multa_pendiente_clp)+
            " de saldo, reajustes y multas. Ausencia no prueba pago; verificar actos y movimientos.";
        }else{
          p.textContent=num(a.folios)+" folios · "+num(a.roles)+" roles · $"+
            num(a.saldo_listado_clp)+" de saldo listado. Estado: "+a.estado.replaceAll("_"," ")+".";
        }
        box.append(p);
        const s=document.createElement("small");s.textContent="Cohorte focal distinta; puede solaparse con otras categorías. No sumar automáticamente ni descargar cuotas.";box.append(s);
        el.append(box);
      }
    }
    if(!count){const x=document.createElement("p");x.textContent="Sin alerta focal adicional documentada para estos filtros. No significa ausencia de cobros que requieran revisión.";el.append(x);}
  }
  function exportFiltered() {
    if(!dataset)return;
    const rows=[["periodo","fuente_clasificacion","cartera_folios","cartera_saldo_CLP",
      "BD9N_folios","BD9N_saldo_CLP","BD5N_folios","BD5N_saldo_CLP","TGR_RSH_folios",
      "TGR_RSH_saldo_CLP","SMC_subtotal_tecnico_folios","SMC_subtotal_tecnico_saldo_CLP",
      "descarga_acreditada_folios","descarga_acreditada_CLP"]];
    const val=(r,g,key)=>r.grupos[g]===null?"":r.grupos[g][key];
    for(const r of visible){const x=r.subconjunto_tecnico_smc;
      rows.push([r.periodo,r.fuente_clasificacion,r.cartera.folios_listados,r.cartera.saldo_listado_clp,
        val(r,"rsh_municipal_bd9n","folios"),val(r,"rsh_municipal_bd9n","saldo_listado_clp"),
        val(r,"avalúo_todos_destinos_bd5n","folios"),val(r,"avalúo_todos_destinos_bd5n","saldo_listado_clp"),
        val(r,"tgr_rsh_no_smc_bd4n_rsh","folios"),val(r,"tgr_rsh_no_smc_bd4n_rsh","saldo_listado_clp"),
        x==null?"":x.folios_suma_sin_solapamiento_grupos,x==null?"":x.saldo_listado_clp,"",""]);
    }
    const escape=x=>'"'+String(x==null?"":x).replaceAll('"','""')+'"';
    const csv="\uFEFF"+rows.map(r=>r.map(escape).join(";")).join("\r\n");
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
    const link=document.createElement("a");link.href=url;link.download="derechos_aseo_cartera_exenciones_agregado_20261116.csv";
    link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function init() {
    for(const id of selectors) find(id).addEventListener("change",render);
    find("da-audit-export").addEventListener("click",exportFiltered);
    try {
      const resp=await fetch("../data/cartera_exenciones_auditoria_v1.json",{cache:"no-store"});
      if(!resp.ok)throw new Error("No se pudo cargar la matriz agregada");
      const x=await resp.json();
      if(!Array.isArray(x.periodos)||x.periodos.length!==12||x.periodos.reduce((s,r)=>s+r.cartera.folios_listados,0)!==190838)
        throw new Error("Inconsistencia de número de semestres o folios");
      if(x.periodos.reduce((s,r)=>s+r.cartera.saldo_listado_clp,0)!==2832929422)
        throw new Error("Inconsistencia de montos de cartera");
      if(x.periodos.some(r=>typeof r.descarga_smc_acreditada?.monto_clp==="number"))
        throw new Error("Descarga acreditada no debe inferirse de un cruce técnico");
      dataset=x;
      const select=find("da-audit-period");
      for(const r of x.periodos){const opt=document.createElement("option");opt.value=r.periodo;opt.textContent=r.periodo;select.append(opt);}
      render();
      window.__daExencionesReady=true;
    }catch(err){
      find("da-audit-error").hidden=false;
      find("da-audit-error").textContent="No fue posible cargar auditoría de exenciones: "+err.message;
      window.__daExencionesReady=false;
    }
  }
  init();
})();