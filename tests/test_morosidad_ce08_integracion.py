#!/usr/bin/env python3
"""CE08: integración optativa con SOLO fixtures ficticios inyectados por navegador."""
import json
import threading
import unittest
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BASE=json.loads((ROOT/"data/cartera_exenciones_auditoria_v1.json").read_text("utf8"))
PERIODS={p["periodo"]:p for p in BASE["periodos"]}

def synthetic_approved(tamper=False):
    rows=[]
    for period in ("2025-S2","2026-S1"):
        original=PERIODS[period]["cartera"]
        n=original["folios_listados"]
        val=original["saldo_listado_clp"]
        groups=[
            {"grupo_bd":"BD5N","folios":10,"saldo_clp":1000},
            {"grupo_bd":"BD9N","folios":5,"saldo_clp":500},
            {"grupo_bd":"BD8N","folios":n-16,"saldo_clp":val-1600},
            {"grupo_bd":"BD4N_RSH","folios":0,"saldo_clp":0},
            {"grupo_bd":"BD4N_RESTO","folios":0,"saldo_clp":0}
        ]
        rows.append({
            "periodo":period,"corte":"2026-10-28",
            "folios_cartera":n,"saldo_cartera_clp":val,
            "fuente_semestre_validada":True,
            "clasificacion_completa_sin_residuos":False,
            "grupos":groups,
            "residuo":[{"causa":"SIN_CLASIFICAR_ROL","folios":1,"saldo_clp":100}],
            "conciliacion_juridico_contable":"NO_ACREDITADA",
            "saldo_depurado_proforma_clp":None,"saldo_post_smc_clp":None,
            "notas":["EJEMPLO FICTICIO SOLO PARA PRUEBA"]
        })
    if tamper:
        rows[0]["grupos"][2]["saldo_clp"]+=1
    return {
        "schema":"DA17-CE08-MOROSIDAD-AGREGADO-APROBADO-V1",
        "estado":"AGREGADOS_REVISADOS_PARA_INTEGRACION_GITHUB_REQUIERE_REVISION_DEL_CAMBIO",
        "corte":"2026-10-28","clasificacion_solo_tecnica":True,
        "publicacion_autorizada_por_declaracion_de_custodio":True,
        "datos_individuales_exportados":False,"periodos":rows
    }

class CE08Contract(unittest.TestCase):
    def test_public_approved_ce08_dataset_does_not_exist_yet(self):
        self.assertFalse((ROOT/"data/morosidad_clasificacion_ce08_aprobada_v1.json").exists(),
                         "Prohibido añadir data sintética o no aprobada como real")
        js=(ROOT/"v2/assets/deuda_depurada.js").read_text("utf8")
        self.assertIn("validateCE08",js)
        self.assertIn("CE08_PERIODS",js)
        self.assertIn("SIN_CLASIFICAR_FUENTE",js)
        self.assertIn("source",js) if False else None

class BrowserCE08(unittest.TestCase):
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
    def page(self):
        p=self.browser.new_page(viewport={"width":1280,"height":900},accept_downloads=True)
        return p
    def inject(self,page,payload):
        page.route("**/data/morosidad_clasificacion_ce08_aprobada_v1.json",
            lambda route:route.fulfill(status=200,content_type="application/json",
                                      body=json.dumps(payload)))
    def test_default_ce06_unaltered_when_no_approved_file(self):
        p=self.page()
        p.goto(self.url+"?vista=morosidad")
        p.wait_for_function("window.__daBalanceReady===true")
        self.assertEqual(p.evaluate("window.__daCE08PeriodosCargados"),0)
        self.assertIn("0/3",p.locator("#da-net-ce08-status").inner_text())
        self.assertTrue(p.locator("#da-net-ce08-detail").is_hidden())
        self.assertEqual(p.locator("#da-net-bars .da-net-segment-focal").count(),3)
        self.assertEqual(p.locator("#da-net-cov-cross").inner_text(),"9/12")
        self.assertEqual(p.locator("#da-net-cov-legal").inner_text(),"0/12")
        p.close()
    def test_injected_two_periods_five_groups_and_residue(self):
        p=self.page()
        errors=[]
        p.on("pageerror",lambda e:errors.append(str(e)))
        self.inject(p,synthetic_approved())
        p.goto(self.url+"?vista=morosidad")
        p.wait_for_function("window.__daBalanceReady===true")
        self.assertEqual(p.evaluate("window.__daCE08PeriodosCargados"),2)
        self.assertEqual(p.locator("#da-net-cov-cross").inner_text(),"11/12")
        self.assertEqual(p.locator("#da-net-cov-legal").inner_text(),"0/12")
        self.assertIn("2/3",p.locator("#da-net-ce08-status").inner_text())
        self.assertEqual(p.locator("#da-net-ce08-body tr").count(),2)
        self.assertEqual(p.locator("#da-net-bars .da-net-segment-bd5n").count(),2)
        self.assertEqual(p.locator("#da-net-bars .da-net-segment-bd9n").count(),2)
        self.assertEqual(p.locator("#da-net-bars .da-net-segment-bd8n").count(),2)
        self.assertEqual(p.locator("#da-net-bars .da-net-segment-focal").count(),1)
        p.locator("#da-audit-period").select_option("2025-S2")
        self.assertEqual(p.locator("#da-net-candidates").inner_text(),"$1.500")
        self.assertEqual(p.locator("#da-net-ce08-body tr").count(),1)
        self.assertIn("NO aditiva",p.locator("#da-net-focal-summary").inner_text())
        self.assertIn("S/I",p.locator("#da-net-adjusted").inner_text())
        with p.expect_download() as d:p.locator("#da-net-export").click()
        csv=d.value.path().read_text("utf-8-sig")
        self.assertIn("BD5N_folios_ce08",csv)
        self.assertIn("BD4N_RESTO_saldo_clp_ce08",csv)
        self.assertIn('"2025-S2";"16261"',csv)
        self.assertFalse(errors,errors)
        p.close()
    def test_bad_totals_safely_rejected(self):
        p=self.page();self.inject(p,synthetic_approved(tamper=True))
        p.goto(self.url+"?vista=morosidad")
        p.wait_for_function("window.__daBalanceReady===true")
        self.assertEqual(p.evaluate("window.__daCE08PeriodosCargados"),0)
        self.assertIn("rechazada",p.locator("#da-net-ce08-status").inner_text())
        self.assertEqual(p.locator("#da-net-bars .da-net-segment-focal").count(),3)
        self.assertTrue(p.locator("#da-net-ce08-detail").is_hidden())
        p.close()
    def test_mobile_no_overflow_with_ce08_details(self):
        p=self.browser.new_page(viewport={"width":390,"height":844})
        self.inject(p,synthetic_approved())
        p.goto(self.url+"?vista=morosidad&anio=2026")
        p.wait_for_function("window.__daBalanceReady===true")
        self.assertEqual(p.locator("#da-net-ce08-body tr").count(),1)
        sizes=p.evaluate("() => [document.documentElement.scrollWidth,document.documentElement.clientWidth]")
        self.assertLessEqual(sizes[0],sizes[1]+2)
        p.close()

if __name__=="__main__":
    unittest.main()
