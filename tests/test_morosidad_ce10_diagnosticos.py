"""CE10: controles agregados reales, no reclasificación técnica/legal de la morosidad."""
import json
import threading
import unittest
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/"data/morosidad_diagnosticos_origen_ce10_v1.json"

class EvidenceMath(unittest.TestCase):
    def test_three_evidence_partitions_match_same_cutoff(self):
        j=json.loads(SOURCE.read_text("utf8"))
        self.assertEqual(j["corte"],"2026-10-28")
        self.assertEqual(j["schema"],"DA17-CE10-DIAGNOSTICOS_ORIGEN_V1")
        self.assertTrue(j["segmentos_separados_de_ce08"])
        self.assertEqual([r["periodo"] for r in j["periodos"]],["2025-S2","2026-S1","2026-S2"])
        self.assertEqual(sum(p["folios_cartera"] for p in j["periodos"]),54107)
        self.assertEqual(sum(p["saldo_cartera_clp"] for p in j["periodos"]),935953612)
        for p in j["periodos"]:
            self.assertEqual(sum(x["folios"] for x in p["segmentos"]),p["folios_cartera"])
            self.assertEqual(sum(x["saldo_clp"] for x in p["segmentos"]),p["saldo_cartera_clp"])
    def test_2025_tariffs_actual_and_not_exemptions(self):
        p=json.loads(SOURCE.read_text("utf8"))["periodos"][0]
        self.assertEqual([(x["folios"],x["saldo_clp"]) for x in p["segmentos"]],
                         [(16248,277158384),(12,4428),(1,100)])
        self.assertEqual(p["excepciones"][0]["folios"],4)
        self.assertIn("NO se suman"," ".join(p["notas"]))
    def test_2026_s1_all_quotas_not_only_june(self):
        p=json.loads(SOURCE.read_text("utf8"))["periodos"][1]
        self.assertEqual([(x["folios"],x["saldo_clp"]) for x in p["segmentos"]],
                         [(12539,216453066),(13592,234630065)])
        self.assertEqual(sum(x["folios"] for x in p["excepciones"]),41)
    def test_2026_s2_bd8n_is_only_list_membership(self):
        p=json.loads(SOURCE.read_text("utf8"))["periodos"][2]
        self.assertEqual([(x["folios"],x["saldo_clp"]) for x in p["segmentos"]],
                         [(11704,207512506),(11,195063)])
        self.assertIn("no acredita"," ".join(p["notas"]))
        self.assertEqual([(x["folios"],x["saldo_clp"]) for x in p["excepciones"]],
                         [(2,35466),(4,70932)])
    def test_no_individual_identifiers_or_ce08_approved_result(self):
        s=SOURCE.read_text("utf8").lower()
        for x in ('"rut"', '"rol"', '"folio"', '"direccion"', '"nombre_vecino"',
                  '"publicacion_autorizada": true'):
            self.assertNotIn(x,s)
        self.assertFalse((ROOT/"data/morosidad_clasificacion_ce08_aprobada_v1.json").exists())

class Browser(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from playwright.sync_api import sync_playwright
        cls.srv=ThreadingHTTPServer(("127.0.0.1",0),partial(SimpleHTTPRequestHandler,directory=str(ROOT)))
        cls.thread=threading.Thread(target=cls.srv.serve_forever,daemon=True);cls.thread.start()
        cls.play=sync_playwright().start()
        cls.browser=cls.play.chromium.launch(headless=True)
        cls.url=f"http://127.0.0.1:{cls.srv.server_port}/v2/?vista=morosidad"
    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.play.stop();cls.srv.shutdown();cls.srv.server_close()
    def test_cards_with_real_aggregate_and_no_changed_ce06_bars(self):
        p=self.browser.new_page(viewport={"width":1280,"height":900})
        p.goto(self.url)
        p.wait_for_function("window.__daBalanceReady===true && window.__daCE10Ready===true")
        self.assertEqual(p.locator("#da-net-ce10-cards article").count(),3)
        self.assertIn("2025-S2",p.locator("#da-net-ce10-cards").inner_text())
        self.assertIn("207.512.506",p.locator("#da-net-ce10-cards").inner_text())
        self.assertIn("0/3",p.locator("#da-net-ce10-status").inner_text())
        self.assertEqual(p.locator("#da-net-bars .da-net-segment-focal").count(),3)
        self.assertEqual(p.evaluate("window.__daCE08PeriodosCargados"),0)
        self.assertEqual(p.locator("#da-net-cov-legal").inner_text(),"0/12")
        p.close()
    def test_filtered_cards_follow_year_and_period(self):
        p=self.browser.new_page();p.goto(self.url)
        p.wait_for_function("window.__daCE10Ready===true && window.__daBalanceReady===true")
        p.locator("#da-audit-year").select_option("2026")
        self.assertEqual(p.locator("#da-net-ce10-cards article").count(),2)
        p.locator("#da-audit-period").select_option("2026-S2")
        self.assertEqual(p.locator("#da-net-ce10-cards article").count(),1)
        self.assertIn("11 folios",p.locator("#da-net-ce10-cards").inner_text())
        p.close()
    def test_malformed_evidence_rejected_without_mutating_original_chart(self):
        p=self.browser.new_page()
        j=json.loads(SOURCE.read_text("utf8"))
        j["periodos"][2]["segmentos"][1]["saldo_clp"]+=1
        p.route("**/data/morosidad_diagnosticos_origen_ce10_v1.json",
                lambda route:route.fulfill(status=200,content_type="application/json",body=json.dumps(j)))
        p.goto(self.url)
        p.wait_for_function("window.__daCE10Ready===false && window.__daBalanceReady===true")
        self.assertIn("inconsistentes",p.locator("#da-net-ce10-status").inner_text())
        self.assertEqual(p.locator("#da-net-ce10-cards article").count(),0)
        self.assertEqual(p.locator("#da-net-bars .da-net-segment-focal").count(),3)
        p.close()
    def test_mobile_without_horizontal_overflow(self):
        p=self.browser.new_page(viewport={"width":390,"height":844})
        p.goto(self.url)
        p.wait_for_function("window.__daCE10Ready===true")
        self.assertEqual(p.locator("#da-net-ce10-cards article").count(),3)
        a,b=p.evaluate("() => [document.documentElement.scrollWidth,document.documentElement.clientWidth]")
        self.assertLessEqual(a,b+2)
        p.close()

if __name__=="__main__":unittest.main()
