# Dashboard público · Derechos de Aseo de Recoleta 2021–2026

Visualizador estático, sin servicios externos ni costo de alojamiento previsto, para consultar **12 semestres de indicadores agregados**.

**Estado de publicación:** GitHub Pages desplegado correctamente según [GitHub Actions #42102463302](https://github.com/germaquintana/derechosdeaseo_dashboard/actions/runs/42102463302); versión **exploratoria / no oficial**. La presencia de resultados en este repositorio no constituye certificación de padrón, beneficio tributario, pago recibido ni deuda exigible. Cualquier uso administrativo debe basarse en actos y antecedentes oficiales de las unidades competentes.

## Cambio metodológico · cinco segmentos y canal TGR (05-11-2026)

El canal de cobro de contribuciones **TGR** no determina por sí solo si se paga o se está exento de **derechos de aseo**. Por eso el dashboard separa siempre **BD4N_RSH (TGR, exención RSH candidata)** de **BD4N_RESTO (TGR sin marca RSH)** y los presenta como dos segmentos exclusivos en los KPI, tabla, gráficos históricos, filtros y CSV.

`BD1 = BD5N + BD9N + BD8N + BD4N_RSH + BD4N_RESTO + residuo`. El `BD4N` total es **solo subtotal** de los dos últimos. En 2025-S1: 3.849 + 8.256 = 12.105 ROL TGR; 55.648 ROL en total, sin contar dos veces. La condición jurídica de **pago de derechos de aseo efectivo** y **exención aprobada** permanece **sin datos**, a falta de actos, acuses de carga y movimientos de TGR. Esta clasificación técnica no prueba ninguno de los dos.

Los cinco segmentos son agregados de tamaño suficiente para el padrón publicable; **no se publica la cartera morosa separada por esas categorías pequeñas**, ni información nominativa. Las series referenciales de 2021-S2 y 2022-S2 no prueban continuidad de beneficios. La partición original 2026-S2 no incorpora todavía la corrección RSH posterior.

## Abrir el dashboard

- Sitio GitHub Pages: `https://germaquintana.github.io/derechosdeaseo_dashboard/` (**despliegue de GitHub Pages confirmado por Actions #42102463302 el 05-11-2026 17:20 Chile; revisión de acceso externo independiente pendiente**).
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
| BD4N_RSH | Canal TGR con **candidatura técnica a exención RSH**; no equivale a exención legal aprobada |\n| BD4N_RESTO | Canal TGR **sin esa marca RSH**; no equivale a derechos de aseo pagados ni descarta otros beneficios |\n| BD4N total (subtotal) | BD4N_RSH + BD4N_RESTO; **no** sumar de nuevo a BD1 |
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
