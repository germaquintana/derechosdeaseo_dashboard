# Dashboard público · Derechos de Aseo de Recoleta 2021–2026

Visualizador estático, sin servicios externos ni costo de alojamiento previsto, para consultar **12 semestres de indicadores agregados**.

**Estado de publicación:** versión **exploratoria / no oficial**. La presencia de resultados en este repositorio no constituye certificación de padrón, beneficio tributario, pago recibido ni deuda exigible. Cualquier uso administrativo debe basarse en actos y antecedentes oficiales de las unidades competentes.

## Abrir el dashboard

- Sitio GitHub Pages: `https://germaquintana.github.io/derechosdeaseo_dashboard/` (**URL prevista, validar que GitHub Pages esté habilitado antes de darla por operativa**).
- Código: [`index.html`](index.html); archivo **autónomo**, también funciona descargado y abierto mediante `file://`.
- [`data/periodos.json`](data/periodos.json): conjunto de indicadores **filtrados para publicación**.

### Configuración gratuita de GitHub Pages

1. Ir a **Settings → Pages** de este repositorio público.
2. En **Build and deployment → Source**, elegir **Deploy from a branch**.
3. Seleccionar rama `main` y carpeta `/(root)`; pulsar **Save**.
4. Comprobar la URL que GitHub muestre como **Visit site**. No se requiere GitHub Pro para publicar desde un repositorio público en GitHub Free.

## Qué está publicado y qué no

| Dato | Criterio de publicación |
|---|---|
| Total de ROL por semestre | Solo total agregado |
| BD5N | Filtro técnico por avalúo; **no** exención aprobada |
| BD9N | Coincidencia técnica RSH candidata; **no** exención vigente acreditada |
| BD8N | Potencial canal de cobro municipal; **no** pagos recibidos |
| BD4N | Potencial canal TGR; **no** pagos recibidos |
| Morosidad | Total de **folios listados** y ROL únicos solo cuando están acreditados sin duplicar vencimientos |
| Saldos | **Redondeados a millones de CLP**; no se publican saldos por folio o contribuyente |
| Alertas | Solo estado de revisión por semestre; se omiten recuentos de cohortes pequeñas y subgrupos que permitirían inferencias |
| Identificación individual | **No se publican** RUT, ROL individuales, nombres, domicilios, folios individuales ni listados de personas |
| Expedientes y métodos detallados | Se conservan fuera de este repositorio público |

**Advertencias de fuente:** los semestres 2021-S2 y 2022-S2 recurren a padrones referenciales de otro semestre; 2025-S1 corresponde a un **reproceso técnico provisional** con 55.648 ROL; 2025-S2 conserva condición de manifiesto sin comprobación individual; 2026-S2 mantiene una clasificación RSH original pendiente de corrección y conciliación. Las alertas sin clasificación publicada **no equivalen a cero casos**. Los montos listados tampoco representan saldos históricos comparables a un mismo corte contable.

## Gobernanza de información

- **No copiar** contenido íntegro de repositorios privados, planillas originales o archivos de cobranza nominales.
- Para actualizar `periodos.json`, usar siempre una **lista positiva** de campos permitidos y control de revelación de pequeños grupos; no eliminar campos sensibles después de copiar un dataset completo.
- Actualizar el snapshot integrado de `index.html` junto con el JSON externo, validando la igualdad entre ambos.
- Verificar datos agregados, leyendas, cifras aproximadas y permisos de difusión antes de cada publicación nueva.
- No sincronizar automáticamente datos privados hacia este repositorio sin una etapa de revisión/aprobación de publicación.
- El repositorio público y su historial son accesibles a cualquier persona. No subir información reservada **ni siquiera temporalmente**: eliminarla luego no garantiza retirarla del historial de Git.

## Versión

- **2026-11-05:** primera versión pública de indicadores agregados y reducidos, a partir de una auditoría técnica 2021–2026. Sin publicaciones nominativas; no certifica actos individuales ni el estado exigible de deuda.
