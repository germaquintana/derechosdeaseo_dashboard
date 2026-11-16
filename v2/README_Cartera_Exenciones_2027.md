# Cartera y saldos · auditoría de cuotas potencialmente exentas (V1)

Nueva subsección interna al **módulo 04 · Cartera y saldos** del observatorio `/v2/`. Los seis módulos, datos históricos originales, gráficos de cartera y propuesta 2027 conservan su estructura y cálculo. Para el componente se agregan `v2/assets/cartera_exenciones.js`, `v2/assets/cartera_exenciones.css` y `data/cartera_exenciones_auditoria_v1.json`; en `v2/index.html` solo se inserta el bloque HTML y las dos referencias a assets.

## Alcance de los datos

- **12 semestres** 2021-S1 a 2026-S2; corte de cartera 28-10-2026.
- **9 períodos** cuentan con grupos técnicos por folio, de los cuales **dos** usan la clasificación de S1 solo como referencia S2 y **2025-S1** usa la reconstrucción corregida de 55.648 ROL.
- **3 períodos** (2025-S2, 2026-S1, 2026-S2) no tienen clasificación por folio adecuada en el agregado histórico disponible: mostrar `S/I`, no cero.
- **BD9N** = coincidencia RSH candidata, *no prueba* exención municipal aprobada; **BD5N** = avalúo ≤225 UTM todos los destinos, *no prueba* vivienda exenta. **BD4N_RSH** es canal TGR y se muestra por separado para no atribuir bajas a SMC.
- El **subtotal técnico municipal** suma grupos excluyentes BD9N + BD5N en el mismo semestre; **no** es importe apto de descarga. No agregar montos de cohortes focales, que pueden solaparse. La suma de cortes semestrales no es deuda única a una fecha.
- **2026-S1** incorpora una cohorte focal previa de 1.765 roles a eximir, 2.526 combinaciones rol-cuota aún en morosos y $44.213.485 de saldo/reajuste/multa; 1.004 combinaciones ausentes requieren conciliación de pagos/giros, no suponen pagos.
- **Descargas acreditadas:** sin determinar (`null` en JSON), no se declara cero ni se autoriza acción alguna.

## Seguridad y calidad

Datos agregados sin nombres, RUT, ROL identificables, direcciones, folios individuales o enlaces a fuentes nominativas privadas. Las pruebas `tests/test_cartera_exenciones_v1.py` comprueban cuadraturas, clasificación 2025-S1 corregida, focal 2026-S1, no-regresión de módulos, filtros, exportación CSV, Chrome escritorio y móvil.

**Convención monetaria del proyecto:** 1 MM$ = 1.000.000.000 CLP. Los datos fuente preservan montos enteros en CLP; la interfaz muestra tres decimales de MM$.

**Puertas para una descarga real:** respaldo legal individual y vigencia específica, estado del folio/cuota y movimientos, competencia municipal/SMC, autorización formal, bitácora y conciliación posterior. Esta sección no es un formulario de bajas ni emite archivos operativos para SMC.

**Fuentes de trazabilidad restringida (no se publican):** `germaquintana/derechosdeaseo_auditoria/datos_agregados/da13_cartera_exenciones_12_periodos_20261116.json`, reconstrucción DA12 2025-S1, lote focal 2026-S1 y GA-T-2026-0017. Los originales se mantienen en Drive bajo permisos institucionales.

**Estado:** diagnóstico agregado parcial; 0/12 cierres jurídico-contables acreditados. Esperar lectura y validación humana antes de usar cifras en procedimientos administrativos.
