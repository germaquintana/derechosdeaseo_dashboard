#!/usr/bin/env python3
"""Control de calidad y privacidad para dashboard público de indicadores agregados."""
import json
import re
import unittest
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
HTML = (BASE / "index.html").read_text(encoding="utf-8")
DATA = json.loads((BASE / "data/periodos.json").read_text(encoding="utf-8"))

class DatosPublicos(unittest.TestCase):
    def test_solo_doze_periodos_y_conteos(self):
        rr = DATA["periodos"]
        self.assertEqual(len(rr), 12)
        self.assertEqual(len({p["periodo"] for p in rr}), 12)
        self.assertEqual([p["periodo"] for p in rr],
                         [f"{y}-S{s}" for y in range(2021, 2027) for s in (1, 2)])
        for x in rr:
            self.assertEqual(len(x["grupos"]), 5)
            self.assertLessEqual(abs(sum(x["grupos"].values()) - x["rol_total"]), 1)
            self.assertEqual(x["tgr_subtotal"]["roles"],
                             x["grupos"]["tgr_rsh_candidato_exencion"] +
                             x["grupos"]["tgr_resto_sin_marca_rsh"])
            self.assertIsNone(x["tgr_subtotal"]["pago_derechos_aseo_acreditado"])
            self.assertIsNone(x["tgr_subtotal"]["exencion_juridica_acreditada"])
            self.assertGreaterEqual(min(x["grupos"].values()), 1000)
            self.assertGreaterEqual(x["cartera"]["folios_listados"], 1000)
            self.assertIsInstance(x["cartera"]["saldo_listado_millones_clp"], int)
            self.assertIsInstance(x["alertas"], str)
        s1 = next(x for x in rr if x["periodo"] == "2025-S1")
        self.assertEqual(s1["rol_total"], 55648)
        self.assertEqual(s1["cartera"]["folios_listados"], 16891)
        self.assertEqual(s1["cartera"]["rol_distintos_verificados"], 8465)
        self.assertEqual(s1["cartera"]["saldo_listado_millones_clp"], 282)
        self.assertEqual(s1["grupos"]["tgr_rsh_candidato_exencion"], 3849)
        self.assertEqual(s1["grupos"]["tgr_resto_sin_marca_rsh"], 8256)
        self.assertEqual(s1["tgr_subtotal"]["roles"], 12105)
        self.assertEqual(DATA["esquema"], "dashboard_publico_agregado_v2_canal_tgr_separado")

    def test_sin_campos_personales_ni_folios_individuales(self):
        forbidden = {"rut", "direccion", "domicilio", "nombre", "propietario",
                     "rol", "folio", "vencimiento", "cuenta", "rol_individual",
                     "folio_individual", "nombre_propietario"}
        def walk(obj):
            if isinstance(obj, dict):
                for key, val in obj.items():
                    self.assertNotIn(key.lower(), forbidden, key)
                    walk(val)
            elif isinstance(obj, list):
                for item in obj:
                    walk(item)
        walk(DATA)
        serialized = json.dumps(DATA, ensure_ascii=False).lower()
        for sensitive_path in ["derechosdeaseo_auditoria", "drive.google.com",
                               "github.com/germaquintana/gestionambientaltrabajo"]:
            self.assertNotIn(sensitive_path, serialized)
            self.assertNotIn(sensitive_path, HTML.lower())

    def test_snapshot_integrado_concuerda_con_json_publico(self):
        match = re.search(r'<script type="application/json" id="publicData">([\s\S]*?)</script>', HTML)
        self.assertIsNotNone(match)
        self.assertEqual(json.loads(match.group(1)), DATA)
        self.assertNotIn('<script src=', HTML)
        self.assertNotIn('<iframe', HTML)

class NavegadorPublico(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from playwright.sync_api import sync_playwright
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(headless=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()

    def setUp(self):
        self.page = self.browser.new_page(viewport={"width": 1280, "height": 800})
        self.errors = []
        self.page.on("pageerror", lambda err: self.errors.append(str(err)))
        self.page.goto((BASE / "index.html").as_uri())
        self.page.locator("#tableBody tr").first.wait_for()

    def tearDown(self):
        self.assertFalse(self.errors, f"Errores JS: {self.errors}")
        self.page.close()

    def test_file_local_carga_sin_servidor(self):
        self.assertEqual(self.page.locator("#tableBody tr").count(), 12)
        self.assertEqual(self.page.locator("#k-total").inner_text(), "55.648")
        self.assertEqual(self.page.locator("#k-folios").inner_text(), "16.891")
        self.assertIn("$282 MM", self.page.locator("#k-saldo").inner_text())
        self.assertEqual(self.page.locator("#k-tgr-rsh").inner_text(), "3.849")
        self.assertEqual(self.page.locator("#k-tgr-rest").inner_text(), "8.256")
        self.assertEqual(self.page.locator("#k-tgr-total").inner_text(), "12.105")
        self.assertEqual(self.page.locator("#trend button").count(), 12)

    def test_filtro_y_detalle(self):
        self.page.locator("#year").select_option("2022")
        self.assertEqual(self.page.locator("#tableBody tr").count(), 2)
        self.page.locator('#tableBody tr[data-period="2022-S2"]').click()
        self.assertIn("2022-S2", self.page.locator("#title-detail").inner_text())
        self.assertEqual(self.page.locator("#bars .bar").count(), 5)

    def test_csv_respeta_filtro(self):
        self.page.locator("#year").select_option("2023")
        with self.page.expect_download() as info:
            self.page.locator("#csv").click()
        b = info.value.path().read_bytes()
        csv = b.decode("utf-8-sig")
        self.assertEqual(len(csv.splitlines()), 3)
        self.assertIn("2023-S1", csv)
        self.assertNotIn("2022-S1", csv)
        self.assertNotIn("rut", csv.lower())
        self.assertIn("bd4n_tgr_subtotal", csv)
        self.assertIn("bd4n_rsh_candidato_exencion", csv)
        self.assertIn("bd4n_resto_sin_marca_rsh", csv)

    def test_tgr_composicion_serie_y_residuo(self):
        self.page.locator("#metric").select_option("composicion")
        self.assertEqual(self.page.locator('#trend button[data-period="2025-S1"] .trendSegment').count(), 5)
        self.page.locator("#metric").select_option("tgr")
        self.assertEqual(self.page.locator("#trend button").count(), 12)
        self.assertEqual(self.page.locator('#trend button[data-period="2025-S1"] .trendSegment').count(), 2)
        self.page.locator('#trend button[data-period="2026-S1"]').click()
        self.assertEqual(self.page.locator("#k-tgr-rsh").inner_text(), "3.872")
        self.assertEqual(self.page.locator("#k-tgr-rest").inner_text(), "8.238")

    def test_movil_sin_desbordamiento_de_pagina(self):
        self.page.set_viewport_size({"width": 390, "height": 844})
        self.page.evaluate("window.scrollTo(500,0)")
        self.page.wait_for_timeout(80)
        self.assertLessEqual(self.page.evaluate("window.scrollX"), 1)
        self.assertEqual(self.page.locator("#tableBody tr").count(), 12)
        self.page.locator('#trend button[data-period="2026-S1"]').click()
        self.assertIn("2026-S1", self.page.locator("#title-detail").inner_text())

if __name__ == "__main__":
    unittest.main()
