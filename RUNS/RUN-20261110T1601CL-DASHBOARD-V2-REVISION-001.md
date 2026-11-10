# RUN-20261110T1601CL-DASHBOARD-V2-REVISION-001

- **Fecha / hora Chile:** 2026-11-10 16:01 CLST (UTC−03:00; hora de verificación de entorno).
- **Área / tarea:** DIMAO · Gestión Ambiental / Derechos de Aseo · GA-T-2026-0017 (sin crear tarea nueva).
- **Tipo:** desarrollo manual especializado en rama de revisión; **no es ciclo horario, no consume rotación**.
- **Responsable de revisión y aprobación:** encargado de Gestión Ambiental.
- **Estado:** producto de revisión implementado, QA local satisfactorio, **sin desplegar ni fusionar**.

## Fuentes y control de versiones

- Repositorio público `germaquintana/derechosdeaseo_dashboard`, rama original `main`.
- Dataset `data/periodos.json` SHA `1a8587607d01adaf44ffab9a2a42b4d72e1f48f5`; **intacto** en la rama nueva.
- Metodología privada: `germaquintana/derechosdeaseo_auditoria` (`AGENTS.md`, `estado_proyecto.json`, seguimiento y edición ciudadana).
- Institucional: `germaquintana/Gestionambientaltrabajo_recoleta` (`AGENTS.md`, `estado_sistema.json`, GA-T-2026-0017, protocolo de cascadas).
- `run_lock` ajeno activo al inicio: `RUN-20261110-MANUAL-SCCID-U3B4-CONTROL-DERIVADOS-001`. **No se escribió el repositorio institucional**.

## Cambios

1. `index.html`: interfaz modular de seis secciones, controles globales, indicadores visuales, tablas, flujos metodológicos y estados de calidad.
2. `assets/style.css`: diseño ejecutivo responsivo, navegación lateral/escritorio y horizontal/móvil, tipografía, tarjetas y tablas.
3. `assets/app.js`: lectura de datos públicos existentes; gráficos SVG de líneas, barras y composición, tabla ordenable, comparación condicionada, navegación y exportación de agregados.
4. **Dataset no editado**: cinco categorías mutuamente exclusivas BD5N, BD9N, BD8N, BD4N_RSH y BD4N_RESTO más residuo. TGR subtotal no aditivo.
5. Sin consulta a microdatos privados, sin cambios de permisos y sin declaraciones tributarias.

## Pruebas efectivamente ejecutadas

- Chromium headless real mediante Playwright, inyección del mismo HTML/CSS/JS de trabajo y fixture local de valores agregados de los doce semestres (la navegación `http://127.0.0.1` está bloqueada por el entorno, por lo que **no** se verificó el hosting remoto de esta rama).
- Seis KPI, navegación de seis módulos, doce barras semestrales, filtro 2025 con dos registros, comparación bloqueada en períodos provisionales, tabla de cinco categorías, doce celdas de calidad y alerta BD9N 18.708/18.842.
- Tabla ordenada por folios: primero 2026-S1. Folios acumulados = **190.838**; suma de saldos redondeados = **≈ $2.833 MM**. Los $2.832.929.422 exactos proceden de auditoría privada y no se recomputan desde el dataset público redondeado.
- Método: cinco fuentes y cinco etapas.
- Chromium de escritorio 1512 px y móvil 390 px: sin errores JavaScript y sin desborde horizontal del documento.
- Controles sobre JSON original de GitHub: 12 semestres, mismo blob en `main`/rama, subtotal TGR conciliado en 12/12; residuo 1 ROL en 2021-S1 y 2021-S2 como referencia.
- **Limitación:** aún no se ha sometido al navegador contra GitHub Pages de una rama publicada ni a auditoría manual integral de accesibilidad y privacidad contextual. CI remoto por verificar.

## Riesgos y bloqueos

- No declarar comparables resultados de 2021-S2, 2022-S2, 2025-S1, 2025-S2 ni 2026-S2 cuando su calidad no lo permite.
- No confundir `Saldo` listado con deuda exigible, pago o cobro indebido.
- Informes maestros y decisión jurídico-contable siguen pendientes: **0/12 cierres**.
- El `run_lock` institucional ajeno impidió conciliación en GitHub canónico y Trello en este RUN; reanudar bajo lock propio cuando esté libre.
- Revisión editorial y de privacidad humana antes de fusionar/publicar.

## Resultado y próxima unidad

**Resultado:** implementación del observatorio V2 en rama de revisión, sin modificar el sitio actual. Documentación y evidencia de capturas disponibles en la conversación de trabajo.

**Siguiente acción exacta:** revisar interfaz y nomenclatura con responsable, validar versión de datos y riesgos contextuales, comprobar CI e inspección visual conectada a entorno de despliegue, reconciliar GA-T-2026-0017 cuando el lock esté libre y obtener aprobación expresa antes de merge/publicación.

## Verificación complementaria de entrega local

- Se generó también una **vista HTML autónoma** con CSS/JS incrustados y los doce agregados de prueba, útil para revisión del diseño sin servidor; el archivo se entrega como adjunto de conversación, **no** se incorpora al repositorio público ni sustituye `data/periodos.json`.
- Chromium/Playwright ejecutó la vista autónoma: carga de los doce semestres, sin errores JS.
- Exportación CSV verificada: 13 líneas (cabecera + doce períodos), 13 columnas; tras filtrar 2025, 3 líneas (cabecera + dos períodos).
- La variante publicada en la rama sigue leyendo el JSON original intacto. No se desplegó esta rama.
