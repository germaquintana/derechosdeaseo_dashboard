#!/usr/bin/env python3
"""DA17-CE04 · nueva navegación Morosidad y observación focal agregada 2026."""
import json
import threading
import unittest
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/"v2/index.html").read_text("utf-8")
SCRIPT=(ROOT/"v2/assets/deuda_depurada.js").read_text("utf-8")
APP=(ROOT/"v2/assets/app.js").read_text("utf-8")
DATA=json.loads((ROOT/"data/cartera_exenciones_auditoria_v1.json").read_text("utf-8"))

class MorosidadContrato(unittest.TestCase):
    def test_nav_and_main_priority(self):
        self.assertIn('data-view="cartera"><span class="navico">▥</span> Morosidad',HTML)
        self.assertIn('<h2 id="title-cartera">Morosidad</h2>',HTML)
        self.assertNotIn('> Cartera y saldos</button>',HTML)
        self.assertLess(HTML.index('id="da-net-panel"'),HTML.index('id="folioBars"'))
        self.assertEqual(HTML.count('data-view="'),6)
        self.assertIn('initialView==="morosidad"',APP)
        self.assertIn('id="da-net-focal-content"',HTML)
        self.assertIn("drawFocus2026",SCRIPT)
    def test_focal_data_has_no_fake_legal_discharge(self):
        s1=next(r for r in DATA["periodos"] if r["periodo"]=="2026-S1")
        focal=s1["alertas_focales_independientes"][0]
        self.assertEqual(focal["roles"],1765)
        self.assertEqual(focal["combinaciones_esperadas"],3530)
        self.assertEqual(focal["cuotas_presentes_en_morosos"],2526)
        self.assertEqual(focal["cuotas_ausentes_de_morosos"],1004)
        self.assertEqual(focal["saldo_reajuste_multa_pendiente_clp"],44213485)
        self.assertEqual(focal["combinaciones_esperadas"],focal["cuotas_presentes_en_morosos"]+focal["cuotas_ausentes_de_morosos"])
        self.assertIsNone(s1["descarga_smc_acreditada"]["monto_clp"])
        self.assertIsNone(s1["subconjunto_tecnico_smc"])
        self.assertIn("NO es una deducción del saldo general",SCRIPT)

class MorosidadNavegador(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from playwright.sync_api import sync_playwright
        cls.server=ThreadingHTTPServer(("127.0.0.1",0),partial(SimpleHTTPRequestHandler,directory=str(ROOT)))
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True)
        cls.thread.start()
        cls.pw=sync_playwright().start()
        cls.browser=cls.pw.chromium.launch(headless=True)
        cls.url=f"http://127.0.0.1:{cls.server.server_port}/v2/"
    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()
        cls.server.shutdown()
        cls.server.server_close()
    def test_direct_link_2026_and_filter(self):
        page=self.browser.new_page(viewport={"width":1300,"height":860})
        errors=[]
        page.on("pageerror",lambda e:errors.append(str(e)))
        page.goto(self.url+"?vista=morosidad&anio=2026")
        page.wait_for_function("window.__dashboardReady===true && window.__daBalanceReady===true && window.__daExencionesReady===true")
        self.assertTrue(page.locator("#view-cartera").evaluate("(e)=>e.classList.contains('active')"))
        self.assertIn("Morosidad",page.locator('[data-view="cartera"]').inner_text())
        self.assertEqual(page.locator("#da-audit-year").input_value(),"2026")
        self.assertEqual(page.locator("#da-net-table tr").count(),2)
        self.assertEqual(page.locator("#da-net-gross").inner_text(),"$658.790.700")
        self.assertIn("S/I",page.locator("#da-net-adjusted").inner_text())
        focal=page.locator("#da-net-focal-content")
        self.assertEqual(focal.locator(".da-net-focal-card").count(),2)
        for value in ("1.765","2.526","1.004","3.530","$44.213.485","2.832","18.842"):
            self.assertIn(value,focal.inner_text())
        self.assertIn("NO es una deducción",focal.inner_text())
        page.locator("#da-audit-period").select_option("2026-S2")
        self.assertEqual(focal.locator(".da-net-focal-card").count(),1)
        self.assertNotIn("2.526",focal.inner_text())
        self.assertIn("2.832",focal.inner_text())
        page.locator("#da-audit-year").select_option("2025")
        page.locator("#da-audit-period").select_option("todos")
        self.assertIn("Selecciona el año 2026",focal.inner_text())
        self.assertFalse(errors,str(errors))
        page.close()
    def test_mobile_focal_and_history(self):
        page=self.browser.new_page(viewport={"width":390,"height":844})
        page.goto(self.url+"?vista=morosidad&anio=2026")
        page.wait_for_function("window.__daBalanceReady===true")
        self.assertEqual(page.locator(".da-net-focal-card").count(),2)
        self.assertEqual(page.locator("#folioBars").count(),1)
        width=page.evaluate("() => [document.documentElement.scrollWidth,document.documentElement.clientWidth]")
        self.assertLessEqual(width[0],width[1]+2)
        page.close()

if __name__=="__main__":unittest.main()
