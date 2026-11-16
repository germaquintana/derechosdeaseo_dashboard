# Propuesta municipal 2027 · módulo independiente de Derechos de Aseo

**Estado:** propuesta técnica no aprobada. **URL bajo GitHub Pages:** `/derechosdeaseo_dashboard/v2/propuesta-2027/` una vez desplegada en `main`.

## Alcance
Es un anexo autónomo de la [V2](../) y no modifica el contenido de sus seis módulos. El único cambio en `v2/index.html` es un enlace en la navegación, y `v2/assets/app.js`, `v2/assets/style.css` y `data/periodos.json` permanecen intactos.

Expone diagnóstico agregado (DASHBOARD12 y dataset público V2, corte 05-11-2026), distinción de exención legal automática por 225 UTM vs eventual beneficio municipal socioeconómico sujeto a ordenanza, recorrido presencial/web propuesto, gobierno de datos, hoja de ruta 2027 y decisiones preparatorias de Alcaldía.

**No es un portal ciudadano funcional**, no recibe datos personales ni consulta deudas individuales, y no acredita aprobación de autoridad. Las metas de la implementación y sus costos quedan por validar.

## QA
`python -m unittest discover -s tests -p 'test_*.py' -v` desde raíz (requiere Playwright + Chromium), incluyendo pruebas de no alteración de módulos, navegación, cambio de perspectivas y desbordamiento móvil.

## Fuentes
- [DL 3.063, art. 7, Biblioteca del Congreso Nacional](https://www.bcn.cl/leychile/Navegar?idNorma=18967&idVersion=2026-11-01).
- [Datos agregados](../../data/periodos.json) y [observatorio V2](../).
- DASHBOARD12 / DASHBOARD13 en repositorio especializado, documentos privados no publicados aquí.

**Control editorial siguiente:** revisión de texto y legalidad local, evitar presentar decisiones propuestas como adoptadas. No hay datos nominativos.
