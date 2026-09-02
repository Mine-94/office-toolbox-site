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

    def test_contact_page_is_reachable_and_linked(self):
        response = self.client.get("/contact")
        html = response.get_data(as_text=True)
        home = self.client.get("/").get_data(as_text=True)
        sitemap = self.client.get("/sitemap.xml").get_data(as_text=True)
        privacy = self.client.get("/privacy").get_data(as_text=True)

        self.assertEqual(response.status_code, 200)
        self.assertIn("<h1>문의하기</h1>", html)
        self.assertIn("github.com/Mine-94/office-toolbox-site/issues/new", html)
        self.assertIn('href="/contact"', home)
        self.assertIn("/contact</loc>", sitemap)
        self.assertIn('href="/contact"', privacy)

    def test_ocr_page_has_complete_user_guidance(self):
        html = self.client.get("/ocr").get_data(as_text=True)

        for text in (
            "OCR 사용 방법",
            "지원 범위와 처리 제한",
            "파일은 최대 50MB",
            "이미지는 최대 1,600만 화소",
            "PDF는 처음 20페이지",
            "성공·실패와 관계없이 처리 직후 삭제",
            "인식이 잘 안 될 때",
            "사용 예시",
        ):
            with self.subTest(text=text):
                self.assertIn(text, html)


if __name__ == "__main__":
    unittest.main()
