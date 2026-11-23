#!/usr/bin/env python3
"""QA: nueva sección independiente 2027 sin alterar los seis módulos V2."""
import unittest
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
V2 = (BASE / "v2" / "index.html").read_text(encoding="utf-8")
PAGE = (BASE / "v2" / "propuesta-2027" / "index.html").read_text(encoding="utf-8")

class IntegridadV2(unittest.TestCase):
    def test_seis_modulos_intactos_y_solo_un_enlace_nuevo(self):
        for k in ("resumen", "evolucion", "clasificacion", "cartera", "calidad", "metodologia"):
            self.assertIn(f'data-view="{k}"', V2)
            self.assertIn(f'id="view-{k}"', V2)
        self.assertEqual(V2.count('data-view="'), 6)
        self.assertEqual(V2.count('href="propuesta-2027/"'), 2)
        self.assertIn('id="ce39-go-2027"', V2)
        self.assertIn('href="../"', PAGE)

    def test_sin_datos_personales_ni_acceso_simulado(self):
        self.assertNotIn("<iframe", PAGE.lower())
        self.assertNotIn("<form", PAGE.lower())
        self.assertNotIn("<script src=", PAGE.lower())
        self.assertNotIn("https://drive.google.com", PAGE)
        self.assertIn("BORRADOR TÉCNICO · NO APROBADO", PAGE)
        self.assertIn("no depende de una solicitud", PAGE)
        self.assertIn("190.838", PAGE)
        self.assertIn("0 / 12", PAGE)

class ComportamientoNavegador(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from playwright.sync_api import sync_playwright
        cls.pw=sync_playwright().start()
        cls.browser=cls.pw.chromium.launch(headless=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()

    def test_vistas_y_perspectivas(self):
        page=self.browser.new_page(viewport={"width":1366,"height":850})
        errors=[]
        page.on("pageerror",lambda exc: errors.append(str(exc)))
        page.set_content(PAGE)
        self.assertEqual(page.locator("main section.section").count(),6)
        self.assertEqual(page.locator("[data-perspective]").count(),3)
        page.locator('[data-perspective="municipio"]').click()
        self.assertIn("expediente trazable",page.locator("#perspective-heading").inner_text())
        page.locator('[data-perspective="control"]').click()
        self.assertEqual(page.locator('[data-perspective="control"]').get_attribute("aria-pressed"),"true")
        self.assertIn("calidad del dato",page.locator("#perspective-heading").inner_text())
        self.assertFalse(errors)
        page.close()

    def test_movil_sin_desbordamiento(self):
        page=self.browser.new_page(viewport={"width":390,"height":844})
        page.set_content(PAGE)
        dims=page.evaluate("() => [document.documentElement.scrollWidth,document.documentElement.clientWidth]")
        self.assertLessEqual(dims[0],dims[1]+2)
        self.assertIn("Propuesta 2027",page.title())
        page.close()
