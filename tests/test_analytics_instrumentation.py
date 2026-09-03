from pathlib import Path
import unittest

from main import app


ROOT = Path(__file__).resolve().parents[1]


class AnalyticsInstrumentationTest(unittest.TestCase):
    def setUp(self):
        app.config.update(TESTING=True)
        self.client = app.test_client()

    def test_consent_defaults_precede_google_scripts(self):
        html = self.client.get("/").get_data(as_text=True)
        consent_position = html.index("gtag('consent', 'default'")
        ads_position = html.index("pagead2.googlesyndication.com")

        self.assertLess(consent_position, ads_position)
        for key in (
            "analytics_storage",
            "ad_storage",
            "ad_user_data",
            "ad_personalization",
        ):
            self.assertIn(f"'{key}': 'denied'", html)

    def test_privacy_page_explains_measurement_limits(self):
        html = self.client.get("/privacy").get_data(as_text=True)

        self.assertIn("Google Analytics", html)
        self.assertIn("문서 내용·파일명·사업자등록번호·금액", html)
        self.assertIn("기본적으로 거부", html)

    def test_every_public_core_tool_tracks_a_completion(self):
        scripts = {
            "pdf-compress": "pdf-compress.js",
            "image-compress": "image-compress.js",
            "pdf-merge-split": "pdf-merge-split.js",
            "char-counter": "char-counter.js",
            "file-hash": "file-hash.js",
            "salary-calculator": "salary-calculator.js",
            "image-convert": "image-convert.js",
            "ocr": "ocr.js",
            "pdf-to-excel": "pdf-to-excel.js",
            "quote-statement": "quote-statement.js",
            "business-status": "business-status.js",
            "business-bulk-status": "business-bulk-status.js",
        }
        for slug, filename in scripts.items():
            with self.subTest(slug=slug):
                source = (ROOT / "static" / "js" / filename).read_text()
                self.assertIn(f'trackToolComplete("{slug}"', source)

    def test_direct_ga_event_calls_exist_only_in_common_helper(self):
        direct_event = 'gtag("event", "tool_complete"'
        for path in (ROOT / "static" / "js").glob("*.js"):
            if path.name == "otx-storage.js":
                continue
            with self.subTest(path=path.name):
                self.assertNotIn(direct_event, path.read_text())


if __name__ == "__main__":
    unittest.main()
