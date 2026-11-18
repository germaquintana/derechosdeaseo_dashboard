#!/usr/bin/env python3
"""CE06: señales focales 2025-S2/2026 sin confundirlas con cruce técnico masivo."""
import json
import threading
import unittest
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DATA=json.loads((ROOT/"data/morosidad_hallazgos_focales_2025s2_2026_v1.json").read_text("utf-8"))
BASE=json.loads((ROOT/"data/cartera_exenciones_auditoria_v1.json").read_text("utf-8"))
HTML=(ROOT/"v2/index.html").read_text("utf-8")
JS=(ROOT/"v2/assets/deuda_depurada.js").read_text("utf-8")

class CE06Contracts(unittest.TestCase):
    def test_three_focal_sums_and_nonadditive_alerts(self):
        b={p["periodo"]:p for p in BASE["periodos"]}
        rows={p["periodo"]:p for p in DATA["periodos"]}
        self.assertEqual(set(rows),{"2025-S2","2026-S1","2026-S2"})
        for k,p in rows.items():
            self.assertIsNone(b[k]["subconjunto_tecnico_smc"],
                "No reetiquetar señales focales como clasificación BD9N+BD5N")
            self.assertEqual(p["folios_cartera"],p["senal_folios"]+p["resto_sin_clasificar_folios"])
            self.assertEqual(p["saldo_cartera_clp"],p["senal_saldo_clp"]+p["resto_sin_clasificar_clp"])
            self.assertEqual(p["folios_cartera"],b[k]["cartera"]["folios_listados"])
            self.assertEqual(p["saldo_cartera_clp"],b[k]["cartera"]["saldo_listado_clp"])
            self.assertEqual(p["conciliacion_juridico_contable"],"PENDIENTE")
        self.assertEqual((rows["2025-S2"]["senal_folios"],rows["2025-S2"]["senal_saldo_clp"]),(4,68232))
        self.assertEqual((rows["2026-S1"]["senal_folios"],rows["2026-S1"]["senal_saldo_clp"]),(41,707783))
        self.assertEqual((rows["2026-S2"]["senal_folios"],rows["2026-S2"]["senal_saldo_clp"]),(2,35466))
        self.assertEqual(rows["2026-S2"]["alertas_independientes"][0]["saldo_clp"],70932)
        self.assertEqual(rows["2026-S1"]["desglose"][0]["folios"],40)
        self.assertEqual(rows["2026-S1"]["desglose"][1]["folios"],1)
        self.assertEqual(sum(x["folios"] for x in rows["2026-S1"]["desglose"]),41)
    def test_public_no_private_role_or_folio(self):
        for x in DATA["periodos"]:
            self.assertNotIn("rol_individual",x)
            self.assertNotIn("folio_individual",x)
            self.assertNotIn("rut",x)
            self.assertNotIn("direccion",x)
        self.assertIn('id="da-net-focal-summary"',HTML)
        self.assertIn('Hallazgos focales CLP',HTML)
        self.assertIn("da-net-segment-focal",JS)
        self.assertIn("Descuadre en barra",JS)
        self.assertIn("Cuadratura",JS)

class CE06Browser(unittest.TestCase):
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
    def test_focal_segments_reappear_and_not_laundered_into_exemptions(self):
        page=self.browser.new_page(viewport={"width":1440,"height":900},accept_downloads=True)
        errors=[]
        page.on("pageerror",lambda e:errors.append(str(e)))
        page.goto(self.url+"?vista=morosidad")
        page.wait_for_function("window.__dashboardReady===true && window.__daBalanceReady===true")
        self.assertEqual(page.locator("#da-net-bars .da-net-bar-row").count(),12)
        self.assertEqual(page.locator("#da-net-bars .da-net-segment-focal").count(),3)
        self.assertEqual(page.locator("#da-net-focal-summary .da-net-focal-summary-card").count(),3)
        self.assertEqual(page.locator("#da-net-cov-cross").inner_text(),"9/12")
        self.assertEqual(page.locator("#da-net-cov-legal").inner_text(),"0/12")
        for p,count,amount in [("2025-S2","4","$68.232"),("2026-S1","41","$707.783"),("2026-S2","2","$35.466")]:
            page.locator("#da-audit-period").select_option(p)
            self.assertIn(count+" folios",page.locator("#da-net-focal-summary").inner_text())
            self.assertIn(amount,page.locator("#da-net-focal-summary").inner_text())
            self.assertIn(amount,page.locator("#da-net-table").inner_text())
            self.assertIn("S/I",page.locator("#da-net-adjusted").inner_text())
            self.assertIn("S/I",page.locator("#da-net-candidates").inner_text())
            self.assertEqual(page.locator("#da-net-focal-summary .da-net-focal-summary-card").count(),1)
            self.assertEqual(page.locator("#da-net-bars .da-net-segment-focal").count(),1)
        self.assertIn("$70.932",page.locator("#da-net-focal-summary").inner_text())
        self.assertIn("NO sumable",page.locator("#da-net-focal-summary").inner_text())
        page.locator("#da-net-unit").select_option("folios")
        self.assertEqual(page.locator("#da-net-bars .da-net-segment-focal").count(),1)
        page.locator("#da-audit-period").select_option("todos")
        with page.expect_download() as d:page.locator("#da-net-export").click()
        csv=d.value.path().read_text("utf-8-sig")
        self.assertIn('"2025-S2";"16261";"8144";"1";"277162912";"";"68232"',csv)
        self.assertIn('"2026-S1";"26131";"13715";"0";"451083131";"";"707783"',csv)
        self.assertIn('"2026-S2";"11715";"11715";"0";"207707569";"";"35466"',csv)
        self.assertFalse(errors,errors)
        page.close()
    def test_mobile_no_horizontal_overflow(self):
        page=self.browser.new_page(viewport={"width":390,"height":844})
        page.goto(self.url+"?vista=morosidad&anio=2026")
        page.wait_for_function("window.__daBalanceReady===true")
        self.assertEqual(page.locator(".da-net-focal-summary-card").count(),2)
        extent=page.evaluate("() => [document.documentElement.scrollWidth,document.documentElement.clientWidth]")
        self.assertLessEqual(extent[0],extent[1]+2)
        page.close()
if __name__=="__main__":unittest.main()
