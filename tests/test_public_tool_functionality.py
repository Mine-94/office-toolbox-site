import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from openpyxl import Workbook
from PIL import Image
from pypdf import PdfReader, PdfWriter

import app as app_module
import business_tools
from main import app


def make_pdf_bytes(page_count=1):
    output = io.BytesIO()
    writer = PdfWriter()
    for _ in range(page_count):
        writer.add_blank_page(width=300, height=400)
    writer.write(output)
    return output.getvalue()


def make_png_bytes():
    output = io.BytesIO()
    Image.new("RGB", (320, 180), "#d9ebe4").save(output, "PNG")
    return output.getvalue()


class PublicToolFunctionalityTest(unittest.TestCase):
    """색인 대상 서버 도구의 정상 입력→결과 생성→다운로드 흐름을 고정한다."""

    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.upload_patch = patch.object(
            app_module, "UPLOAD_DIR", Path(self.tempdir.name)
        )
        self.upload_patch.start()
        app.config.update(TESTING=True)
        self.client = app.test_client()

    def tearDown(self):
        self.upload_patch.stop()
        self.tempdir.cleanup()

    def test_image_compress_result_can_be_downloaded_once(self):
        response = self.client.post(
            "/api/image-compress/process",
            data={
                "file": (io.BytesIO(make_png_bytes()), "sample.png"),
                "mode": "dimensions",
                "target_w": "160",
                "target_h": "90",
                "fit": "contain",
                "quality": "medium",
            },
            content_type="multipart/form-data",
        )
        self.assertEqual(response.status_code, 200)
        result = response.get_json()
        self.assertEqual(result["new_dimensions"], "160×90")

        download = self.client.get(result["download_url"])
        self.assertEqual(download.status_code, 200)
        self.assertEqual(download.mimetype, "image/png")
        download.close()
        self.assertFalse(any(Path(self.tempdir.name).iterdir()))

    def test_pdf_merge_and_split_results_can_be_downloaded(self):
        source = make_pdf_bytes(page_count=2)
        merge = self.client.post(
            "/api/pdf-merge-split/merge",
            data={
                "files": [
                    (io.BytesIO(source), "first.pdf"),
                    (io.BytesIO(source), "second.pdf"),
                ]
            },
            content_type="multipart/form-data",
        )
        self.assertEqual(merge.status_code, 200)
        merged_download = self.client.get(merge.get_json()["download_url"])
        self.assertEqual(merged_download.status_code, 200)
        self.assertEqual(len(PdfReader(io.BytesIO(merged_download.data)).pages), 4)
        merged_download.close()

        split = self.client.post(
            "/api/pdf-merge-split/split",
            data={
                "file": (io.BytesIO(source), "source.pdf"),
                "mode": "range",
                "range": "2",
            },
            content_type="multipart/form-data",
        )
        self.assertEqual(split.status_code, 200)
        split_download = self.client.get(split.get_json()["download_url"])
        self.assertEqual(split_download.status_code, 200)
        self.assertEqual(len(PdfReader(io.BytesIO(split_download.data)).pages), 1)
        split_download.close()
        self.assertFalse(any(Path(self.tempdir.name).iterdir()))

    def test_pdf_to_excel_and_business_file_flows_return_valid_workbooks(self):
        def write_workbook(_source, destination):
            workbook = Workbook()
            workbook.active.append(["항목", "금액"])
            workbook.active.append(["샘플", 1000])
            workbook.save(destination)
            return True

        with patch.object(app_module, "convert_pdf_to_xlsx", write_workbook):
            convert = self.client.post(
                "/api/pdf-to-excel/convert",
                data={"file": (io.BytesIO(make_pdf_bytes()), "table.pdf")},
                content_type="multipart/form-data",
            )
        self.assertEqual(convert.status_code, 200)
        self.assertTrue(convert.get_json()["found_table"])
        converted_download = self.client.get(convert.get_json()["download_url"])
        self.assertEqual(converted_download.status_code, 200)
        self.assertTrue(converted_download.data.startswith(b"PK"))
        converted_download.close()

        parsed = self.client.post(
            "/api/business/bulk-parse",
            data={"file": (io.BytesIO("사업자번호\n123-45-67890\n".encode()), "list.csv")},
            content_type="multipart/form-data",
        )
        self.assertEqual(parsed.status_code, 200)
        self.assertEqual(parsed.get_json()["businessNumbers"], ["123-45-67890"])

        exported = self.client.post(
            "/api/business/bulk-export-xlsx",
            json={
                "rows": [
                    {
                        "businessNumber": "123-45-67890",
                        "registered": True,
                        "statusName": "계속사업자",
                        "taxType": "부가가치세 일반과세자",
                    }
                ]
            },
        )
        self.assertEqual(exported.status_code, 200)
        self.assertTrue(exported.data.startswith(b"PK"))
        exported.close()

    def test_business_status_uses_normalized_public_data_response(self):
        provider_row = {
            "b_no": "1234567890",
            "b_stt_cd": "01",
            "b_stt": "계속사업자",
            "tax_type": "부가가치세 일반과세자",
        }
        with patch.object(business_tools, "nts_status_request", return_value=([provider_row], None)):
            response = self.client.post(
                "/api/business/status", json={"businessNumber": "123-45-67890"}
            )
        self.assertEqual(response.status_code, 200)
        result = response.get_json()["data"]
        self.assertEqual(result["businessNumber"], "123-45-67890")
        self.assertEqual(result["statusName"], "계속사업자")
        self.assertTrue(result["registered"])


if __name__ == "__main__":
    unittest.main()
