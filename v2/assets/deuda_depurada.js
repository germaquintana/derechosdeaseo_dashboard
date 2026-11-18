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
  let ce08Status="0/3 semestres con agregado CE08 aprobado; continúan alertas CE06.";
  const CE08_GROUPS=["BD5N","BD9N","BD8N","BD4N_RSH","BD4N_RESTO"];
  const CE08_PERIODS=new Set(["2025-S2","2026-S1","2026-S2"]);
  const CE08_RESIDUES=new Set(["SIN_CLASIFICAR_FUENTE","SIN_CLASIFICAR_ROL",
     "SIN_CLASIFICAR_CUOTA","SIN_CLASIFICAR_SIN_MATCH","SIN_CLASIFICAR_SOLAPE",
     "SIN_CLASIFICAR_PADRON_DUPLICADO"]);
  const positive=n=>Number.isSafeInteger(n) && n>=0;
  function validateCE08(doc,reference) {
    if(!doc || doc.schema!=="DA17-CE08-MOROSIDAD-AGREGADO-APROBADO-V1" ||
       doc.estado!=="AGREGADOS_REVISADOS_PARA_INTEGRACION_GITHUB_REQUIERE_REVISION_DEL_CAMBIO" ||
       doc.corte!=="2026-10-28" || doc.clasificacion_solo_tecnica!==true ||
       doc.publicacion_autorizada_por_declaracion_de_custodio!==true ||
       doc.datos_individuales_exportados!==false || !Array.isArray(doc.periodos) ||
       !doc.periodos.length || doc.periodos.length>3)throw Error("Aprobación CE08 incompleta");
    const ref=new Map(reference.map(r=>[r.periodo,r]));
    const out=new Map();
    for(const p of doc.periodos){
      if(!p || !CE08_PERIODS.has(p.periodo) || out.has(p.periodo) ||
         p.corte!=="2026-10-28" || p.fuente_semestre_validada!==true ||
         p.conciliacion_juridico_contable!=="NO_ACREDITADA" ||
         p.saldo_depurado_proforma_clp!==null || p.saldo_post_smc_clp!==null ||
         !positive(p.folios_cartera)||!positive(p.saldo_cartera_clp) ||
         !Array.isArray(p.grupos)||p.grupos.length!==5 || !Array.isArray(p.residuo))
           throw Error("Período CE08 no verificable");
      const origin=ref.get(p.periodo);
      if(!origin || origin.cartera.folios_listados!==p.folios_cartera ||
         origin.cartera.saldo_listado_clp!==p.saldo_cartera_clp ||
         origin.subconjunto_tecnico_smc!==null)throw Error("Cartera CE08 no cuadra");
      for(let i=0;i<CE08_GROUPS.length;i++){
        const g=p.grupos[i];
        if(!g || g.grupo_bd!==CE08_GROUPS[i] || !positive(g.folios)||
           !positive(g.saldo_clp))throw Error("Grupo CE08 inválido");
      }
      if(new Set(p.residuo.map(x=>x.causa)).size!==p.residuo.length ||
         p.residuo.some(x=>!CE08_RESIDUES.has(x.causa) ||
           !positive(x.folios)||!positive(x.saldo_clp)))
           throw Error("Residuo CE08 inválido");
      const all=[...p.grupos,...p.residuo];
      if(all.reduce((n,x)=>n+x.folios,0)!==p.folios_cartera ||
         all.reduce((n,x)=>n+x.saldo_clp,0)!==p.saldo_cartera_clp ||
         p.clasificacion_completa_sin_residuos!==(p.residuo.length===0))
           throw Error("Cuadratura CE08 fallida");
      out.set(p.periodo,p);
    }
    return out;
  }
  function stateMatch(r, value) {
    return value === "todos" ||
      (value === "propia" && (r.ce08 || r.fuente_clasificacion === "CLASIFICACION_ORIGINAL_SEMESTRE")) ||
      (value === "recalculada" && r.fuente_clasificacion === "RECRUCE_CORREGIDO_2025S1") ||
      (value === "referencial" && r.fuente_clasificacion === "CLASIFICACION_S1_REFERENCIAL") ||
      (value === "sincruce" && !r.ce08 && r.fuente_clasificacion === "SIN_CRUCE_ROL_SEMESTRE");
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
    const ev=r.cobertura;
    if(!ev)throw Error("Falta cobertura de "+r.periodo);
    const rolesMorosos=ev.cartera.roles_prediales_identificados;
    const rolNoIdent=ev.cartera.claves_sin_rol;
    const missing=ev.revision.folios_sin_cruce_residual;
    const missingSaldo=ev.revision.saldo_sin_cruce_residual_clp;
    if(r.cartera.folios_listados!==ev.cartera.folios || r.cartera.saldo_listado_clp!==ev.cartera.saldo_listado_clp)
      throw Error("Cuadratura de fuente DA11 distinta en "+r.periodo);
    const evidence=r.evidenciaFocal ?? null;
    if(evidence && (evidence.folios_cartera!==folios || evidence.saldo_cartera_clp!==bruto ||
      evidence.senal_folios + evidence.resto_sin_clasificar_folios!==folios ||
      evidence.senal_saldo_clp + evidence.resto_sin_clasificar_clp!==bruto))
      throw Error("Descuadre de señal focal en "+r.periodo);
    const tech = r.subconjunto_tecnico_smc;
    const ce08=r.ce08 ?? null;
    const byGroup=ce08?Object.fromEntries(ce08.grupos.map(g=>[g.grupo_bd,g])):null;
    const candidateCE08=byGroup?(byGroup.BD5N.saldo_clp+byGroup.BD9N.saldo_clp):null;
    const candidateFoliosCE08=byGroup?(byGroup.BD5N.folios+byGroup.BD9N.folios):null;
    const restCE08=byGroup?ce08.grupos.slice(2).reduce((n,g)=>n+g.saldo_clp,0):null;
    const restFoliosCE08=byGroup?ce08.grupos.slice(2).reduce((n,g)=>n+g.folios,0):null;
    const residualCE08=ce08?ce08.residuo.reduce((n,x)=>n+x.saldo_clp,0):null;
    const residualFoliosCE08=ce08?ce08.residuo.reduce((n,x)=>n+x.folios,0):null;
    const candidato=ce08?candidateCE08:tech===null?null:tech.saldo_listado_clp;
    const candidatoFolios=ce08?candidateFoliosCE08:tech===null?null:tech.folios_suma_sin_solapamiento_grupos;
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
      periodo:r.periodo, bruto, folios, rolesMorosos, rolNoIdent, candidato, candidatoFolios,
      ce08,
      evidence, focalSenal:ce08?null:tech===null?(evidence?.senal_saldo_clp ?? null):null,
      focalSenalFolios:ce08?null:tech===null?(evidence?.senal_folios ?? null):null,
      cobertura:ev,
      evidencia2026:r.evidencia_2026 ?? null,
      focal2026:(r.alertas_focales_independientes ?? []).find(a=>a.tipo === "nomina_a_eximir_2026_s1_focal") ?? null,
      sinSenal:ce08?restCE08:candidato===null?null:bruto-candidato-missingSaldo,
      sinSenalFolios:ce08?restFoliosCE08:candidatoFolios===null?null:folios-candidatoFolios-missing,
      sinCruce:ce08?residualCE08:candidato===null?(evidence?evidence.resto_sin_clasificar_clp:bruto):missingSaldo,
      sinCruceFolios:ce08?residualFoliosCE08:candidatoFolios===null?(evidence?evidence.resto_sin_clasificar_folios:folios):missing,
      ajuste:conciliado ? adjustment.monto_clp : null,
      corregido:corrected, correcto:correct,
      fuente:ce08?"CRUCE_CE08_VALIDADO":r.fuente_clasificacion,
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
      rolesMorosos:list.length===1 && allKnown(list,"rolesMorosos") ? sum(list,"rolesMorosos") : null,
      candidatos:sum(list,"candidato"),
      candidatosFolios:sum(list,"candidatoFolios"),
      sinSenal:sum(list,"sinSenal"),
      sinSenalFolios:sum(list,"sinSenalFolios"),
      sinCruce:sum(list,"sinCruce"),
      sinCruceFolios:sum(list,"sinCruceFolios"),
      corregido:list.length===1 && allKnown(list,"corregido") ? sum(list,"corregido") : null,
      ajuste:list.length===1 && allKnown(list,"ajuste") ? sum(list,"ajuste") : null,
      correcto:list.length===1 && allKnown(list,"correcto") ? sum(list,"correcto") : null
    };
  }
  function make(tag,cls,text) {
    const e=document.createElement(tag);
    if(cls)e.className=cls;
    if(text !== undefined)e.textContent=text;
    return e;
  }
  const cruceState = r => r.fuente==="SIN_CRUCE_ROL_SEMESTRE"?"Sin cruce por ROL":
    r.fuente==="CLASIFICACION_S1_REFERENCIAL"?"Referencial S1→S2":
    r.fuente==="RECRUCE_CORREGIDO_2025S1"?"Recruce corregido":"Cruce técnico del semestre";
  function drawCoverage(rows) {
    const n=rows.length,roleFull=rows.filter(r=>!r.rolNoIdent).length,
      technically=rows.filter(r=>r.candidato!==null).length,
      referential=rows.filter(r=>r.fuente==="CLASIFICACION_S1_REFERENCIAL").length;
    el("da-net-cov-cartera").textContent=number(n)+"/"+number(n);
    el("da-net-cov-roles").textContent=number(roleFull)+"/"+number(n);
    el("da-net-cov-roles-note").textContent=n-roleFull?
      number(n-roleFull)+" semestre(s) con ROL faltante: 2025-S2 contiene una clave vacía":"Conteos prediales por semestre disponibles";
    el("da-net-cov-cross").textContent=number(technically)+"/"+number(n);
    el("da-net-cov-cross-note").textContent=number(referential)+" cruces referenciales; "+number(n-technically)+
      " sin cruce masivo ("+number(rows.filter(r=>r.evidence!==null).length)+" con hallazgos focales documentados)";
    el("da-net-cov-legal").textContent="0/"+number(n);
    el("da-net-cov-legal-note").textContent="Ningún semestre con cierre jurídico y contable acreditado";
    const table=el("da-net-gaps");
    table.replaceChildren();
    for(const r of rows){
      const tr=table.insertRow();
      td(tr,r.periodo);
      td(tr,number(r.rolesMorosos)+(r.rolNoIdent?" identificados + clave sin ROL":" ROL"));
      td(tr,cruceState(r));
      td(tr,r.candidato===null ? (r.evidence ?
        "Cruce masivo pendiente; "+number(r.evidence.senal_folios)+" hallazgos focales" :
        "Cruce masivo pendiente") :
        r.sinCruceFolios ? number(r.sinCruceFolios)+" folio(s) sin grupo técnico" :
        "Cartera con clasificación técnica");
      td(tr,"Acto, causal y vigencia por cuota");
      td(tr,"SMC/DAF: pagos, abonos, ajustes y reversas");
      const action=r.rolNoIdent?"Resolver clave sin ROL; luego clasificar y conciliar":
        r.fuente==="SIN_CRUCE_ROL_SEMESTRE"?"Cruzar ROL + folio + cuota real con padrón del semestre":
        r.fuente==="CLASIFICACION_S1_REFERENCIAL"?"Reemplazar referencia S1 por clasificación S2 y conciliar":
        r.sinCruceFolios?"Resolver excepciones sin clasificación y revisar actos":
        r.periodo==="2022-S1"?"Examinar 262 claves ROL+vencimiento repetidas; no afirmar doble cobro":
        "Validar acto y movimientos individualmente";
      td(tr,action);
    }
    if(!n){const tr=table.insertRow();const c=td(tr,"Sin semestres para filtros.");c.colSpan=7;}
    const notes=el("da-net-gaps-note");
    notes.textContent=n?
      "Períodos seleccionados: "+number(n)+". El conteo de ROL corresponde a predios/roles del extracto, no a contribuyentes únicos; no se suma entre semestres. 2025-S2 tiene una clave sin ROL (cantidad de folios asociados a ella por verificar). Cruces técnico, legal y contable son etapas distintas.":
      "No hay semestres para los filtros seleccionados.";
  }
  function drawTotals(rows) {
    const s=sums(rows);
    el("da-net-gross").textContent=rows.length ? clp(s.total) : "—";
    el("da-net-folios").textContent=rows.length ? number(s.brutoFolios)+(rows.length===1?" folios del corte":" folios-período; suma no deduplicada") : "Sin selección";
    el("da-net-roles").textContent=rows.length>1?"Ver por semestre":s.rolesMorosos == null?"S/I":number(s.rolesMorosos)+(rows[0].rolNoIdent?" + pendiente":"");
    el("da-net-roles-note").textContent=rows.length>1?
      number(rows.length)+"/"+number(rows.length)+" semestres con conteo de ROL; no se pueden sumar entre períodos. "+number(rows.filter(r=>r.rolNoIdent>0).length)+" semestre parcial." :
      rows.length===0?"Sin períodos": rows[0].rolNoIdent?
        "Solo ROL identificados. Una clave vacía/sin ROL: falta reconstruirla." :
        "ROL prediales distintos del extracto; NO personas deudoras únicas.";
    el("da-net-candidates").textContent=rows.length ? (rows.some(r=>r.candidato !== null) ? clp(s.candidatos) : "S/I") : "—";
    el("da-net-candidates-detail").textContent=rows.length ?
      "Cruce masivo en "+number(rows.filter(r=>r.candidato!==null).length)+"/"+number(rows.length)+
      " semestres; "+number(rows.filter(r=>r.evidence!==null).length)+
      " con hallazgos focales no aditivos. No descontar sin validar exención por cuota." : "Sin selección";
    el("da-net-correct").textContent=s.correcto == null ? "S/I" : clp(s.correcto);
    el("da-net-adjusted").textContent=s.corregido == null ? "S/I · pendiente" : clp(s.corregido);
    el("da-net-adjust-note").textContent=s.corregido == null ?
      "Sin conciliación por cuota y deduplicación de obligaciones no existe saldo depurado comprobado; varios semestres son cortes históricos, no una cartera única." :
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
  function drawFocalSummary(rows){
    const wrap=el("da-net-focal-summary");wrap.replaceChildren();
    const selected=rows.filter(r=>r.evidence);
    if(!selected.length){
      wrap.hidden=true;
      return;
    }
    wrap.hidden=false;
    for(const r of selected){
      const e=r.evidence;
      const card=make("article","da-net-focal-summary-card");
      card.append(make("h5","",r.periodo+" · evidencia parcial del expediente"));
      card.append(make("p","da-net-focal-summary-number",number(e.senal_folios)+" folios con señal documentada · "+clp(e.senal_saldo_clp)));
      card.append(make("p","da-net-focal-summary-detail",
        number(e.resto_sin_clasificar_folios)+" folios y "+clp(e.resto_sin_clasificar_clp)+
        " siguen sin cruce masivo comparable (gris)."));
      for(const d of e.desglose){
        const note=make("p","da-net-focal-summary-detail",d.fuente+": "+number(d.folios)+" folios; "+clp(d.saldo_clp));
        card.append(note);
      }
      for(const extra of e.alertas_independientes ?? []){
        if(Number.isInteger(extra.folios))
          card.append(make("p","da-net-focal-summary-warning",
            "Alerta adicional NO sumable a la barra: "+extra.tipo+" · "+
            number(extra.folios)+" folios · "+clp(extra.saldo_clp)+". "+extra.advertencia));
      }
      if(r.periodo==="2026-S2")
        card.append(make("p","da-net-focal-summary-warning",
          "BD1 SII S2 conserva semestres S1 y existe solape BD8N/BD9N: la señal BD9N es provisional, no cruce integral validado."));
      card.append(make("p","da-net-focal-summary-warning",
        "No demuestra exención vigente, baja SMC ni cobro indebido. Para cerrar se requiere cruce de cartera completo y actos/movimientos por cuota."));
      wrap.append(card);
    }
  }
  function drawBars(rows) {
    const parent=el("da-net-bars");
    parent.replaceChildren();
    const unit=el("da-net-unit").value;
    const grossKey=unit==="folios"?"folios":"bruto";
    const candidateKey=unit==="folios"?"candidatoFolios":"candidato";
    const otherKey=unit==="folios"?"sinSenalFolios":"sinSenal";
    const focalKey=unit==="folios"?"focalSenalFolios":"focalSenal";
    const unknownKey=unit==="folios"?"sinCruceFolios":"sinCruce";
    const grossTotal=Math.max(1,...rows.map(r=>r[grossKey]));
    const unitText=unit==="folios"?"folios-período del extracto (cuota real pendiente)":"CLP de saldo listado";
    el("da-net-chart-caption").textContent="Cruces técnicos y hallazgos focales · "+unitText+". El componente gris sigue sin clasificación masiva; ningún color acredita exención o cobro correcto.";
    for(const r of rows){
      const line=make("div","da-net-bar-row");
      const title=make("div","da-net-bar-title",r.periodo);
      if(r.fuente==="CLASIFICACION_S1_REFERENCIAL")title.append(make("small",""," · referencial"));
      if(r.evidence)title.append(make("small","da-net-focal-marker"," · "+number(r.evidence.senal_folios)+" hallazgos"));
      const bar=make("div","da-net-bar-bg");
      const c=r[candidateKey],o=r[otherKey],f=r[focalKey],unknown=r[unknownKey];
      const pieces=[
        [c??0,"da-net-segment-candidate","Coincidencia técnica de cruce histórico"],
        [o??0,"da-net-segment-other","Sin coincidencia en cruce histórico"],
        [f??0,"da-net-segment-focal","Hallazgo focal documentado, no exención aplicada"],
        [unknown,"da-net-segment-pending","Resto sin cruce masivo"]
      ];
      const composition=pieces.reduce((s,p)=>s+p[0],0);
      if(Math.abs(composition-r[grossKey])>0.01)throw Error("Descuadre en barra "+r.periodo);
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
        "; hallazgo focal "+(f==null?"ninguno":number(f))+
        "; resto sin cruce masivo "+number(unknown));
      line.append(title,bar,make("div","da-net-bar-value",number(r[grossKey])));
      parent.append(line);
    }
    if(!rows.length)parent.append(make("p","","Sin resultados para estos filtros."));
  }
  function drawFocus2026(rows) {
    const container=el("da-net-focal-content");
    container.replaceChildren();
    const selected=rows.filter(r=>r.periodo==="2026-S1" || r.periodo==="2026-S2");
    if(!selected.length){
      container.append(make("p","da-net-foot","Selecciona el año 2026 o los semestres 2026-S1/2026-S2 para consultar la evidencia focal. Los demás períodos conservan su propia matriz de auditoría."));
      return;
    }
    for(const r of selected){
      const card=make("div","da-net-focal-card");
      card.append(make("h5","",r.periodo+" · "+(r.periodo==="2026-S1"?"cohorte focal pendiente de revisar":"resolución y universo RSH")));
      const headline=make("p","da-net-focal-lead",number(r.folios)+" folios con saldo listado · "+clp(r.bruto));
      card.append(headline);
      if(r.periodo==="2026-S1" && r.focal2026){
        const a=r.focal2026, expected=a.combinaciones_esperadas, present=a.cuotas_presentes_en_morosos, absent=a.cuotas_ausentes_de_morosos;
        if(expected!==present+absent)throw Error("Cohorte 2026-S1 sin cuadratura");
        const facts=make("div","da-net-focal-facts");
        for(const [label,value] of [
          ["ROL en cohorte focal",number(a.roles)],
          ["Combinaciones previstas",number(expected)],
          ["Presentes en morosos",number(present)],
          ["Ausentes del extracto",number(absent)]
        ]){
          const b=make("div","da-net-focal-fact");b.append(make("small","",label),make("strong","",value));facts.append(b);
        }
        card.append(facts);
        const stacked=make("div","da-net-focal-stack");
        stacked.setAttribute("role","img");
        stacked.setAttribute("aria-label",number(present)+" combinaciones previstas presentes en morosos y "+number(absent)+" ausentes, de "+number(expected));
        const p=make("span","da-net-focal-present");
        p.style.width=(expected?100*present/expected:0)+"%";
        const a2=make("span","da-net-focal-absent");
        a2.style.width=(expected?100*absent/expected:0)+"%";
        stacked.append(p,a2);
        card.append(stacked);
        card.append(make("p","da-net-foot","Monto de la cohorte presente: "+clp(a.saldo_reajuste_multa_pendiente_clp)+" incluyendo saldo, reajustes y multas. NO es una deducción del saldo general ni prueba de exención. Ausencia de un registro NO acredita pago o descarga."));
        card.append(make("p","da-net-focal-pending","Próxima validación: número real de cuota, acto/vigencia de exención, libros SMC/DAF y movimientos por folio. Sin esas comprobaciones, la deuda depurada sigue S/I."));
      }else if(r.periodo==="2026-S2"){
        const e=r.evidencia2026 ?? {};
        const facts=make("div","da-net-focal-facts");
        for(const [label,value] of [
          ["ROL en nómina RSH corregida (no morosos)",number(e.padron_bd9n_roles)],
          ["ROL en Resolución 2628/2026 (no cuotas)",number(e.acto_municipal_rol)]
        ]){
          const b=make("div","da-net-focal-fact");b.append(make("small","",label),make("strong","",value));facts.append(b);
        }
        card.append(facts);
        card.append(make("p","da-net-focal-pending","Pendiente: enlace de esa resolución a las cuotas morosas reales, acuse SMC, fechas de vencimiento y movimientos. No se puede descontar el universo RSH del saldo listado."));
      }
      container.append(card);
    }
  }
  function td(tr,t){const c=tr.insertCell();c.textContent=t;return c;}
  function drawTable(rows) {
    const body=el("da-net-table");body.replaceChildren();
    for(const r of rows){
      const tr=body.insertRow();
      td(tr,r.periodo+(r.fuente==="CLASIFICACION_S1_REFERENCIAL"?" *":""));
      td(tr,number(r.folios));
      td(tr,number(r.rolesMorosos)+(r.rolNoIdent?" + clave sin ROL":""));
      td(tr,clp(r.bruto));
       td(tr,clp(r.candidato));
      td(tr,clp(r.focalSenal));
      td(tr,clp(r.sinSenal));
      td(tr,r.sinCruceFolios>0?clp(r.sinCruce):"—");
      td(tr,clp(r.correcto));
      td(tr,clp(r.ajuste));
      td(tr,clp(r.corregido));
    }
    if(!rows.length){const tr=body.insertRow();const c=td(tr,"No hay resultados.");c.colSpan=11;}
  }
  function exportCsv() {
    const fields=["periodo","folios_periodo_listados","rol_prediales_identificados","claves_sin_rol","saldo_moroso_registrado_clp",
      "coincidencias_tecnicas_clp","hallazgos_focales_clp","sin_coincidencia_tecnica_clp",
      "sin_cruce_clp","cobro_correcto_acreditado_clp","correccion_conciliada_clp",
      "saldo_corregido_verificado_clp","fuente_clasificacion","corte","calidad_rol","folios_sin_cruce_tecnico","hallazgos_focales_folios","cobertura_hallazgo"];
    const esc=v=>'"'+String(v==null?"":v).replaceAll('"','""')+'"';
    const lines=[fields];
    for(const r of selected)lines.push([r.periodo,r.folios,r.rolesMorosos,r.rolNoIdent,r.bruto,r.candidato,r.focalSenal,r.sinSenal,
      r.sinCruce,r.correcto,r.ajuste,r.corregido,r.fuente,r.corte,r.cobertura.cartera.calidad_roles,r.sinCruceFolios,r.focalSenalFolios,r.evidence?.clase_segmento ?? null]);
    const csv="\uFEFF"+lines.map(r=>r.map(esc).join(";")).join("\r\n");
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
    const a=document.createElement("a");a.href=url;a.download="derechos_aseo_morosidad_hallazgos_cobertura_ce06.csv";
    a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function render() {
    try{
      selected=filtered().map(classification);
      drawCoverage(selected);drawTotals(selected);drawFocus2026(selected);drawBars(selected);drawFocalSummary(selected);drawTable(selected);
      el("da-net-error").hidden=true;
    }catch(e){el("da-net-error").hidden=false;el("da-net-error").textContent=e.message;}
  }
  async function init(){
    try{
      const [response,respCoverage,respFocal]=await Promise.all([
        fetch("../data/cartera_exenciones_auditoria_v1.json",{cache:"no-store"}),
        fetch("../data/morosidad_cobertura_12_periodos_v1.json",{cache:"no-store"}),
        fetch("../data/morosidad_hallazgos_focales_2025s2_2026_v1.json",{cache:"no-store"})
      ]);
      if(!response.ok || !respCoverage.ok || !respFocal.ok)throw new Error("Fuentes de cartera y cobertura no disponibles");
      const [data,coverage,focal]=await Promise.all([response.json(),respCoverage.json(),respFocal.json()]);
      if(focal.periodos.length!==3)throw new Error("Deben existir tres períodos focales recuperados");
      if(coverage.periodos.length!==12 || coverage.resumen.semestres_con_cartera!==12
        || coverage.resumen.folios_periodo_suma_sin_deduplicar!==190838
        || coverage.resumen.saldo_clp_suma_sin_deduplicar!==2832929422)
        throw new Error("Fuente DA11 de cobertura inconsistente");
      const coverageMap=new Map(coverage.periodos.map(p=>[p.periodo,p]));
      if(coverageMap.size!==12 || data.periodos.some(p=>!coverageMap.has(p.periodo)))
        throw new Error("No hay correspondencia de los doce períodos");
      if(data.periodos.length!==12 ||
        data.periodos.reduce((s,r)=>s+r.cartera.saldo_listado_clp,0)!==2832929422)
        throw new Error("La fuente no coincide con el consolidado aprobado");
      const focalMap=new Map(focal.periodos.map(p=>[p.periodo,p]));
      if(focalMap.size!==3 || focal.periodos.some(p=>!coverageMap.has(p.periodo)))
        throw Error("Evidencias focales no cuadran con cortes de cartera");
      periods=data.periodos.map(p=>({...p,cobertura:coverageMap.get(p.periodo),
        evidenciaFocal:focalMap.get(p.periodo) ?? null}));
      const q=new URLSearchParams(window.location.search);
      if(q.get("anio")==="2026") {
        el("da-audit-year").value="2026";
        el("da-audit-year").dispatchEvent(new Event("change"));
      }
      for(const key of keys)el(key).addEventListener("change",render);
      el("da-net-unit").addEventListener("change",render);
      el("da-net-export").addEventListener("click",exportCsv);
      render();window.__daBalanceReady=true;
    }catch(e){el("da-net-error").hidden=false;el("da-net-error").textContent=e.message;window.__daBalanceReady=false;}
  }
  init();
})();