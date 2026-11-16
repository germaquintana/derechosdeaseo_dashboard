#!/usr/bin/env python3
"""DA17 · QA de cruce agregado y no-regresión de Cartera V2."""
import json
import threading
import unittest
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

BASE=Path(__file__).resolve().parents[1]
DATA=json.loads((BASE/"data/cartera_exenciones_auditoria_v1.json").read_text("utf-8"))
ORIGINAL=json.loads((BASE/"data/periodos.json").read_text("utf-8"))
HTML=(BASE/"v2/index.html").read_text("utf-8")
APP=(BASE/"v2/assets/app.js").read_text("utf-8")
JS=(BASE/"v2/assets/cartera_exenciones.js").read_text("utf-8")

class DataRules(unittest.TestCase):
    def test_sources_and_no_fake_discharge(self):
        rows=DATA["periodos"]
        self.assertEqual(len(rows),12)
        self.assertEqual(sum(r["cartera"]["folios_listados"] for r in rows),190838)
        self.assertEqual(sum(r["cartera"]["saldo_listado_clp"] for r in rows),2832929422)
        self.assertEqual([r["periodo"] for r in rows],[r["periodo"] for r in ORIGINAL["periodos"]])
        self.assertEqual(sum(r["subconjunto_tecnico_smc"] is None for r in rows),3)
        self.assertEqual(DATA["resumen"]["periodos_con_clasificacion_referencial"],2)
        for r in rows:
            self.assertIsNone(r["descarga_smc_acreditada"]["monto_clp"])
            self.assertIsNone(r["descarga_smc_acreditada"]["folios"])
            x=r["subconjunto_tecnico_smc"]
            if x is not None:
                b=r["grupos"]["rsh_municipal_bd9n"]
                a=r["grupos"]["avalúo_todos_destinos_bd5n"]
                self.assertEqual(x["folios_suma_sin_solapamiento_grupos"],b["folios"]+a["folios"])
                self.assertEqual(x["saldo_listado_clp"],b["saldo_listado_clp"]+a["saldo_listado_clp"])
        r=next(x for x in rows if x["periodo"]=="2025-S1")
        self.assertEqual(r["subconjunto_tecnico_smc"]["folios_suma_sin_solapamiento_grupos"],8253)
        self.assertEqual(r["subconjunto_tecnico_smc"]["saldo_listado_clp"],137734317)
        self.assertEqual(r["fuente_clasificacion"],"RECRUCE_CORREGIDO_2025S1")
        a=next(x for x in rows if x["periodo"]=="2026-S1")["alertas_focales_independientes"][0]
        self.assertEqual(a["roles"],1765)
        self.assertEqual(a["cuotas_presentes_en_morosos"],2526)
        self.assertEqual(a["cuotas_ausentes_de_morosos"],1004)
        self.assertEqual(a["saldo_reajuste_multa_pendiente_clp"],44213485)
        self.assertEqual(a["cuotas_presentes_en_morosos"]+a["cuotas_ausentes_de_morosos"],a["combinaciones_esperadas"])
    def test_privacy_and_unchanged_modules(self):
        text=json.dumps(DATA,ensure_ascii=False).lower()
        for forbidden in ("rut_propietario","nombre_propietario","direccion_predial","rol_normalizado","folio_individual","1n5t-5kodqvrghelvavk7y"):
            self.assertNotIn(forbidden,text)
        self.assertEqual(HTML.count('data-view="'),6)
        self.assertIn('id="view-cartera"',HTML)
        self.assertIn('id="da-audit-roles"',HTML)
        self.assertIn('href="propuesta-2027/"',HTML)
        self.assertIn('id="carteraTable"',HTML)
        self.assertIn("const moneyMM = millions =>",APP)
        self.assertIn("window.__daExencionesReady=true",JS)

class BrowserUI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from playwright.sync_api import sync_playwright
        cls.server=ThreadingHTTPServer(("127.0.0.1",0),partial(SimpleHTTPRequestHandler,directory=str(BASE)))
        cls.t=threading.Thread(target=cls.server.serve_forever,daemon=True)
        cls.t.start()
        cls.pw=sync_playwright().start()
        cls.browser=cls.pw.chromium.launch(headless=True)
        cls.url="http://127.0.0.1:"+str(cls.server.server_port)+"/v2/"
    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.pw.stop();cls.server.shutdown();cls.server.server_close()
    def test_filter_2025_corrigendum_and_export(self):
        page=self.browser.new_page(viewport={"width":1366,"height":800},accept_downloads=True)
        errors=[]
        page.on("pageerror",lambda exc:errors.append(str(exc)))
        page.goto(self.url)
        page.wait_for_function("window.__dashboardReady === true && window.__daExencionesReady === true")
        page.locator('[data-view="cartera"]').click()
        self.assertEqual(page.locator("#da-audit-table tr").count(),12)
        self.assertEqual(page.locator("#da-audit-coverage").inner_text(),"9 / 12")
        self.assertEqual(page.locator("#da-audit-confirmed").inner_text(),"Sin determinar")
        page.locator("#da-audit-year").select_option("2025")
        page.locator("#da-audit-state").select_option("recalculada")
        self.assertEqual(page.locator("#da-audit-table tr").count(),1)
        self.assertIn("2025-S1",page.locator("#da-audit-table").inner_text())
        self.assertIn("8.253",page.locator("#da-audit-table").inner_text())
        self.assertIn("0,138 MM$",page.locator("#da-audit-balance").inner_text())
        with page.expect_download() as d:page.locator("#da-audit-export").click()
        csv=d.value.path().read_text("utf-8-sig")
        self.assertIn("2025-S1",csv);self.assertNotIn("2025-S2",csv)
        self.assertIn("137734317",csv)
        page.locator("#da-audit-state").select_option("todos")
        page.locator("#da-audit-year").select_option("2026")
        self.assertEqual(page.locator("#da-audit-table tr").count(),2)
        self.assertIn("2.526",page.locator("#da-audit-alerts").inner_text())
        self.assertIn("44.213.485",page.locator("#da-audit-alerts").inner_text())
        self.assertEqual(page.locator("#da-audit-coverage").inner_text(),"0 / 2")
        self.assertFalse(errors,str(errors))
        page.close()
    def test_mobile_no_document_overflow(self):
        page=self.browser.new_page(viewport={"width":390,"height":844})
        page.goto(self.url)
        page.wait_for_function("window.__daExencionesReady === true")
        page.locator('[data-view="cartera"]').click()
        width=page.evaluate("() => [document.documentElement.scrollWidth,document.documentElement.clientWidth]")
        self.assertLessEqual(width[0],width[1]+2)
        self.assertEqual(page.locator("#da-audit-table tr").count(),12)
        page.close()
