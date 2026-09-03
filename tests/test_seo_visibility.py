import unittest

from lxml import etree, html as html_parser

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

    def test_public_pages_do_not_link_to_hidden_tools(self):
        sitemap = self.client.get("/sitemap.xml")
        root = etree.fromstring(sitemap.data)
        namespace = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}

        for location in root.xpath("//s:loc/text()", namespaces=namespace):
            path = location.split("localhost", 1)[-1] or "/"
            document = html_parser.fromstring(self.client.get(path).data)
            links = document.xpath("//a/@href")
            for slug in HIDDEN_TOOL_SLUGS:
                with self.subTest(path=path, slug=slug):
                    self.assertNotIn(f"/{slug}", links)

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

    def test_static_assets_use_short_browser_cache(self):
        """정적 자산만 캐시하고 HTML·서비스 워커는 즉시 갱신 가능하게 둔다."""
        static_asset = self.client.get("/static/css/style.css")
        self.assertEqual(static_asset.status_code, 200)
        self.assertIn("public", static_asset.headers.get("Cache-Control", ""))
        self.assertIn("max-age=3600", static_asset.headers.get("Cache-Control", ""))
        self.assertNotIn("no-cache", static_asset.headers.get("Cache-Control", ""))
        static_asset.close()

        for path in ("/", "/service-worker.js"):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertNotIn("max-age=3600", response.headers.get("Cache-Control", ""))
                response.close()

    def test_social_previews_use_page_specific_metadata(self):
        response = self.client.get("/pdf-compress", base_url="https://officetoolbox.online")
        document = html_parser.fromstring(response.data)

        title = document.xpath("string(//title)").strip()
        description = document.xpath('string(//meta[@name="description"]/@content)')
        self.assertEqual(
            document.xpath('string(//meta[@property="og:title"]/@content)'), title
        )
        self.assertEqual(
            document.xpath('string(//meta[@property="og:description"]/@content)'),
            description,
        )
        self.assertEqual(
            document.xpath('string(//meta[@property="og:url"]/@content)'),
            "https://officetoolbox.online/pdf-compress",
        )
        self.assertEqual(
            document.xpath('string(//meta[@name="twitter:title"]/@content)'), title
        )
        self.assertEqual(
            document.xpath('string(//meta[@property="og:image"]/@content)'),
            "https://officetoolbox.online/static/icons/icon-512.png",
        )

    def test_share_action_is_limited_to_public_tools(self):
        public_tool = self.client.get("/pdf-compress").get_data(as_text=True)
        self.assertIn('data-share-tool="pdf-compress"', public_tool)
        self.assertIn("입력한 파일이나 내용은 공유되지 않고", public_tool)

        for path in ("/", "/about", "/privacy", "/qr-code"):
            with self.subTest(path=path):
                page = self.client.get(path).get_data(as_text=True)
                self.assertNotIn("data-share-tool=", page)

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
        self.assertIn("생성 후 1시간이 지난 파일", privacy)

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

    def test_image_convert_page_has_complete_user_guidance(self):
        html = self.client.get("/image-convert").get_data(as_text=True)

        for text in (
            "이미지 변환 방법",
            "JPG·PNG·WEBP 선택 기준",
            "투명 영역을 흰색으로 채워 저장",
            "EXIF 방향 정보를 반영",
            "파일은 최대 50MB",
            "최대 1,600만 화소",
                "결과 파일은 다운로드 응답을 보낸 직후 삭제",
                "1시간이 지나면 다음 처리 요청에서 정리",
            "변환 후 용량이 커졌다면",
        ):
            with self.subTest(text=text):
                self.assertIn(text, html)

    def test_remaining_public_tools_have_complete_user_guidance(self):
        expected = {
            "/pdf-compress": (
                "PDF 용량 줄이는 방법",
                "압축 결과가 달라지는 이유",
                "원본과 결과는 다운로드 응답 뒤 삭제",
                "압축이 되지 않을 때",
            ),
            "/image-compress": (
                "이미지 줄이기 방법",
                "세 가지 처리 방식",
                "메타데이터 제거 전용 도구가 아닙니다",
                "최대 4,000만 화소",
            ),
            "/pdf-merge-split": (
                "PDF 합치기·나누기 방법",
                "전체 페이지 개별 분할",
                "인증 전자서명은 새 PDF에서 그대로 유지되지 않을 수 있습니다",
                "결과는 다운로드 응답 뒤 삭제",
            ),
            "/char-counter": (
                "글자 수 결과 읽는 법",
                "UTF-8 파일 크기",
                "공백·줄바꿈 정리",
                "텍스트를 서버로 보내지 않습니다",
            ),
            "/salary-calculator": (
                "예상 실수령액 계산 방법",
                "연간 공제 구조를 단순화한 근사값",
                "성과급, 상여금, 퇴직금",
                "브라우저 안에서만",
            ),
            "/pdf-to-excel": (
                "PDF 표를 Excel로 옮기는 방법",
                "처음 30페이지만 분석",
                "OCR 결과를 자동으로 표 셀에 재구성하지 않습니다",
                "생성된 Excel은 다운로드 응답 뒤 삭제",
            ),
            "/quote-statement": (
                "견적서·거래명세서 작성 순서",
                "최대 20개 품목",
                "전자세금계산서나 계약서를 대신하지 않습니다",
                "공용 PC에서는 임시저장을 끄고",
            ),
            "/business-status": (
                "사업자 상태 확인 순서",
                "확인할 수 없는 것",
                "일일 API 한도",
                "별도 데이터베이스에 저장하지 않습니다",
            ),
            "/business-bulk-status": (
                "거래처 Excel 준비 방법",
                "최대 100개, 파일은 5MB 이하",
                "원본 유지 방식은 XLSX만 지원",
                "요청 처리 메모리에서 읽습니다",
            ),
        }

        for path, markers in expected.items():
            page = self.client.get(path)
            self.assertEqual(page.status_code, 200, path)
            rendered = page.get_data(as_text=True)
            for marker in markers:
                with self.subTest(path=path, marker=marker):
                    self.assertIn(marker, rendered)


if __name__ == "__main__":
    unittest.main()
