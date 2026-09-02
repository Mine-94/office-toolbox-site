import json
import re
import unittest

from main import app


class QuoteStatementPageTest(unittest.TestCase):
    def setUp(self):
        app.config.update(TESTING=True)
        self.client = app.test_client()

    def test_page_is_public_and_indexable(self):
        response = self.client.get("/quote-statement")
        html = response.get_data(as_text=True)

        self.assertEqual(response.status_code, 200)
        self.assertNotIn("noindex", response.headers.get("X-Robots-Tag", ""))
        self.assertIn(
            '<link rel="canonical" href="http://localhost/quote-statement">', html
        )
        self.assertIn("무료 견적서·거래명세서 만들기", html)
        self.assertIn("회원가입 없이", html)
        self.assertIn("서버 저장 없음", html)

    def test_page_has_complete_structured_data(self):
        html = self.client.get("/quote-statement").get_data(as_text=True)
        blocks = re.findall(
            r'<script type="application/ld\+json">\s*(.*?)\s*</script>', html, re.S
        )
        parsed = [json.loads(block) for block in blocks]
        page_graph = next(item["@graph"] for item in parsed if "@graph" in item)

        self.assertEqual(page_graph[0]["@type"], "WebApplication")
        self.assertEqual(page_graph[0]["offers"]["price"], "0")
        self.assertEqual(page_graph[1]["@type"], "FAQPage")
        self.assertGreaterEqual(len(page_graph[1]["mainEntity"]), 3)

    def test_page_is_discoverable_from_home_and_sitemap(self):
        home = self.client.get("/").get_data(as_text=True)
        sitemap = self.client.get("/sitemap.xml").get_data(as_text=True)

        self.assertIn('href="/quote-statement"', home)
        self.assertIn('id="business"', home)
        self.assertIn("/quote-statement</loc>", sitemap)

    def test_client_side_assets_and_privacy_copy_are_present(self):
        html = self.client.get("/quote-statement").get_data(as_text=True)

        self.assertIn("/static/css/quote-statement.css", html)
        self.assertIn("/static/js/quote-statement.js", html)
        self.assertIn("현재 브라우저 안에서만 처리", html)
        self.assertIn("전자세금계산서가 아닙니다", html)
        self.assertIn("국세청 부가가치세 안내", html)


if __name__ == "__main__":
    unittest.main()
