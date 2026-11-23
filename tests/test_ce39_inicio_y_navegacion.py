"""CE39 — principal v2 con barra lateral y secciones en orden autorizado."""
import json
import threading
import unittest
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT/"propuestas/morosidad-apilada-20261123/datos.json").read_text("utf-8"))
HTML = (ROOT/"v2/index.html").read_text("utf-8")

class CE39Source(unittest.TestCase):
    def test_sidebar_seis_vistas_y_propuesta_2027(self):
        self.assertEqual(HTML.count('data-view="'),6)
        for key in ("resumen","evolucion","clasificacion","cartera","calidad","metodologia"):
            self.assertIn('id="view-'+key+'"',HTML)
        self.assertIn('href="propuesta-2027/"',HTML)
        self.assertIn('id="sideNav"',HTML)
        self.assertIn('id="ce39-morosidad"',HTML)

    def test_orden_portada_antes_de_archivo_historico(self):
        self.assertLess(HTML.index('id="ce39-title-long"'),HTML.index('id="ce39-title-kpis"'))
        self.assertLess(HTML.index('id="ce39-title-kpis"'),HTML.index('id="ce39-title-2027"'))
        self.assertLess(HTML.index('id="ce39-title-2027"'),HTML.index('id="overviewStack"'))
        self.assertIn('id="ce39-go-2027"',HTML)
        self.assertTrue((ROOT/"archivo/portada-original-previa-ce39-20261123.html").exists())

    def test_indicadores_y_privacidad(self):
        self.assertEqual(len(DATA["periodos"]),12)
        self.assertEqual(sum(x["folios"] for x in DATA["periodos"]),190838)
        self.assertEqual(sum(x["saldo_clp"] for x in DATA["periodos"]),2832929422)
        a=sum(x[k]["folios"] for x in DATA["periodos"] for k in ("municipal","legal"))
        m=sum(x[k]["saldo_clp"] for x in DATA["periodos"] for k in ("municipal","legal"))
        self.assertEqual((a,m),(54616,800943295))
        self.assertEqual(DATA["resumen"]["cierres_juridico_contables"],0)
        self.assertTrue(all(x["beneficio_aplicado"]["folios"] is None for x in DATA["periodos"]))
        self.assertIn('id="ce39-k-correct">S/I',HTML)
        self.assertIn('id="ce39-k-correct-clp">S/I',HTML)
        self.assertIn('Cuotas históricas revisadas sin exención',HTML)

class CE39Browser(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=ThreadingHTTPServer(("127.0.0.1",0),partial(SimpleHTTPRequestHandler,directory=str(ROOT)))
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True)
        cls.thread.start()
        cls.pw=sync_playwright().start()
        cls.browser=cls.pw.chromium.launch(headless=True)
        cls.base="http://127.0.0.1:"+str(cls.server.server_port)+"/"

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def open_page(self,width=1440,root=False):
        page=self.browser.new_page(viewport={"width":width,"height":900})
        page.goto(self.base if root else self.base+"v2/")
        page.wait_for_function("() => window.__dashboardReady===true && window.__ce39Ready===true",timeout=16000)
        return page

    def test_portada_redirige_y_serie_longitudinal(self):
        p=self.open_page(root=True)
        self.addCleanup(p.close)
        self.assertIn("/v2/",p.url)
        self.assertEqual(p.locator("#ce39-series .ce39-row").count(),12)
        self.assertEqual(p.locator("#ce39-k-folios").inner_text(),"190.838")
        self.assertEqual(p.locator("#ce39-k-saldo").inner_text(),"$2.832.929.422")
        self.assertEqual(p.locator("#ce39-k-review").inner_text(),"54.616")
        self.assertEqual(p.locator("#ce39-k-review-clp").inner_text(),"$800.943.295")
        self.assertEqual(p.locator("#ce39-k-correct").inner_text(),"S/I")
        self.assertEqual(p.locator("#ce39-k-correct-clp").inner_text(),"S/I")
        legends=p.locator("#ce39-series-legend").inner_text()
        self.assertIn("Exención legal por avalúo ≤225 UTM (BD5N)",legends)
        self.assertIn("Exención por política municipal RSH (BD9N)",legends)
        self.assertNotIn("Posible",legends)
        p.locator("#ce39-metric").select_option("folios_listados")
        self.assertEqual(p.locator("#ce39-series .ce39-row").count(),12)
        p.locator("#ce39-series button[data-period='2025-S2']").click()
        self.assertEqual(p.locator("#period").input_value(),"2025-S2")

    def test_sidebar_morosidad_con_barras_sin_perder_pestanas(self):
        p=self.open_page()
        self.addCleanup(p.close)
        nav=p.locator("#sideNav button[data-view]")
        self.assertEqual(nav.count(),6)
        nav.filter(has_text="Morosidad").click()
        self.assertTrue(p.locator("#view-cartera").is_visible())
        self.assertEqual(p.locator("#ce39-moro-rows .ce39-row").count(),12)
        labels=p.locator("#ce39-moro-legend").inner_text()
        self.assertIn("Cuotas históricas revisadas sin exención",labels)
        self.assertEqual(p.locator("#ce39-moro-total").inner_text(),"11.715")
        self.assertEqual(p.locator("#ce39-moro-mun").inner_text(),"1.053")
        p.locator("#ce39-moro-clp").click()
        self.assertEqual(p.locator("#ce39-moro-total").inner_text(),"$207.707.569")
        p.locator("#ce39-moro-rows button[data-period='2025-S2']").click()
        self.assertEqual(p.locator("#ce39-moro-mun").inner_text(),"$55.029.108")
        for sec in ("Evolución histórica","Clasificación y exenciones","Calidad y auditoría","Metodología","Resumen ejecutivo"):
            nav.filter(has_text=sec).click()
            self.assertTrue(p.locator(".view.active").is_visible())

    def test_ruta_2027_y_movil(self):
        for width in (390,320):
            with self.subTest(width=width):
                p=self.open_page(width)
                try:
                    full,visible=p.evaluate("() => [document.documentElement.scrollWidth,document.documentElement.clientWidth]")
                    self.assertLessEqual(full,visible+2)
                    self.assertTrue(p.locator("#ce39-go-2027").is_visible())
                    self.assertEqual(p.locator("#ce39-series .ce39-row").count(),12)
                    p.locator("#sideNav button[data-view='cartera']").click()
                    full,visible=p.evaluate("() => [document.documentElement.scrollWidth,document.documentElement.clientWidth]")
                    self.assertLessEqual(full,visible+2)
                finally:
                    p.close()

if __name__=="__main__":
    unittest.main()
