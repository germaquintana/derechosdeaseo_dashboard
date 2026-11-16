#!/usr/bin/env python3
"""CE05: consolidación auditada de ROL prediales distintos y estados de conciliación."""
import json
import threading
import unittest
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DATA=json.loads((ROOT/"data/morosidad_cobertura_12_periodos_v1.json").read_text("utf-8"))
AUDIT=json.loads((ROOT/"data/cartera_exenciones_auditoria_v1.json").read_text("utf-8"))
HTML=(ROOT/"v2/index.html").read_text("utf-8")
JS=(ROOT/"v2/assets/deuda_depurada.js").read_text("utf-8")

class CoverageContracts(unittest.TestCase):
    def test_12_periods_and_consistent_source(self):
        d=DATA
        self.assertEqual(len(d["periodos"]),12)
        self.assertEqual(d["resumen"]["semestres_roles_completos"],11)
        self.assertEqual(d["resumen"]["semestres_roles_parciales"],1)
        self.assertEqual(d["resumen"]["semestres_cruce_tecnico"],9)
        self.assertEqual(d["resumen"]["semestres_cruce_referencial"],2)
        self.assertEqual(d["resumen"]["semestres_con_cierre_juridico_contable"],0)
        self.assertIsNone(d["resumen"]["rol_unicos_global"])
        self.assertEqual(sum(p["cartera"]["folios"] for p in d["periodos"]),190838)
        self.assertEqual(sum(p["cartera"]["saldo_listado_clp"] for p in d["periodos"]),2832929422)
        source={p["periodo"]:p for p in AUDIT["periodos"]}
        for p in d["periodos"]:
            original=source[p["periodo"]]
            self.assertEqual(p["cartera"]["folios"],original["cartera"]["folios_listados"])
            self.assertEqual(p["cartera"]["saldo_listado_clp"],original["cartera"]["saldo_listado_clp"])
            self.assertEqual(p["revision"]["coincidencias_tecnicas_saldo_clp"],
                original["subconjunto_tecnico_smc"]["saldo_listado_clp"] if original["subconjunto_tecnico_smc"] else None)
            self.assertIsNone(p["revision"]["saldo_depurado_proforma_clp"])
            self.assertIsNone(p["revision"]["saldo_post_smc_clp"])
            self.assertEqual(p["revision"]["cierre_juridico_contable"],"NO_ACREDITADO")
    def test_known_role_distinct_counts_and_exceptions(self):
        expected=[6590,6647,10453,9251,6486,6538,6880,7048,8465,8144,13715,11715]
        self.assertEqual([p["cartera"]["roles_prediales_identificados"] for p in DATA["periodos"]],expected)
        p={r["periodo"]:r for r in DATA["periodos"]}
        self.assertEqual(p["2025-S2"]["cartera"]["claves_sin_rol"],1)
        self.assertEqual(p["2025-S2"]["cartera"]["claves_distintas_fuente"],8145)
        self.assertEqual(p["2022-S1"]["control"]["folios_repetidos_clave_rol_vencimiento"],524)
        self.assertEqual(p["2022-S1"]["control"]["grupos_repetidos_clave_rol_vencimiento"],262)
        self.assertEqual(p["2024-S1"]["revision"]["folios_sin_cruce_residual"],2)
        self.assertEqual(p["2024-S1"]["revision"]["saldo_sin_cruce_residual_clp"],32010)
        self.assertEqual(p["2024-S2"]["revision"]["folios_sin_cruce_residual"],2)
        self.assertEqual(p["2024-S2"]["revision"]["saldo_sin_cruce_residual_clp"],32654)
        self.assertIsNone(p["2026-S1"]["revision"]["folios_sin_cruce_residual"])
    def test_no_identifiers_public(self):
        dump=json.dumps(DATA,ensure_ascii=False).lower()
        for forbidden in ('rut_propietario','nombre_propietario','direccion_predial','folio_individual','rol_normalizado'):
            self.assertNotIn(forbidden,dump)
        self.assertIn('id="da-net-gaps"',HTML)
        self.assertIn('id="da-net-cov-roles"',HTML)
        self.assertIn('morosidad_cobertura_12_periodos_v1.json',JS)

class BrowserCoverage(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from playwright.sync_api import sync_playwright
        cls.server=ThreadingHTTPServer(("127.0.0.1",0),partial(SimpleHTTPRequestHandler,directory=str(ROOT)))
        cls.t=threading.Thread(target=cls.server.serve_forever,daemon=True)
        cls.t.start()
        cls.pw=sync_playwright().start()
        cls.browser=cls.pw.chromium.launch(headless=True)
        cls.url="http://127.0.0.1:"+str(cls.server.server_port)+"/v2/"
    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.pw.stop();cls.server.shutdown();cls.server.server_close()
    def test_full_coverage_and_period_filter(self):
        page=self.browser.new_page(viewport={"width":1340,"height":900},accept_downloads=True)
        errors=[]
        page.on("pageerror",lambda e:errors.append(str(e)))
        page.goto(self.url+"?vista=morosidad")
        page.wait_for_function("window.__dashboardReady===true && window.__daBalanceReady===true")
        self.assertEqual(page.locator("#da-net-cov-cartera").inner_text(),"12/12")
        self.assertEqual(page.locator("#da-net-cov-roles").inner_text(),"11/12")
        self.assertEqual(page.locator("#da-net-cov-cross").inner_text(),"9/12")
        self.assertEqual(page.locator("#da-net-cov-legal").inner_text(),"0/12")
        self.assertEqual(page.locator("#da-net-roles").inner_text(),"Ver por semestre")
        self.assertEqual(page.locator("#da-net-gaps tr").count(),12)
        page.locator("#da-audit-period").select_option("2025-S2")
        self.assertEqual(page.locator("#da-net-roles").inner_text(),"8.144 + pendiente")
        self.assertIn("clave sin ROL",page.locator("#da-net-gaps").inner_text())
        self.assertEqual(page.locator("#da-net-cov-roles").inner_text(),"0/1")
        self.assertEqual(page.locator("#da-net-cov-cross").inner_text(),"0/1")
        self.assertIn("S/I",page.locator("#da-net-adjusted").inner_text())
        page.locator("#da-audit-period").select_option("2026-S1")
        self.assertEqual(page.locator("#da-net-roles").inner_text(),"13.715")
        self.assertEqual(page.locator("#da-net-cov-roles").inner_text(),"1/1")
        self.assertEqual(page.locator("#da-net-cov-legal").inner_text(),"0/1")
        page.locator("#da-audit-period").select_option("2024-S1")
        self.assertIn("$32.010",page.locator("#da-net-table").inner_text())
        self.assertIn("2 folio(s) sin grupo",page.locator("#da-net-gaps").inner_text())
        page.locator("#da-audit-period").select_option("todos")
        page.locator("#da-audit-year").select_option("2026")
        self.assertEqual(page.locator("#da-net-roles").inner_text(),"Ver por semestre")
        self.assertEqual(page.locator("#da-net-gaps tr").count(),2)
        with page.expect_download() as d:page.locator("#da-net-export").click()
        csv=d.value.path().read_text("utf-8-sig")
        self.assertIn('"2026-S1";"26131";"13715";"0";"451083131"',csv)
        self.assertIn('"2026-S2";"11715";"11715";"0";"207707569"',csv)
        self.assertFalse(errors,str(errors))
        page.close()
    def test_mobile_no_width_overflow(self):
        page=self.browser.new_page(viewport={"width":390,"height":844})
        page.goto(self.url+"?vista=morosidad&anio=2026")
        page.wait_for_function("window.__daBalanceReady===true")
        width=page.evaluate("() => [document.documentElement.scrollWidth,document.documentElement.clientWidth]")
        self.assertLessEqual(width[0],width[1]+2)
        self.assertEqual(page.locator("#da-net-gaps tr").count(),2)
        page.close()
if __name__=="__main__":unittest.main()
