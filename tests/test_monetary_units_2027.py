#!/usr/bin/env python3
"""Regresión monetaria: convención expresa 1 MM$ = 1.000.000.000 CLP."""
from pathlib import Path
import json, unittest, threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

BASE = Path(__file__).resolve().parents[1]
JS = (BASE / "v2/assets/app.js").read_text(encoding="utf-8")
HTML = (BASE / "v2/index.html").read_text(encoding="utf-8")
DATA = json.loads((BASE / "data/periodos.json").read_text(encoding="utf-8"))

class CurrencySource(unittest.TestCase):
    def test_original_data_stays_in_millions(self):
        self.assertEqual(len(DATA["periodos"]),12)
        self.assertEqual(sum(p["cartera"]["saldo_listado_millones_clp"] for p in DATA["periodos"]),2833)
        self.assertAlmostEqual(sum(p["cartera"]["saldo_listado_millones_clp"] for p in DATA["periodos"])/1000,2.833)
        self.assertEqual(DATA["periodos"][-1]["cartera"]["saldo_listado_millones_clp"],208)
    def test_ui_uses_billion_unit(self):
        self.assertIn("const moneyMM = millions =>", JS)
        self.assertIn("format(millions/1000)",JS)
        self.assertIn("saldo_listado_MM_CLP_mil_millones_aprox",JS)
        self.assertIn("mil millones de pesos",HTML)
        self.assertEqual(HTML.count('data-view="'),6)

class CurrencyBrowser(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from playwright.sync_api import sync_playwright
        cls.http=ThreadingHTTPServer(("127.0.0.1",0),partial(SimpleHTTPRequestHandler,directory=str(BASE)))
        cls.thread=threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()
        cls.pw=sync_playwright().start()
        cls.browser=cls.pw.chromium.launch(headless=True)
        cls.url=f"http://127.0.0.1:{cls.http.server_port}/v2/"
    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()
        cls.http.shutdown(); cls.http.server_close()
    def test_millions_are_presented_as_thousands_of_millions(self):
        page=self.browser.new_page(viewport={"width":1365,"height":900},accept_downloads=True)
        errs=[]
        page.on("pageerror",lambda exc:errs.append(str(exc)))
        page.goto(self.url)
        page.locator(".ce39-archive > summary").click()
        page.locator("#kSaldo").wait_for()
        self.assertIn("0,208 MM$",page.locator("#kSaldo").inner_text())
        page.locator('[data-view="cartera"]').click()
        self.assertIn("2,833 MM$",page.locator("#totalSaldos").inner_text())
        self.assertIn("0,208",page.locator("#carteraTable").inner_text())
        self.assertIn("0,451 MM$",page.locator("#saldoBars").locator("rect[aria-label*='2026-S1']").get_attribute("aria-label"))
        page.locator('[data-view="calidad"]').click()
        self.assertIn("0,208",page.locator("#fullTable").inner_text())
        with page.expect_download() as download:
            page.locator("#downloadCsv").click()
        content=download.value.path().read_text(encoding="utf-8-sig")
        self.assertIn("saldo_listado_millones_CLP_fuente",content)
        self.assertIn("saldo_listado_MM_CLP_mil_millones_aprox",content)
        self.assertIn("0.208",content)
        self.assertFalse(errs, str(errs))
        page.close()
