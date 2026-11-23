/* CE39 — Dashboard principal v2. Serie longitudinal + KPI históricos + Morosidad apilada.
 * Fuentes agregadas públicas, sin microdatos. Las categorías no certifican descargas.
 * Se preservan todas las vistas y controles existentes de v2/assets/app.js.
 */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  if (!$("ce39-series")) return;
  const fmt = new Intl.NumberFormat("es-CL",{maximumFractionDigits:0});
  const format = n => Number.isSafeInteger(n) ? fmt.format(n) : "S/I";
  const clp = n => Number.isSafeInteger(n) ? "$"+fmt.format(n) : "S/I";
  const mm = n => Number.isFinite(n) ? "$"+new Intl.NumberFormat("es-CL",{maximumFractionDigits:1}).format(n/1e6)+" MM" : "S/I";
  const ints = x => Number.isSafeInteger(x) && x>=0;
  const node = (tag,cls,value) => {const n=document.createElement(tag);if(cls)n.className=cls;if(value!==undefined)n.textContent=value;return n;};
  const names=[
   "Exención legal por avalúo ≤225 UTM (BD5N)",
   "Exención por política municipal RSH (BD9N)",
   "Derechos de aseo asignados al cobro municipal (BD8N)",
   "Contribuciones TGR con marca RSH municipal (BD4N_RSH)",
   "Contribuciones TGR sin esa marca (BD4N_RESTO)"
  ];
  const colors=["#69b8af","#2b8091","#2365a4","#8958b7","#cb9144"];
  const keys=["filtro_avaluo_225utm","rsh_candidato","municipal_potencial","tgr_rsh_candidato_exencion","tgr_resto_sin_marca_rsh"];
  let padr=[],debt=[],sMode="composicion",mUnit="folios",chosen="2026-S2";

  const measures={
   composicion: r=>r.rol_total,
   tgr: r=>r.tgr_subtotal.roles,
   rol_total:r=>r.rol_total,
   folios_listados:r=>debt.find(x=>x.periodo===r.periodo)?.folios??r.cartera.folios_listados,
   saldo_listado_millones_clp:r=>debt.find(x=>x.periodo===r.periodo)?.saldo_clp??null
  };
  function validate(a,b){
    if(!a||!b||!Array.isArray(a.periodos)||!Array.isArray(b.periodos)||
       a.periodos.length!==12||b.periodos.length!==12||
       b.esquema!=="da17_morosidad_apilada_propuesta_v1"||
       b.resumen.folios_periodo!==190838||b.resumen.saldo_listado_clp!==2832929422||
       b.resumen.cierres_juridico_contables!==0||b.resumen.deuda_exigible_depurada_clp!==null)
      throw Error("Fuentes o cuadraturas no acreditadas");
    const ids=new Set(),periods=new Set(),tot={f:0,s:0};
    a.periodos.forEach(p=>{
      if(!/^\d{4}-S[12]$/.test(p.periodo)||ids.has(p.periodo)||!ints(p.rol_total)||
         !p.grupos||keys.some(k=>!ints(p.grupos[k])))throw Error("Padrón mal formado");
      ids.add(p.periodo);
    });
    b.periodos.forEach(p=>{
      if(periods.has(p.periodo)||!ids.has(p.periodo)||!ints(p.folios)||!ints(p.saldo_clp)||
         !p.municipal||!p.legal||!p.no_segmentado||!p.beneficio_aplicado||
         p.beneficio_aplicado.folios!==null||p.beneficio_aplicado.saldo_clp!==null||
         !ints(p.municipal.folios)||!ints(p.legal.folios)||!ints(p.no_segmentado.folios)||
         !ints(p.municipal.saldo_clp)||!ints(p.legal.saldo_clp)||!ints(p.no_segmentado.saldo_clp)||
         p.municipal.folios+p.legal.folios+p.no_segmentado.folios!==p.folios||
         p.municipal.saldo_clp+p.legal.saldo_clp+p.no_segmentado.saldo_clp!==p.saldo_clp)
         throw Error("Segmentos no acreditados: "+p.periodo);
      periods.add(p.periodo);tot.f+=p.folios;tot.s+=p.saldo_clp;
      if(a.periodos.find(x=>x.periodo===p.periodo).cartera.folios_listados!==p.folios)
        throw Error("Carteras de distinto corte");
    });
    if(tot.f!==190838||tot.s!==2832929422||ids.size!==12||periods.size!==12||
       b.resumen.semestres_con_indicio_municipal_y_filtro_legal_tecnicos!==12||
       b.periodos.find(x=>x.periodo==="2026-S2").municipal.folios!==1053||
       b.periodos.find(x=>x.periodo==="2025-S2").municipal.folios!==3226||
       b.periodos.find(x=>x.periodo==="2026-S1").municipal.folios!==2362)
       throw Error("Corte o controles CE38 incompatibles");
  }

  function legend(root,items){
    root.replaceChildren();
    for(const [title,color] of items){
      const entry=node("span","ce39-key");
      const dot=node("i","ce39-dot");dot.style.background=color;dot.setAttribute("aria-hidden","true");
      entry.append(dot,node("span","",title));root.appendChild(entry);
    }
  }
  function periodSync(p){
    chosen=p;
    const dropdown=$("period");
    if(dropdown && dropdown.querySelector('option[value="'+p+'"]')){
      dropdown.value=p;
      dropdown.dispatchEvent(new Event("change",{bubbles:true}));
    }
  }

  function drawSeries(){
    const mode=$("ce39-metric").value;
    sMode=mode;
    const rows=$("ce39-series"),legendRoot=$("ce39-series-legend");
    const max=Math.max(1,...padr.map(p=>measures[mode](p)??0));
    const items=mode==="composicion"?names.map((n,i)=>[n,colors[i]]):mode==="tgr"?
      [[names[3],colors[3]],[names[4],colors[4]]]:
      [[mode==="rol_total"?"ROL del padrón":mode==="folios_listados"?"Folios con saldo listado":"Saldo histórico listado CLP","#3074c5"]];
    legend(legendRoot,items);
    rows.replaceChildren();
    for(const p of padr){
      const total=measures[mode](p);
      const segments=mode==="composicion"?keys.map((k,i)=>({n:p.grupos[k],color:colors[i],label:names[i]})):
        mode==="tgr"?[{n:p.grupos[keys[3]],color:colors[3],label:names[3]},{n:p.grupos[keys[4]],color:colors[4],label:names[4]}]:
        [{n:total??0,color:"#3074c5",label:"Total"}];
      const row=node("button","ce39-row");row.type="button";row.dataset.period=p.periodo;
      row.setAttribute("aria-pressed",String(p.periodo===chosen));
      row.setAttribute("aria-label",p.periodo+": "+(total===null?"S/I":mode==="saldo_listado_millones_clp"?clp(total):format(total)));
      const track=node("span","ce39-track"),bars=node("span","ce39-bars");
      bars.style.width=(100*(total??0)/max).toFixed(3)+"%";
      segments.forEach(s=>{if(!s.n)return;const div=node("i","ce39-seg");div.style.background=s.color;div.style.flexGrow=String(s.n);div.title=s.label+": "+(mode==="saldo_listado_millones_clp"?clp(s.n):format(s.n));bars.appendChild(div);});
      track.appendChild(bars);
      row.append(node("span","ce39-row-year",p.periodo),track,node("span","ce39-row-num",mode==="saldo_listado_millones_clp"?mm(total):format(total)));
      row.onclick=()=>{periodSync(p.periodo);drawSeries();};
      rows.appendChild(row);
    }
    $("ce39-series-status").textContent="12 semestres · "+(mode==="saldo_listado_millones_clp"?"CLP históricos exactos":"ROL / folios según indicador")+
      " · la leyenda BD5N/BD9N nombra filtros técnicos, no exenciones aplicadas";
  }

  function drawAccum(){
    const candidates=debt.reduce((a,r)=>a+r.municipal.folios+r.legal.folios,0);
    const amount=debt.reduce((a,r)=>a+r.municipal.saldo_clp+r.legal.saldo_clp,0);
    $("ce39-k-folios").textContent="190.838";
    $("ce39-k-saldo").textContent=clp(2832929422);
    $("ce39-k-review").textContent=format(candidates);
    $("ce39-k-review-clp").textContent=clp(amount);
    $("ce39-k-correct").textContent="S/I";
    $("ce39-k-correct-clp").textContent="S/I";
  }

  function drawMoro(){
    const rows=$("ce39-moro-rows"),max=Math.max(1,...debt.map(r=>mUnit==="folios"?r.folios:r.saldo_clp));
    rows.replaceChildren();
    for(const p of debt){
      const total=mUnit==="folios"?p.folios:p.saldo_clp;
      const values=["municipal","legal","no_segmentado"].map((k,i)=>({
        n:mUnit==="folios"?p[k].folios:p[k].saldo_clp,
        color:["#148878","#d69b38","#9baeb9"][i],label:k
      }));
      const row=node("button","ce39-row");row.type="button";row.dataset.period=p.periodo;row.setAttribute("aria-pressed",String(chosen===p.periodo));
      row.setAttribute("aria-label",p.periodo+": "+(mUnit==="folios"?format(total):clp(total))+
        "; indicio municipal "+format(p.municipal.folios)+", filtro legal "+format(p.legal.folios));
      const track=node("span","ce39-track"),bars=node("span","ce39-bars");bars.style.width=(100*total/max).toFixed(3)+"%";
      values.forEach((s,i)=>{
        if(s.n<=0)return;
        const seg=node("i","ce39-seg"+(i===2&&p.periodo==="2026-S2"?" ce39-unclassified":""));
        seg.style.background=i===2&&p.periodo==="2026-S2"?"":s.color;seg.style.flexGrow=String(s.n);
        seg.title=(i===0?"Candidato municipal":i===1?"Filtro legal":"Sin exención identificada en cruce técnico")+": "+
          (mUnit==="folios"?format(s.n):clp(s.n));
        bars.appendChild(seg);
      });
      track.appendChild(bars);
      row.append(node("span","ce39-row-year",p.periodo),track,node("span","ce39-row-num",mUnit==="folios"?format(total):mm(total)));
      row.onclick=()=>{chosen=p.periodo;drawMoro();};
      rows.appendChild(row);
    }
    drawMoroDetail();
  }

  function drawMoroDetail(){
    const p=debt.find(x=>x.periodo===chosen)||debt.at(-1);if(!p)return;
    $("ce39-moro-name").textContent=p.periodo+" · revisión técnica";
    $("ce39-moro-total").textContent=mUnit==="folios"?format(p.folios):clp(p.saldo_clp);
    $("ce39-moro-mun").textContent=mUnit==="folios"?format(p.municipal.folios):clp(p.municipal.saldo_clp);
    $("ce39-moro-legal").textContent=mUnit==="folios"?format(p.legal.folios):clp(p.legal.saldo_clp);
    $("ce39-moro-rest").textContent=mUnit==="folios"?format(p.no_segmentado.folios):clp(p.no_segmentado.saldo_clp);
    $("ce39-moro-note").textContent=
       (p.periodo==="2025-S2"?"Cruce RUT propietario SII / persona RSH 2025; no se suman coincidencias solo por dirección.":
       p.periodo==="2026-S2"?"Coincidencias de la nómina Res. 941, no descuentos; filtro BD5N=0, sin descartar otras causales legales.":
       p.periodo==="2026-S1"?"Partición BD original CE19, sin certificar vigencia ni cuenta corriente.":
       "Grupos técnicos BD de fuente histórica; para 2021-S2 y 2022-S2 la clasificación social es referencial de S1.")+
       " El resto solo está revisado bajo los filtros disponibles, no se certifica su cobro correcto.";
    rowsPressed("ce39-moro-rows",p.periodo);
  }
  function rowsPressed(id,p){$(id).querySelectorAll(".ce39-row").forEach(el=>el.setAttribute("aria-pressed",String(el.dataset.period===p)));}
  function showError(e){
    ["ce39-series-status","ce39-moro-status"].forEach(id=>$(id).textContent="No es posible confirmar datos: "+e.message);
    ["ce39-series","ce39-moro-rows"].forEach(id=>$(id).replaceChildren());
    ["ce39-k-folios","ce39-k-saldo","ce39-k-review","ce39-k-review-clp","ce39-k-correct","ce39-k-correct-clp"].forEach(id=>$(id).textContent="S/I");
    console.warn("CE39 validación:",e.message);
    window.__ce39Ready=false;
  }

  Promise.all([
     fetch("../data/periodos.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("No hay padrón público");return r.json();}),
     fetch("../propuestas/morosidad-apilada-20261123/datos.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("No hay agregado CE38");return r.json();})
  ]).then(([a,b])=>{
     validate(a,b);padr=a.periodos;debt=b.periodos;
     const select=$("ce39-metric");
     select.onchange=drawSeries;
     $("ce39-moro-folios").onclick=()=>{mUnit="folios";setMUnit();drawMoro();};
     $("ce39-moro-clp").onclick=()=>{mUnit="saldo";setMUnit();drawMoro();};
     drawSeries();drawAccum();drawMoro();
     $("ce39-moro-status").textContent="12/12 semestres con segmentación técnica · 0/12 con cierre jurídico-contable";
     window.__ce39Ready=true;
  }).catch(showError);
  function setMUnit(){
    $("ce39-moro-folios").setAttribute("aria-pressed",String(mUnit==="folios"));
    $("ce39-moro-clp").setAttribute("aria-pressed",String(mUnit==="saldo"));
  }
})();