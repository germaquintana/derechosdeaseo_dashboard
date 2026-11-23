"""QA de la ruta alternativa de Morosidad apilada. Sin modificar /v2/.

Prueba cuadraturas públicas, navegación, selector de unidad, filtros,
respuesta ante fuente adulterada, accesibilidad básica y ancho móvil.
"""
import json
import threading
import unittest
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = "/propuestas/morosidad-apilada-20261123/"
SOURCE = ROOT / "propuestas" / "morosidad-apilada-20261123" / "datos.json"


class MorosidadApiladaData(unittest.TestCase):
    def test_12_semestres_y_cuadraturas_disjuntas(self):
        src = json.loads(SOURCE.read_text("utf-8"))
        self.assertEqual(src["esquema"], "da17_morosidad_apilada_propuesta_v1")
        self.assertEqual(len(src["periodos"]), 12)
        self.assertEqual(sum(row["folios"] for row in src["periodos"]), 190838)
        self.assertEqual(sum(row["saldo_clp"] for row in src["periodos"]), 2832929422)
        for row in src["periodos"]:
            with self.subTest(period=row["periodo"]):
                self.assertEqual(
                    row["no_segmentado"]["folios"]
                    + (row["municipal"]["folios"] or 0)
                    + (row["legal"]["folios"] or 0),
                    row["folios"],
                )
                self.assertEqual(
                    row["no_segmentado"]["saldo_clp"]
                    + (row["municipal"]["saldo_clp"] or 0)
                    + (row["legal"]["saldo_clp"] or 0),
                    row["saldo_clp"],
                )
                self.assertIsNone(row["beneficio_aplicado"]["folios"])
                self.assertIsNone(row["beneficio_aplicado"]["saldo_clp"])

        focus = next(row for row in src["periodos"] if row["periodo"] == "2026-S2")
        self.assertEqual(focus["municipal"]["folios"], 1053)
        self.assertEqual(focus["municipal"]["saldo_clp"], 18655586)
        self.assertEqual(focus["legal"]["folios"], 0)
        expected = {"2025-S2": (3226, 55029108, 0), "2026-S1": (2362, 40775206, 0)}
        for period, (n, saldo, legal) in expected.items():
            row = next(x for x in src["periodos"] if x["periodo"] == period)
            self.assertEqual(row["municipal"]["folios"], n)
            self.assertEqual(row["municipal"]["saldo_clp"], saldo)
            self.assertEqual(row["legal"]["folios"], legal)
        self.assertEqual(src["resumen"]["semestres_con_indicio_municipal_y_filtro_legal_tecnicos"], 12)
        self.assertEqual(src["resumen"]["cierres_juridico_contables"], 0)

    def test_no_publica_identificadores_individuales(self):
        src = SOURCE.read_text("utf-8")
        for word in ('"rut"', '"nombre"', '"domicilio"', '"rol_predial"', '"folio_obligacion"'):
            self.assertNotIn(word, src)
        site = (ROOT / "propuestas" / "morosidad-apilada-20261123" / "index.html").read_text("utf-8")
        self.assertIn('../../v2/?vista=morosidad', site)
        self.assertTrue((ROOT / "v2" / "index.html").exists())


class MorosidadApiladaBrowser(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(
            ("127.0.0.1", 0), partial(SimpleHTTPRequestHandler, directory=str(ROOT))
        )
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(headless=True)
        cls.url = "http://127.0.0.1:" + str(cls.server.server_port) + URL

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def open_page(self, width=1440):
        page = self.browser.new_page(viewport={"width": width, "height": 900})
        page.goto(self.url)
        page.wait_for_function(
            "() => document.querySelector('#data-status')?.textContent.includes('de 12 semestres')",
            timeout=15000,
        )
        return page

    def test_barras_apiladas_y_detalle_2026(self):
        page = self.open_page()
        self.addCleanup(page.close)
        self.assertEqual(page.locator(".chart-row").count(), 12)
        self.assertIn("190.838", page.locator("#k-folios").inner_text())
        self.assertEqual(page.locator("#k-revision").inner_text(), "12 / 12")
        self.assertEqual(page.locator("#k-depurado").inner_text(), "S/I")
        self.assertEqual(page.locator("#detail-title").inner_text(),
                         "2026-S2 · detalle de revisión")
        self.assertEqual(page.locator("#d-mun").inner_text(), "1.053")
        self.assertEqual(page.locator("#d-legal").inner_text(), "0")
        self.assertEqual(page.locator("#d-other").inner_text(), "10.662")
        self.assertIn("Res. 941", page.locator("#detail-note").inner_text())
        self.assertEqual(page.locator(".chart-row.active").count(), 1)
        self.assertTrue(page.locator(".chart-row.active").get_attribute("data-periodo") == "2026-S2")

        page.locator(".chart-row[data-periodo='2023-S1']").click()
        self.assertEqual(page.locator("#d-mun").inner_text(), "5.473")
        self.assertEqual(page.locator("#d-legal").inner_text(), "6")
        self.assertEqual(page.locator("#d-other").inner_text(), "7.459")

    def test_monto_y_filtros(self):
        page = self.open_page()
        self.addCleanup(page.close)
        page.locator("#unit-monto").click()
        self.assertEqual(page.locator("#unit-monto").get_attribute("aria-pressed"), "true")
        self.assertEqual(page.locator("#d-mun").inner_text(), "$18.655.586")
        self.assertEqual(page.locator("#d-legal").inner_text(), "$0")
        self.assertEqual(page.locator("#d-total").inner_text(), "$207.707.569")
        page.locator("#year-filter").select_option("pendientes")
        self.assertEqual(page.locator(".chart-row").count(), 0)
        self.assertIn("No hay semestres", page.locator("#chart").inner_text())
        page.locator("#year-filter").select_option("2026")
        self.assertEqual(page.locator(".chart-row").count(), 2)
        page.locator("#unit-folios").click()
        self.assertEqual(page.locator("#unit-folios").get_attribute("aria-pressed"), "true")

    def test_fuente_adulterada_bloquea_presentacion(self):
        altered = json.loads(SOURCE.read_text("utf-8"))
        altered["periodos"][11]["municipal"]["folios"] += 1
        page = self.browser.new_page(viewport={"width": 1280, "height": 900})
        self.addCleanup(page.close)
        page.route("**/propuestas/morosidad-apilada-20261123/datos.json",
                   lambda route: route.fulfill(
                       status=200, content_type="application/json",
                       body=json.dumps(altered, ensure_ascii=False),
                   ))
        page.goto(self.url)
        page.wait_for_function(
            "() => document.querySelector('#data-status')?.textContent.includes('falló validación')",
            timeout=15000,
        )
        self.assertEqual(page.locator(".chart-row").count(), 0)
        self.assertEqual(page.locator("#k-folios").inner_text(), "S/I")

    def test_movil_sin_overflow(self):
        for width in (390, 320):
            with self.subTest(width=width):
                page = self.open_page(width=width)
                try:
                    total, viewport = page.evaluate(
                        "() => [document.documentElement.scrollWidth, "
                        "document.documentElement.clientWidth]"
                    )
                    self.assertLessEqual(total, viewport + 2)
                    self.assertEqual(page.locator(".chart-row").count(), 12)
                    page.locator("#unit-monto").click()
                    total, viewport = page.evaluate(
                        "() => [document.documentElement.scrollWidth, "
                        "document.documentElement.clientWidth]"
                    )
                    self.assertLessEqual(total, viewport + 2)
                finally:
                    page.close()


if __name__ == "__main__":
    unittest.main()
