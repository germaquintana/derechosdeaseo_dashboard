/* CE10: evidencias de tres expedientes en criterios distintos. No cruza C3 ni genera exenciones. */
(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  if(!$("da-net-ce10"))return;
  const N=new Intl.NumberFormat("es-CL",{maximumFractionDigits:0});
  const fmt=n=>N.format(n),clp=n=>"$"+fmt(n);
  const EXPECTED={
    "2025-S2":{folios:16261,saldo:277162912,codes:["TARIFA_GENERAL","TARIFA_ESPECIAL_369","REGISTRO_PRUEBA"]},
    "2026-S1":{folios:26131,saldo:451083131,codes:["CUOTAS_DOCUMENTADAS","COHORTE_MAYO_PENDIENTE"]},
    "2026-S2":{folios:11715,saldo:207707569,codes:["EN_BD8N_PROVISIONAL","FUERA_BD8N"]}
  };
  const add=(tag,cls,t)=>{
    const el=document.createElement(tag);
    if(cls)el.className=cls;
    if(t!==undefined)el.textContent=t;
    return el;
  };
  function validate(source,baseline){
    if(!source||source.schema!=="DA17-CE10-DIAGNOSTICOS_ORIGEN_V1"||
       source.corte!=="2026-10-28"||
       source.segmentos_separados_de_ce08!==true||
       source.data_personal!==false||
       !Array.isArray(source.periodos)||source.periodos.length!==3)
      throw Error("CE10: esquema/corte no verificable");
    const raw=new Map(baseline.periodos.map(p=>[p.periodo,p.cartera]));
    const observed=new Map();
    for(const p of source.periodos){
      const x=EXPECTED[p.periodo],o=raw.get(p.periodo);
      if(!x||observed.has(p.periodo)||!o||!Array.isArray(p.segmentos)||
         p.segmentos.length!==x.codes.length||
         !Array.isArray(p.excepciones)||!Array.isArray(p.notas)||
         typeof p.criterio!=="string"||typeof p.accion_pendiente!=="string"||
         p.folios_cartera!==x.folios||p.saldo_cartera_clp!==x.saldo||
         p.folios_cartera!==o.folios_listados||
         p.saldo_cartera_clp!==o.saldo_listado_clp)
        throw Error("CE10: cartera/fuente no cuadra con el mismo corte");
      for(let i=0;i<p.segmentos.length;i++){
        const g=p.segmentos[i];
        if(!g||g.codigo!==x.codes[i]||
           typeof g.nombre!=="string"||!Number.isSafeInteger(g.folios)||
           !Number.isSafeInteger(g.saldo_clp)||g.folios<0||g.saldo_clp<0)
          throw Error("CE10: segmentos técnicos inconsistentes");
      }
      if(p.segmentos.reduce((n,g)=>n+g.folios,0)!==p.folios_cartera||
         p.segmentos.reduce((n,g)=>n+g.saldo_clp,0)!==p.saldo_cartera_clp)
        throw Error("CE10: segmentos no cuadran");
      if(p.excepciones.some(e=>typeof e.tipo!=="string"||
            !Number.isSafeInteger(e.folios)||!Number.isSafeInteger(e.saldo_clp)||
            e.folios<0||e.saldo_clp<0))
        throw Error("CE10: alertas focales inválidas");
      observed.set(p.periodo,p);
    }
    if(observed.size!==3)throw Error("CE10: semestres ausentes");
    return observed;
  }
  let data=new Map();
  function render(){
    const year=$("da-audit-year").value;
    const period=$("da-audit-period").value;
    const state=$("da-audit-state").value;
    const filtered=[...data.values()].filter(p=>
      (year==="todos"||p.periodo.startsWith(year))&&
      (period==="todos"||p.periodo===period)&&
      (state==="todos"||state==="sincruce"));
    const wrap=$("da-net-ce10-cards");
    wrap.replaceChildren();
    if(!filtered.length){
      $("da-net-ce10-status").textContent="CE10: no hay controles de origen para los filtros seleccionados.";
      return;
    }
    $("da-net-ce10-status").textContent=fmt(filtered.length)+"/"+fmt(filtered.length)+
      " períodos con cuadratura de evidencia descriptiva; 0/3 cruces completos CE07/CE08 aprobados. "+
      "Los grupos de exención y el saldo corregido siguen sin conciliar.";
    for(const p of filtered){
      const card=add("article","da-net-ce10-card");
      const title=add("h5","",p.periodo+" · "+p.criterio);
      card.append(title);
      card.append(add("p","da-net-ce10-sub",fmt(p.folios_cartera)+" folios registrados · "+clp(p.saldo_cartera_clp)+" de saldo listado"));
      const bar=add("div","da-net-ce10-bar");
      bar.setAttribute("role","img");
      bar.setAttribute("aria-label",p.periodo+": partición por "+p.criterio.toLowerCase());
      for(const [i,g] of p.segmentos.entries()){
        if(!g.saldo_clp)continue;
        const span=add("span","da-net-ce10-color-"+i);
        span.style.width=(g.saldo_clp/p.saldo_cartera_clp*100)+"%";
        span.title=g.nombre+": "+fmt(g.folios)+" folios, "+clp(g.saldo_clp);
        bar.append(span);
      }
      card.append(bar);
      const ul=add("ul","da-net-ce10-segments");
      for(const [i,g] of p.segmentos.entries()){
        const li=add("li","");
        li.append(add("span","da-net-ce10-dot da-net-ce10-color-"+i),
                  add("span","",g.nombre),
                  add("strong","",fmt(g.folios)+" folios · "+clp(g.saldo_clp)));
        ul.append(li);
      }
      card.append(ul);
      for(const note of p.notas)card.append(add("p","da-net-ce10-note",note));
      card.append(add("p","da-net-ce10-next","Pendiente: "+p.accion_pendiente));
      wrap.append(card);
    }
  }
  async function init(){
    try{
      const [s,b]=await Promise.all([
        fetch("../data/morosidad_diagnosticos_origen_ce10_v1.json",{cache:"no-store"}),
        fetch("../data/cartera_exenciones_auditoria_v1.json",{cache:"no-store"})
      ]);
      if(!s.ok||!b.ok)throw Error("CE10: datos agregados no disponibles");
      data=validate(await s.json(),await b.json());
      for(const id of ["da-audit-year","da-audit-period","da-audit-state"])
        $(id).addEventListener("change",render);
      render();
      window.__daCE10Ready=true;
    }catch(err){
      $("da-net-ce10-status").textContent=
        "CE10: controles descriptivos no disponibles o inconsistentes; se mantienen las cifras históricas sin alterar.";
      $("da-net-ce10-cards").replaceChildren();
      window.__daCE10Ready=false;
    }
  }
  init();
})();