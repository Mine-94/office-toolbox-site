import io
import os
import subprocess
import tempfile
import uuid
import zipfile
from pathlib import Path

from flask import (
    Flask,
    render_template,
    request,
    send_file,
    jsonify,
    after_this_request,
    Response,
)
from werkzeug.utils import secure_filename
from PIL import Image, ImageOps
from pypdf import PdfReader, PdfWriter
from pdf2docx import Converter

app = Flask(__name__)

SITE_NAME = "사무실 공구함"
SITE_TAGLINE = "Office Tools"

MAX_CONTENT_LENGTH = 100 * 1024 * 1024  # 100MB (PDF 쪽이 더 큼)
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

# ---------------------------------------------------------------------------
# 툴 목록 (홈 화면 카드 + sitemap 생성에 공용으로 사용)
# ---------------------------------------------------------------------------
TOOLS = [
    {
        "slug": "pdf-compress",
        "icon": "📄",
        "title": "PDF 압축",
        "desc": "용량 큰 PDF를 화질 손상 최소화하며 빠르게 줄여요.",
        "available": True,
    },
    {
        "slug": "image-compress",
        "icon": "🖼️",
        "title": "이미지 압축",
        "desc": "JPG·PNG·WEBP 이미지를 리사이즈하고 압축해요.",
        "available": True,
    },
    {
        "slug": "pdf-to-word",
        "icon": "📝",
        "title": "PDF → Word 변환",
        "desc": "PDF 문서를 편집 가능한 Word(.docx) 파일로 변환해요.",
        "available": True,
    },
    {
        "slug": "pdf-merge-split",
        "icon": "🗂️",
        "title": "PDF 병합·분할",
        "desc": "여러 PDF를 하나로 합치거나, 한 PDF를 원하는 대로 나눠요.",
        "available": True,
    },
]

# ---------------------------------------------------------------------------
# 업로드 임시 디렉토리
# ---------------------------------------------------------------------------
UPLOAD_DIR = Path(tempfile.gettempdir()) / "office-toolbox-uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


def human_size(num_bytes: int) -> str:
    size = float(num_bytes)
    for unit in ["B", "KB", "MB", "GB"]:
        if size < 1024:
            return f"{size:.1f}{unit}" if unit != "B" else f"{int(size)}{unit}"
        size /= 1024
    return f"{size:.1f}TB"


# ---------------------------------------------------------------------------
# PDF 압축 (Ghostscript)
# ---------------------------------------------------------------------------
PDF_QUALITY_PRESETS = {
    "low": "/screen",
    "medium": "/ebook",
    "high": "/printer",
}


def compress_pdf(input_path: Path, output_path: Path, quality: str) -> None:
    gs_setting = PDF_QUALITY_PRESETS.get(quality, "/ebook")
    cmd = [
        "gs",
        "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.4",
        f"-dPDFSETTINGS={gs_setting}",
        "-dNOPAUSE",
        "-dQUIET",
        "-dBATCH",
        "-dSAFER",
        f"-sOutputFile={output_path}",
        str(input_path),
    ]
    result = subprocess.run(cmd, capture_output=True, timeout=120)
    if result.returncode != 0 or not output_path.exists():
        raise RuntimeError(
            f"Ghostscript 압축 실패: {result.stderr.decode(errors='ignore')}"
        )


# ---------------------------------------------------------------------------
# 이미지 압축 (Pillow)
# ---------------------------------------------------------------------------
IMG_ALLOWED_EXT = {"jpg", "jpeg", "png", "webp"}

IMG_QUALITY_PRESETS = {
    "high": 90,
    "medium": 75,
    "low": 50,
}

IMG_RESIZE_PRESETS = {
    "100": 1.0,
    "75": 0.75,
    "50": 0.5,
    "25": 0.25,
}


def allowed_image_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in IMG_ALLOWED_EXT


def process_image(input_path: Path, output_path: Path, quality: str, resize: str):
    img = Image.open(input_path)
    img = ImageOps.exif_transpose(img)
    orig_w, orig_h = img.size

    scale = IMG_RESIZE_PRESETS.get(resize, 1.0)
    if scale < 1.0:
        new_w = max(1, round(orig_w * scale))
        new_h = max(1, round(orig_h * scale))
        img = img.resize((new_w, new_h), Image.LANCZOS)
    else:
        new_w, new_h = orig_w, orig_h

    q = IMG_QUALITY_PRESETS.get(quality, 75)
    ext = input_path.suffix.lower()

    if ext in (".jpg", ".jpeg"):
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        img.save(output_path, "JPEG", quality=q, optimize=True, progressive=True)
    elif ext == ".webp":
        img.save(output_path, "WEBP", quality=q, method=6)
    elif ext == ".png":
        if quality == "low" and img.mode in ("RGB", "RGBA"):
            img = img.convert("RGBA" if "A" in img.mode else "P", palette=Image.ADAPTIVE, colors=256)
        img.save(output_path, "PNG", optimize=True, compress_level=9)
    else:
        img.save(output_path)

    return orig_w, orig_h, new_w, new_h


# ---------------------------------------------------------------------------
# PDF → Word 변환 (pdf2docx)
# ---------------------------------------------------------------------------
def convert_pdf_to_docx(input_path: Path, output_path: Path) -> None:
    cv = Converter(str(input_path))
    try:
        cv.convert(str(output_path))
    finally:
        cv.close()


# ---------------------------------------------------------------------------
# PDF 병합 · 분할 (pypdf)
# ---------------------------------------------------------------------------
def merge_pdfs(input_paths, output_path: Path) -> None:
    writer = PdfWriter()
    for p in input_paths:
        reader = PdfReader(str(p))
        if reader.is_encrypted:
            raise RuntimeError("암호가 걸린 PDF는 지원하지 않습니다.")
        for page in reader.pages:
            writer.add_page(page)
    with open(output_path, "wb") as f:
        writer.write(f)


def parse_page_ranges(range_str: str, total_pages: int) -> list:
    pages = []
    parts = [p.strip() for p in range_str.split(",") if p.strip()]
    if not parts:
        raise ValueError("페이지 범위를 입력해주세요. 예: 1-3, 5, 7-9")
    for part in parts:
        if "-" in part:
            a_str, b_str = part.split("-", 1)
            try:
                a, b = int(a_str), int(b_str)
            except ValueError:
                raise ValueError(f"잘못된 페이지 범위입니다: {part}")
            if a < 1 or b > total_pages or a > b:
                raise ValueError(f"잘못된 페이지 범위입니다: {part} (전체 {total_pages}페이지)")
            pages.extend(range(a - 1, b))
        else:
            try:
                n = int(part)
            except ValueError:
                raise ValueError(f"잘못된 페이지 번호입니다: {part}")
            if n < 1 or n > total_pages:
                raise ValueError(f"잘못된 페이지 번호입니다: {part} (전체 {total_pages}페이지)")
            pages.append(n - 1)
    return pages


def split_pdf_range(input_path: Path, output_path: Path, range_str: str) -> None:
    reader = PdfReader(str(input_path))
    if reader.is_encrypted:
        raise RuntimeError("암호가 걸린 PDF는 지원하지 않습니다.")
    total = len(reader.pages)
    pages = parse_page_ranges(range_str, total)
    writer = PdfWriter()
    for i in pages:
        writer.add_page(reader.pages[i])
    with open(output_path, "wb") as f:
        writer.write(f)


def split_pdf_individual(input_path: Path, output_zip_path: Path) -> int:
    reader = PdfReader(str(input_path))
    if reader.is_encrypted:
        raise RuntimeError("암호가 걸린 PDF는 지원하지 않습니다.")
    total = len(reader.pages)
    with zipfile.ZipFile(output_zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for i in range(total):
            writer = PdfWriter()
            writer.add_page(reader.pages[i])
            buf = io.BytesIO()
            writer.write(buf)
            buf.seek(0)
            zf.writestr(f"page_{i + 1:03d}.pdf", buf.read())
    return total


# ---------------------------------------------------------------------------
# 페이지 라우트
# ---------------------------------------------------------------------------
@app.route("/")
def home():
    return render_template("home.html", page="home", tools=TOOLS, site_name=SITE_NAME)


@app.route("/pdf-compress")
def pdf_compress_page():
    return render_template("pdf_compress.html", page="pdf-compress", site_name=SITE_NAME)


@app.route("/image-compress")
def image_compress_page():
    return render_template("image_compress.html", page="image-compress", site_name=SITE_NAME)


@app.route("/pdf-to-word")
def pdf_to_word_page():
    return render_template("pdf_to_word.html", page="pdf-to-word", site_name=SITE_NAME)


@app.route("/pdf-merge-split")
def pdf_merge_split_page():
    return render_template("pdf_merge_split.html", page="pdf-merge-split", site_name=SITE_NAME)


@app.route("/about")
def about():
    return render_template("about.html", page="about", site_name=SITE_NAME)


@app.route("/privacy")
def privacy():
    return render_template("privacy.html", page="privacy", site_name=SITE_NAME)


@app.route("/terms")
def terms():
    return render_template("terms.html", page="terms", site_name=SITE_NAME)


@app.route("/robots.txt")
def robots():
    base = request.host_url.rstrip("/")
    body = "User-agent: *\nAllow: /\n\n" f"Sitemap: {base}/sitemap.xml\n"
    return Response(body, mimetype="text/plain")


@app.route("/sitemap.xml")
def sitemap():
    base = request.host_url.rstrip("/")
    pages = ["", "about", "privacy", "terms"] + [
        t["slug"] for t in TOOLS if t["available"]
    ]
    entries = []
    for page in pages:
        loc = f"{base}/{page}" if page else f"{base}/"
        entries.append(f"<url><loc>{loc}</loc></url>")
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(entries)
        + "\n</urlset>"
    )
    return Response(xml, mimetype="application/xml")


@app.route("/ads.txt")
def ads():
    return app.send_static_file("ads.txt")


# ---------------------------------------------------------------------------
# API - PDF 압축
# ---------------------------------------------------------------------------
@app.route("/api/pdf-compress/compress", methods=["POST"])
def api_pdf_compress():
    if "file" not in request.files:
        return jsonify({"error": "파일을 선택해주세요."}), 400

    file = request.files["file"]
    quality = request.form.get("quality", "medium")

    if file.filename == "":
        return jsonify({"error": "파일을 선택해주세요."}), 400

    if not file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "PDF 파일만 업로드할 수 있습니다."}), 400

    if quality not in PDF_QUALITY_PRESETS:
        quality = "medium"

    job_id = uuid.uuid4().hex
    safe_name = secure_filename(file.filename) or "document.pdf"
    input_path = UPLOAD_DIR / f"{job_id}_in.pdf"
    output_path = UPLOAD_DIR / f"{job_id}_out.pdf"

    file.save(input_path)
    original_size = input_path.stat().st_size

    try:
        compress_pdf(input_path, output_path, quality)
    except Exception as exc:  # noqa: BLE001
        input_path.unlink(missing_ok=True)
        output_path.unlink(missing_ok=True)
        return jsonify({"error": str(exc)}), 500

    compressed_size = output_path.stat().st_size

    used_original = False
    if compressed_size >= original_size:
        output_path.unlink(missing_ok=True)
        output_path = input_path
        compressed_size = original_size
        used_original = True

    download_name = safe_name.rsplit(".", 1)[0] + "_compressed.pdf"

    return jsonify(
        {
            "job_id": job_id,
            "download_url": f"/api/pdf-compress/download/{job_id}?name={download_name}",
            "original_size": original_size,
            "compressed_size": compressed_size,
            "original_size_human": human_size(original_size),
            "compressed_size_human": human_size(compressed_size),
            "ratio": round((1 - compressed_size / original_size) * 100, 1)
            if original_size and not used_original
            else 0,
            "used_original": used_original,
        }
    )


@app.route("/api/pdf-compress/download/<job_id>")
def api_pdf_download(job_id):
    safe_job_id = secure_filename(job_id)
    out_path = UPLOAD_DIR / f"{safe_job_id}_out.pdf"
    in_path = UPLOAD_DIR / f"{safe_job_id}_in.pdf"

    target = out_path if out_path.exists() else in_path
    if not target.exists():
        return jsonify({"error": "파일을 찾을 수 없습니다. 다시 시도해주세요."}), 404

    download_name = request.args.get("name", "compressed.pdf")

    @after_this_request
    def cleanup(response):
        try:
            in_path.unlink(missing_ok=True)
            out_path.unlink(missing_ok=True)
        except Exception:  # noqa: BLE001
            pass
        return response

    return send_file(
        target,
        as_attachment=True,
        download_name=download_name,
        mimetype="application/pdf",
    )


# ---------------------------------------------------------------------------
# API - 이미지 압축
# ---------------------------------------------------------------------------
@app.route("/api/image-compress/process", methods=["POST"])
def api_image_process():
    if "file" not in request.files:
        return jsonify({"error": "파일을 선택해주세요."}), 400

    file = request.files["file"]
    quality = request.form.get("quality", "medium")
    resize = request.form.get("resize", "100")

    if file.filename == "":
        return jsonify({"error": "파일을 선택해주세요."}), 400

    if not allowed_image_file(file.filename):
        return jsonify({"error": "JPG, PNG, WEBP 파일만 업로드할 수 있습니다."}), 400

    if quality not in IMG_QUALITY_PRESETS:
        quality = "medium"
    if resize not in IMG_RESIZE_PRESETS:
        resize = "100"

    job_id = uuid.uuid4().hex
    safe_name = secure_filename(file.filename) or "image.jpg"
    ext = Path(safe_name).suffix.lower() or ".jpg"
    input_path = UPLOAD_DIR / f"{job_id}_in{ext}"
    output_path = UPLOAD_DIR / f"{job_id}_out{ext}"

    file.save(input_path)
    original_size = input_path.stat().st_size

    try:
        orig_w, orig_h, new_w, new_h = process_image(input_path, output_path, quality, resize)
    except Exception as exc:  # noqa: BLE001
        input_path.unlink(missing_ok=True)
        output_path.unlink(missing_ok=True)
        return jsonify({"error": f"이미지 처리 실패: {exc}"}), 500

    compressed_size = output_path.stat().st_size

    used_original = False
    if compressed_size >= original_size and resize == "100":
        output_path.unlink(missing_ok=True)
        output_path = input_path
        compressed_size = original_size
        used_original = True

    stem = safe_name.rsplit(".", 1)[0]
    download_name = f"{stem}_compressed{ext}"

    return jsonify(
        {
            "job_id": job_id,
            "download_url": f"/api/image-compress/download/{job_id}?name={download_name}&ext={ext}",
            "original_size": original_size,
            "compressed_size": compressed_size,
            "original_size_human": human_size(original_size),
            "compressed_size_human": human_size(compressed_size),
            "ratio": round((1 - compressed_size / original_size) * 100, 1)
            if original_size and not used_original
            else 0,
            "original_dimensions": f"{orig_w}×{orig_h}",
            "new_dimensions": f"{new_w}×{new_h}",
            "used_original": used_original,
        }
    )


@app.route("/api/image-compress/download/<job_id>")
def api_image_download(job_id):
    safe_job_id = secure_filename(job_id)
    ext = request.args.get("ext", ".jpg")
    if ext not in (".jpg", ".jpeg", ".png", ".webp"):
        ext = ".jpg"

    out_path = UPLOAD_DIR / f"{safe_job_id}_out{ext}"
    in_path = UPLOAD_DIR / f"{safe_job_id}_in{ext}"

    target = out_path if out_path.exists() else in_path
    if not target.exists():
        return jsonify({"error": "파일을 찾을 수 없습니다. 다시 시도해주세요."}), 404

    download_name = request.args.get("name", f"compressed{ext}")
    mimetype = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }.get(ext, "application/octet-stream")

    @after_this_request
    def cleanup(response):
        try:
            in_path.unlink(missing_ok=True)
            out_path.unlink(missing_ok=True)
        except Exception:  # noqa: BLE001
            pass
        return response

    return send_file(
        target,
        as_attachment=True,
        download_name=download_name,
        mimetype=mimetype,
    )


# ---------------------------------------------------------------------------
# API - PDF → Word 변환
# ---------------------------------------------------------------------------
@app.route("/api/pdf-to-word/convert", methods=["POST"])
def api_pdf_to_word():
    if "file" not in request.files:
        return jsonify({"error": "파일을 선택해주세요."}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "파일을 선택해주세요."}), 400
    if not file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "PDF 파일만 업로드할 수 있습니다."}), 400

    job_id = uuid.uuid4().hex
    safe_name = secure_filename(file.filename) or "document.pdf"
    input_path = UPLOAD_DIR / f"{job_id}_in.pdf"
    output_path = UPLOAD_DIR / f"{job_id}_out.docx"

    file.save(input_path)

    try:
        convert_pdf_to_docx(input_path, output_path)
    except Exception as exc:  # noqa: BLE001
        input_path.unlink(missing_ok=True)
        output_path.unlink(missing_ok=True)
        return jsonify({"error": f"변환에 실패했습니다. 텍스트 기반 PDF만 지원합니다. ({exc})"}), 500
    finally:
        input_path.unlink(missing_ok=True)

    if not output_path.exists():
        return jsonify({"error": "변환에 실패했습니다."}), 500

    download_name = safe_name.rsplit(".", 1)[0] + ".docx"

    return jsonify(
        {
            "job_id": job_id,
            "download_url": f"/api/pdf-to-word/download/{job_id}?name={download_name}",
        }
    )


@app.route("/api/pdf-to-word/download/<job_id>")
def api_pdf_to_word_download(job_id):
    safe_job_id = secure_filename(job_id)
    out_path = UPLOAD_DIR / f"{safe_job_id}_out.docx"
    if not out_path.exists():
        return jsonify({"error": "파일을 찾을 수 없습니다. 다시 시도해주세요."}), 404

    download_name = request.args.get("name", "converted.docx")

    @after_this_request
    def cleanup(response):
        try:
            out_path.unlink(missing_ok=True)
        except Exception:  # noqa: BLE001
            pass
        return response

    return send_file(
        out_path,
        as_attachment=True,
        download_name=download_name,
        mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


# ---------------------------------------------------------------------------
# API - PDF 병합 · 분할
# ---------------------------------------------------------------------------
@app.route("/api/pdf-merge-split/merge", methods=["POST"])
def api_pdf_merge():
    files = [f for f in request.files.getlist("files") if f and f.filename]
    if len(files) < 2:
        return jsonify({"error": "합칠 PDF 파일을 2개 이상 선택해주세요."}), 400
    for f in files:
        if not f.filename.lower().endswith(".pdf"):
            return jsonify({"error": "PDF 파일만 업로드할 수 있습니다."}), 400

    job_id = uuid.uuid4().hex
    input_paths = []
    for i, f in enumerate(files):
        p = UPLOAD_DIR / f"{job_id}_in{i}.pdf"
        f.save(p)
        input_paths.append(p)
    output_path = UPLOAD_DIR / f"{job_id}_out.pdf"

    try:
        merge_pdfs(input_paths, output_path)
    except Exception as exc:  # noqa: BLE001
        output_path.unlink(missing_ok=True)
        return jsonify({"error": str(exc)}), 500
    finally:
        for p in input_paths:
            p.unlink(missing_ok=True)

    return jsonify(
        {
            "job_id": job_id,
            "download_url": f"/api/pdf-merge-split/download/{job_id}?name=merged.pdf&type=pdf",
        }
    )


@app.route("/api/pdf-merge-split/split", methods=["POST"])
def api_pdf_split():
    if "file" not in request.files:
        return jsonify({"error": "파일을 선택해주세요."}), 400

    file = request.files["file"]
    mode = request.form.get("mode", "individual")
    page_range = request.form.get("range", "")

    if file.filename == "":
        return jsonify({"error": "파일을 선택해주세요."}), 400
    if not file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "PDF 파일만 업로드할 수 있습니다."}), 400

    job_id = uuid.uuid4().hex
    safe_name = secure_filename(file.filename) or "document.pdf"
    input_path = UPLOAD_DIR / f"{job_id}_in.pdf"
    file.save(input_path)

    try:
        if mode == "range":
            output_path = UPLOAD_DIR / f"{job_id}_out.pdf"
            split_pdf_range(input_path, output_path, page_range)
            download_name = safe_name.rsplit(".", 1)[0] + "_split.pdf"
            file_type = "pdf"
        else:
            output_path = UPLOAD_DIR / f"{job_id}_out.zip"
            split_pdf_individual(input_path, output_path)
            download_name = safe_name.rsplit(".", 1)[0] + "_pages.zip"
            file_type = "zip"
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": str(exc)}), 500
    finally:
        input_path.unlink(missing_ok=True)

    return jsonify(
        {
            "job_id": job_id,
            "download_url": f"/api/pdf-merge-split/download/{job_id}?name={download_name}&type={file_type}",
        }
    )


@app.route("/api/pdf-merge-split/download/<job_id>")
def api_pdf_merge_split_download(job_id):
    safe_job_id = secure_filename(job_id)
    file_type = request.args.get("type", "pdf")
    ext = ".zip" if file_type == "zip" else ".pdf"
    out_path = UPLOAD_DIR / f"{safe_job_id}_out{ext}"
    if not out_path.exists():
        return jsonify({"error": "파일을 찾을 수 없습니다. 다시 시도해주세요."}), 404

    download_name = request.args.get("name", f"result{ext}")
    mimetype = "application/zip" if file_type == "zip" else "application/pdf"

    @after_this_request
    def cleanup(response):
        try:
            out_path.unlink(missing_ok=True)
        except Exception:  # noqa: BLE001
            pass
        return response

    return send_file(
        out_path,
        as_attachment=True,
        download_name=download_name,
        mimetype=mimetype,
    )


@app.errorhandler(413)
def too_large(_e):
    return jsonify({"error": "파일이 너무 큽니다. 100MB 이하 파일만 지원합니다."}), 413


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5002))
    app.run(host="0.0.0.0", port=port, debug=False)
