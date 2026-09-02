import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image
from pypdf import PdfWriter
from werkzeug.datastructures import FileStorage, MultiDict

import app as app_module


def make_pdf_bytes() -> bytes:
    output = io.BytesIO()
    writer = PdfWriter()
    writer.add_blank_page(width=300, height=400)
    writer.write(output)
    return output.getvalue()


def make_png_bytes(size=(120, 80)) -> bytes:
    output = io.BytesIO()
    Image.new("RGB", size, "white").save(output, "PNG")
    return output.getvalue()


class UploadSafetyTest(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.upload_patch = patch.object(
            app_module, "UPLOAD_DIR", Path(self.tempdir.name)
        )
        self.upload_patch.start()
        app_module.app.config.update(TESTING=True)
        self.client = app_module.app.test_client()
        self.valid_pdf = make_pdf_bytes()
        self.valid_png = make_png_bytes()

    def tearDown(self):
        self.upload_patch.stop()
        self.tempdir.cleanup()

    def post_file(self, url, content, filename, extra=None):
        data = {"file": (io.BytesIO(content), filename)}
        if extra:
            data.update(extra)
        return self.client.post(url, data=data, content_type="multipart/form-data")

    def test_corrupt_pdf_is_rejected_before_processing(self):
        corrupt = b"%PDF-1.4\nintentionally truncated"
        cases = [
            ("/api/pdf-compress/compress", {"quality": "medium"}),
            ("/api/pdf-to-word/convert", {}),
            ("/api/pdf-merge-split/split", {"mode": "individual", "range": ""}),
            ("/api/watermark/add", {"text": "TEST"}),
            ("/api/pdf-rotate/rotate", {"angle": "90"}),
            ("/api/pdf-password/encrypt", {"password": "Test1234!"}),
            ("/api/pdf-password/decrypt", {"password": "Test1234!"}),
            ("/api/pdf-to-ppt/convert", {}),
            ("/api/pdf-to-excel/convert", {}),
        ]
        for url, extra in cases:
            with self.subTest(url=url):
                response = self.post_file(url, corrupt, "corrupt.pdf", extra)
                self.assertEqual(response.status_code, 422)
                self.assertIn("PDF", response.get_json()["error"])

        merge_data = MultiDict(
            [
                ("files", FileStorage(io.BytesIO(corrupt), filename="corrupt.pdf")),
                ("files", FileStorage(io.BytesIO(self.valid_pdf), filename="valid.pdf")),
            ]
        )
        response = self.client.post(
            "/api/pdf-merge-split/merge",
            data=merge_data,
            content_type="multipart/form-data",
        )
        self.assertEqual(response.status_code, 422)

        response = self.client.post(
            "/api/pdf-sign/apply",
            data={
                "file": (io.BytesIO(corrupt), "corrupt.pdf"),
                "signature": (io.BytesIO(self.valid_png), "signature.png"),
                "target_page": "last",
                "position": "bottom-right",
            },
            content_type="multipart/form-data",
        )
        self.assertEqual(response.status_code, 422)

    def test_corrupt_images_return_client_error(self):
        corrupt = b"\x89PNG\r\n\x1a\nintentionally truncated"
        cases = [
            (
                "/api/image-compress/process",
                {"mode": "quality", "quality": "medium", "resize": "100"},
            ),
            ("/api/image-convert/convert", {"target": "jpg"}),
            ("/api/ocr/extract", {"lang": "ko+en"}),
        ]
        for url, extra in cases:
            with self.subTest(url=url):
                response = self.post_file(url, corrupt, "corrupt.png", extra)
                self.assertEqual(response.status_code, 422)
                self.assertIn("이미지", response.get_json()["error"])

    def test_tool_specific_file_limit_returns_413(self):
        with patch.object(app_module, "IMAGE_COMPRESS_MAX_FILE_BYTES", 32):
            response = self.post_file(
                "/api/image-compress/process",
                b"x" * 33,
                "oversized.jpg",
                {"mode": "quality", "quality": "medium", "resize": "100"},
            )
        self.assertEqual(response.status_code, 413)
        self.assertIn("최대", response.get_json()["error"])

    def test_high_resolution_image_is_rejected_before_conversion_and_ocr(self):
        image_bytes = make_png_bytes((200, 200))
        with patch.object(app_module, "IMAGE_CONVERT_MAX_PIXELS", 1_000):
            response = self.post_file(
                "/api/image-convert/convert",
                image_bytes,
                "large.png",
                {"target": "jpg"},
            )
        self.assertEqual(response.status_code, 422)
        self.assertIn("메가픽셀", response.get_json()["error"])

        with patch.object(app_module, "OCR_IMAGE_MAX_PIXELS", 1_000):
            response = self.post_file(
                "/api/ocr/extract",
                image_bytes,
                "large.png",
                {"lang": "ko+en"},
            )
        self.assertEqual(response.status_code, 422)

    def test_valid_core_uploads_still_work(self):
        def copy_pdf(source, destination, _quality):
            destination.write_bytes(source.read_bytes())

        with patch.object(app_module, "compress_pdf", copy_pdf):
            response = self.post_file(
                "/api/pdf-compress/compress",
                self.valid_pdf,
                "valid.pdf",
                {"quality": "medium"},
            )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()["used_original"])

        response = self.post_file(
            "/api/image-convert/convert",
            self.valid_png,
            "valid.png",
            {"target": "jpg"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("download_url", response.get_json())

        with patch.object(app_module, "ocr_image_file", return_value="테스트 문구"):
            response = self.post_file(
                "/api/ocr/extract",
                self.valid_png,
                "valid.png",
                {"lang": "ko+en"},
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["text"], "테스트 문구")


if __name__ == "__main__":
    unittest.main()
