# Observatorio de Derechos de Aseo · versión pública V2

**Ruta propuesta de GitHub Pages:** https://germaquintana.github.io/derechosdeaseo_dashboard/v2/

Dashboard exploratorio con seis módulos visuales, filtros, tablas, gráficos SVG, esquemas y exportación de indicadores agregados de 12 semestres (2021–2026). No constituye información tributaria individual, exención aprobada, pago verificado ni deuda exigible certificada.

## Origen y alcance
- Usa **exclusivamente** el dataset público canónico [../data/periodos.json](../data/periodos.json) (fecha de corte indicada dentro del archivo), sin copiar ni duplicar series.
- Preserva la página original [../index.html](../index.html) y sus enlaces.
- Cinco grupos excluyentes: BD5N, BD9N, BD8N, BD4N_RSH y BD4N_RESTO. BD4N es subtotal TGR, **no** un sexto grupo. Puede existir residuo de padrón.
- Folios-período son registros que pueden repetirse entre cortes; saldos históricos se muestran redondeados, no como deuda certificada.
- Los datos 2025-S1 y 2026-S2 tienen salvedades metodológicas que el dashboard explicita. Los semestres de referencia no son mediciones propias de cada S2.
- No contiene nombres, RUT, contactos, direcciones, roles individuales ni cartera nominativa. No expone enlaces directos a fichas restringidas como si fueran accesibles al público.

## Publicación y control
Este directorio se incorpora a la rama `main` una vez revisada la propuesta. GitHub Pages debe publicar desde `main` / `(root)` para servir la ruta `/v2/`. El dominio público permite acceso sin cuenta GitHub. Si Pages utiliza otro origen o workflow, confirmar su configuración antes de compartir.

**Estado editorial:** versión técnica exploratoria; no sustituye el informe institucional ni acredita cierres jurídico-contables. Validación de publicación referida a los indicadores agregados existentes; revisiones futuras deben volver a controlar privacidad y consistencia.

**Procedencia:** PR #1 de implementación visual y rama separada de publicación `pages-v2-public-20261110` que preserva la portada anterior.
## Convención de montos · actualización 16-11-2026

Por instrucción expresa del responsable, **1 MM$ = 1.000.000.000 pesos chilenos** en los productos de Derechos de Aseo. La visualización convierte a MM$ únicamente al presentar las cifras: la serie fuente `saldo_listado_millones_clp` sigue expresada en **millones de pesos** y no se modifica para evitar pérdida de trazabilidad o alteración de cálculos. Ejemplos: 208 millones se presenta como **0,208 MM$**; la suma de doce cortes públicos redondeados (2.833 millones) se presenta como **2,833 MM$**. El consolidado privado exacto es $2.832.929.422, cuyo redondeo a tres decimales en MM$ también resulta 2,833. **La suma no es deuda exigible ni recaudación acreditada**.

El CSV incorpora dos columnas: `saldo_listado_millones_CLP_fuente` (magnitud íntegra del JSON público, sin transformación) y `saldo_listado_MM_CLP_mil_millones_aprox` (la conversión a MM$). Las etiquetas y gráficos muestran MM$ con tres decimales y coma decimal conforme al formato de Chile.
