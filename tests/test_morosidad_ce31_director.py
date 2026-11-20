"""CE33: QA de navegador real del bloque ejecutivo CE31 sin publicar la rama.

Las métricas son sumas de carteras públicas históricas, no deuda exigible,
personas únicas ni descuentos jurídicos acreditados.
"""
import json
import threading
import unittest
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL_PATH = "/v2/?vista=morosidad"
SOURCE = ROOT / "data" / "morosidad_cobertura_12_periodos_v1.json"


class DirectorCE31Browser(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(
            ("127.0.0.1", 0),
            partial(SimpleHTTPRequestHandler, directory=str(ROOT)),
        )
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(headless=True)
        cls.url = f"http://127.0.0.1:{cls.server.server_port}{URL_PATH}"

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def open_page(self, width=1440, height=900):
        page = self.browser.new_page(viewport={"width": width, "height": height})
        page.goto(self.url)
        page.wait_for_function(
            "() => document.querySelector('#ce31-director-panel')?.dataset.ce31Status === 'ready'",
            timeout=15000,
        )
        return page

    def test_desktop_indicadores_barra_y_tabla_doce_semestres(self):
        page = self.open_page()
        self.addCleanup(page.close)
        self.assertEqual(page.locator("#ce31-bars .ce31-bar-row").count(), 12)
        self.assertEqual(page.get_by_role("list", name="Gráfico de saldos históricos listados por semestre, no deuda exigible").count(), 1)
        self.assertEqual(page.locator("#ce31-bars [role=listitem]").count(), 12)
        self.assertEqual(page.locator("#ce31-table tr").count(), 12)
        self.assertEqual(page.locator("#ce31-visible").inner_text(), "12 de 12 semestres")
        self.assertEqual(page.locator("#ce31-folios").inner_text(), "190.838")
        self.assertIn("2.832,9", page.locator("#ce31-saldo").inner_text())
        self.assertEqual(page.locator("#ce31-sii").inner_text(), "9 / 12")
        self.assertEqual(page.locator("#ce31-corregido").inner_text(), "S/I")
        self.assertIn("no deuda exigible", page.locator("#ce31-message").inner_text())
        page.locator("#ce31-director-panel summary").click()
        self.assertTrue(page.locator("#ce31-table").is_visible())
        self.assertIn("2026-S2", page.locator("#ce31-table").inner_text())
        self.assertEqual(page.locator("#ce31-table tr.ce31-source-pending").count(), 0)
        self.assertEqual(page.locator("#ce31-table td.ce31-source-pending").count(), 3)

    def test_filtro_fuente_sii_y_reposicion(self):
        page = self.open_page()
        self.addCleanup(page.close)
        filtro = page.locator("#ce31-filter")
        filtro.select_option("propio")
        self.assertEqual(page.locator("#ce31-bars .ce31-bar-row").count(), 9)
        self.assertEqual(page.locator("#ce31-table tr").count(), 9)
        self.assertEqual(page.locator("#ce31-visible").inner_text(), "9 de 12 semestres")
        filtro.select_option("no_acreditado")
        self.assertEqual(page.locator("#ce31-bars .ce31-bar-row").count(), 3)
        self.assertEqual(
            [x.inner_text() for x in page.locator("#ce31-bars .ce31-period").all()],
            ["2021-S2", "2022-S2", "2026-S2"],
        )
        self.assertEqual(page.locator("#ce31-table td.ce31-source-pending").count(), 3)
        self.assertIn("no modifica", page.locator("#ce31-filter-note").inner_text())
        filtro.select_option("todos")
        self.assertEqual(page.locator("#ce31-bars .ce31-bar-row").count(), 12)

    def test_movil_390_y_320_sin_desborde_de_panel(self):
        for width in (390, 320):
            with self.subTest(width=width):
                page = self.open_page(width=width, height=844)
                try:
                    panel = page.locator("#ce31-director-panel")
                    panel.scroll_into_view_if_needed()
                    self.assertEqual(page.locator("#ce31-bars .ce31-bar-row").count(), 12)
                    self.assertEqual(page.locator("#ce31-metrics").count(), 0)  # usa clase, no ID
                    docwidth, viewwidth, right = page.evaluate(
                        """() => {
                            const root = document.documentElement;
                            const r = document.querySelector('#ce31-director-panel').getBoundingClientRect();
                            return [root.scrollWidth, root.clientWidth, r.right];
                        }"""
                    )
                    self.assertLessEqual(docwidth, viewwidth + 2)
                    self.assertLessEqual(right, viewwidth + 2)
                    self.assertTrue(page.locator("#ce31-filter").is_visible())
                    amount_px = float(page.locator(".ce31-amount").first.evaluate("(el) => getComputedStyle(el).fontSize.replace(\'px\', \'\')"))
                    self.assertGreaterEqual(amount_px, 12)
                    self.assertTrue(page.locator("#ce31-metric").count() == 0)
                    page.locator("#ce31-filter").select_option("no_acreditado")
                    self.assertEqual(page.locator("#ce31-bars .ce31-bar-row").count(), 3)
                finally:
                    page.close()

    def test_campos_no_acreditados_son_si_no_cero(self):
        page = self.open_page()
        self.addCleanup(page.close)
        text = page.locator("#ce31-pending").inner_text() if page.locator("#ce31-pending").count() else page.locator(".ce31-pending").inner_text()
        for key in ("Capital", "Reajustes", "Intereses", "Multas", "Cobro correcto", "Monto a corregir", "Deudores únicos"):
            self.assertIn(key, text)
        self.assertEqual(page.locator(".ce31-pending b").count(), 7)
        self.assertTrue(all(x == "S/I" for x in page.locator(".ce31-pending b").all_inner_texts()))
        self.assertIn("0/12", page.locator(".ce31-disclaimer").first.inner_text())

    def test_fuente_adulterada_falla_seguro(self):
        document = json.loads(SOURCE.read_text("utf-8"))
        document["periodos"][0]["cartera"]["saldo_listado_clp"] += 1
        page = self.browser.new_page(viewport={"width": 1280, "height": 900})
        self.addCleanup(page.close)
        page.route(
            "**/data/morosidad_cobertura_12_periodos_v1.json",
            lambda route: route.fulfill(
                status=200, content_type="application/json",
                body=json.dumps(document, ensure_ascii=False),
            ),
        )
        page.goto(self.url)
        page.wait_for_function(
            "() => document.querySelector('#ce31-director-panel')?.dataset.ce31Status === 'error'",
            timeout=15000,
        )
        self.assertEqual(page.locator("#ce31-saldo").inner_text(), "S/I")
        self.assertEqual(page.locator("#ce31-corregido").inner_text(), "S/I")
        self.assertEqual(page.locator("#ce31-bars .ce31-bar-row").count(), 0)
        self.assertIn("no se validó", page.locator("#ce31-message").inner_text())


if __name__ == "__main__":
    unittest.main()
