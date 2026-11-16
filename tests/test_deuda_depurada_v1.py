#!/usr/bin/env python3
"""CE03: QA de comparación deuda registrada vs deuda corregida, sin completar nulos."""
import json
import threading
import unittest
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DATA=json.loads((ROOT/"data/cartera_exenciones_auditoria_v1.json").read_text("utf-8"))
HTML=(ROOT/"v2/index.html").read_text("utf-8")
JS=(ROOT/"v2/assets/deuda_depurada.js").read_text("utf-8")

class CE03Contracts(unittest.TestCase):
    def test_preserve_gross_and_unknown_2026(self):
        rows=DATA["periodos"]
        self.assertEqual(sum(r["cartera"]["saldo_listado_clp"] for r in rows),2832929422)
        self.assertEqual(sum(r["cartera"]["folios_listados"] for r in rows),190838)
        s1=next(r for r in rows if r["periodo"]=="2026-S1")
        s2=next(r for r in rows if r["periodo"]=="2026-S2")
        self.assertEqual(s1["cartera"]["saldo_listado_clp"],451083131)
        self.assertEqual(s2["cartera"]["saldo_listado_clp"],207707569)
        self.assertEqual(sum(r["cartera"]["saldo_listado_clp"] for r in (s1,s2)),658790700)
        self.assertIsNone(s1["subconjunto_tecnico_smc"])
        self.assertIsNone(s2["subconjunto_tecnico_smc"])
        for r in rows:
            self.assertIsNone(r["descarga_smc_acreditada"]["monto_clp"])
    def test_ui_never_infers_verified_corrections(self):
        for token in ('id="da-net-gross"','id="da-net-candidates"',
                      'id="da-net-correct"','id="da-net-adjusted"',
                      'id="da-net-table"','id="da-net-bars"',
                      'id="da-net-roles"',
                      'id="da-net-unit"','id="da-net-export"'):
            self.assertIn(token,HTML)
        self.assertIn("assets/deuda_depurada.js",HTML)
        self.assertIn("assets/deuda_depurada.css",HTML)
        self.assertIn("r.conciliacion_juridico_contable_completa === true",JS)
        self.assertIn("rows.some(r=>r.candidato !== null)",JS)
        self.assertEqual(HTML.count('data-view="'),6)
        self.assertIn("No equivale a «sin señal de exención»",HTML)
        self.assertIn("No se han acreditado por cuota",JS)
        self.assertIn("S/I · no calculable todavía",JS)

class CE03Browser(unittest.TestCase):
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
        cls.browser.close();cls.pw.stop();cls.server.shutdown();cls.server.server_close()
    def test_morosity_kpis_and_filter(self):
        page=self.browser.new_page(viewport={"width":1366,"height":900},accept_downloads=True)
        errors=[]
        page.on("pageerror",lambda e:errors.append(str(e)))
        page.goto(self.url)
        page.wait_for_function("window.__dashboardReady === true && window.__daBalanceReady === true")
        page.locator('[data-view="cartera"]').click()
        self.assertEqual(page.locator("#da-net-gross").inner_text(),"$2.832.929.422")
        self.assertEqual(page.locator("#da-net-table tr").count(),12)
        self.assertEqual(page.locator("#da-net-roles").inner_text(),"S/I")
        self.assertIn("S/I",page.locator("#da-net-adjusted").inner_text())
        self.assertIn("S/I",page.locator("#da-net-correct").inner_text())
        page.locator("#da-audit-year").select_option("2026")
        self.assertEqual(page.locator("#da-net-table tr").count(),2)
        self.assertEqual(page.locator("#da-net-gross").inner_text(),"$658.790.700")
        self.assertEqual(page.locator("#da-net-candidates").inner_text(),"S/I")
        self.assertIn("$451.083.131",page.locator("#da-net-table").inner_text())
        self.assertIn("$207.707.569",page.locator("#da-net-table").inner_text())
        self.assertIn("0/2 semestres",page.locator("#da-net-scope").inner_text())
        page.locator("#da-net-unit").select_option("folios")
        self.assertEqual(page.locator("#da-net-bars .da-net-bar-row").count(),2)
        with page.expect_download() as d:page.locator("#da-net-export").click()
        csv=d.value.path().read_text("utf-8-sig")
        self.assertIn("451083131",csv)
        self.assertIn("207707569",csv)
        self.assertIn('"2026-S1"',csv)
        self.assertIn('"";"";"SIN_CRUCE_ROL_SEMESTRE"',csv)
        self.assertFalse(errors,errors)
        page.close()
    def test_mobile_has_no_overflow(self):
        page=self.browser.new_page(viewport={"width":390,"height":844})
        page.goto(self.url)
        page.wait_for_function("window.__daBalanceReady === true")
        page.locator('[data-view="cartera"]').click()
        w=page.evaluate("() => [document.documentElement.scrollWidth,document.documentElement.clientWidth]")
        self.assertLessEqual(w[0],w[1]+2)
        self.assertEqual(page.locator("#da-net-table tr").count(),12)
        page.close()

if __name__=="__main__":
    unittest.main()
