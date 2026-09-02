import unittest

from main import HIDDEN_TOOL_SLUGS, app


class SeoVisibilityTest(unittest.TestCase):
    def setUp(self):
        app.config.update(TESTING=True)
        self.client = app.test_client()

    def test_hidden_tools_stay_out_of_home_and_sitemap(self):
        home = self.client.get("/").get_data(as_text=True)
        sitemap = self.client.get("/sitemap.xml").get_data(as_text=True)

        for slug in HIDDEN_TOOL_SLUGS:
            with self.subTest(slug=slug):
                self.assertNotIn(f'href="/{slug}"', home)
                self.assertNotIn(f"/{slug}</loc>", sitemap)

        self.assertIn("/business-status</loc>", sitemap)
        self.assertIn("/ocr</loc>", sitemap)

    def test_hidden_routes_keep_noindex_header(self):
        for slug in HIDDEN_TOOL_SLUGS:
            with self.subTest(slug=slug):
                response = self.client.get(f"/{slug}")
                self.assertEqual(response.status_code, 200)
                self.assertEqual(
                    response.headers.get("X-Robots-Tag"), "noindex, follow"
                )

        response = self.client.get("/business-status")
        self.assertNotIn("noindex", response.headers.get("X-Robots-Tag", ""))

    def test_high_maintenance_calculators_are_not_indexable(self):
        """법·요율 자동 갱신 체계가 없는 계산기는 공개 색인하지 않는다."""
        for slug in ("insurance-calculator", "jeonse-rent-calculator"):
            with self.subTest(slug=slug):
                self.assertIn(slug, HIDDEN_TOOL_SLUGS)
                response = self.client.get(f"/{slug}")
                self.assertEqual(response.status_code, 200)
                self.assertEqual(
                    response.headers.get("X-Robots-Tag"), "noindex, follow"
                )


if __name__ == "__main__":
    unittest.main()
