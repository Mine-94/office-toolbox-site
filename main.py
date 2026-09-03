import app as app_module
from flask import request
from app import app, TOOLS, TOOL_CATEGORIES
from business_excel_tools import api_business_excel_enrich
from business_tools import (
    api_business_bulk_export_xlsx,
    api_business_bulk_parse,
    api_business_bulk_status,
    api_business_status,
    business_bulk_status_page,
    business_status_page,
)

app_module.SITE_NAME = "업무 도구함"

# 전수 점검 결과 홈·사이트맵에서 제외하는 도구.
# 기존 URL은 과거 링크 보존을 위해 유지하지만 검색엔진에는 noindex로 안내한다.
HIDDEN_TOOL_SLUGS = {
    "qr-code",
    "text-diff",
    "pdf-rotate",
    "pdf-to-word",          # 실제 운영환경에서 변환 실패 확인
    "watermark",            # 핵심 업무 흐름과 차별성이 낮음
    "pdf-password",         # 핵심 업무 흐름과 차별성이 낮음
    "pdf-sign",             # 인증서 기반 전자서명이 아닌 이미지 삽입 기능
    "pdf-to-ppt",           # 편집 가능한 변환이 아니라 페이지 이미지 삽입 방식
    "severance-calculator", # 통상임금 비교가 없어 법정 퇴직금 계산으로는 불완전
    "insurance-calculator", # 가입 예외·보험료 상하한·산재 업종별 요율 반영 전까지 비노출
    "jeonse-rent-calculator", # 공식기관 계산기 대비 차별성과 자동 기준 갱신 체계가 부족함
}
TOOLS[:] = [tool for tool in TOOLS if tool.get("slug") not in HIDDEN_TOOL_SLUGS]
HIDDEN_TOOL_PATHS = {f"/{slug}" for slug in HIDDEN_TOOL_SLUGS}

# 남겨둔 도구의 표현을 실제 기능에 맞게 통일한다.
TOOL_META = {
    "pdf-compress": {
        "title": "PDF 압축",
        "desc": "이메일·온라인 제출용 PDF 용량을 화질 설정에 맞춰 줄여요.",
    },
    "image-compress": {
        "title": "이미지 압축·크기 변경",
        "desc": "이미지를 원하는 용량이나 픽셀 크기에 맞춰 줄여요.",
    },
    "pdf-merge-split": {
        "title": "PDF 병합·분할",
        "desc": "여러 PDF를 하나로 합치거나 필요한 페이지만 나눠요.",
    },
    "char-counter": {
        "title": "글자 수·바이트 계산기",
        "desc": "공백 포함·제외 글자수와 국내 일부 시스템의 2바이트 기준을 계산해요.",
    },
    "salary-calculator": {
        "title": "연봉 예상 실수령액 계산기",
        "desc": "2026년 4대보험 기준을 반영해 예상 월 실수령액을 계산해요.",
    },
    "image-convert": {
        "title": "이미지 포맷 변환",
        "desc": "HEIC·JPG·PNG·WEBP 등 업무용 이미지 형식을 변환해요.",
    },
    "ocr": {
        "title": "OCR 텍스트 추출",
        "desc": "이미지·스캔 PDF의 한국어·영어 인쇄 텍스트를 추출해요.",
    },
    "pdf-to-excel": {
        "title": "PDF 표 → Excel 추출",
        "desc": "PDF 안의 표 구조를 찾아 Excel 시트의 셀 데이터로 추출해요.",
    },
}
for tool in TOOLS:
    meta = TOOL_META.get(tool.get("slug"))
    if meta:
        tool.update(meta)

if not any(category.get("key") == "business" for category in TOOL_CATEGORIES):
    TOOL_CATEGORIES.append(
        {"key": "business", "label": "사업자·경리", "eyebrow": "BUSINESS"}
    )

if not any(tool.get("slug") == "business-status" for tool in TOOLS):
    TOOLS.append(
        {
            "slug": "business-status",
            "icon": "document",
            "title": "사업자등록번호 상태조회",
            "desc": "국세청 공공데이터로 휴업·폐업 여부와 과세유형을 확인해요.",
            "available": True,
            "category": "business",
            "popular": True,
        }
    )

if not any(tool.get("slug") == "business-bulk-status" for tool in TOOLS):
    TOOLS.append(
        {
            "slug": "business-bulk-status",
            "icon": "document",
            "title": "거래처 사업자 일괄점검",
            "desc": "Excel 원본을 유지한 채 최대 100개 거래처의 사업자 상태를 점검해요.",
            "available": True,
            "category": "business",
            "popular": True,
        }
    )

@app.after_request
def normalize_brand_name(response):
    content_type = response.headers.get("Content-Type", "")
    if "text/html" in content_type and not response.direct_passthrough:
        try:
            html = response.get_data(as_text=True)
            if "사무실 공구함" in html:
                response.set_data(html.replace("사무실 공구함", "업무 도구함"))
        except (RuntimeError, UnicodeDecodeError):
            pass

    if request.path in HIDDEN_TOOL_PATHS:
        response.headers["X-Robots-Tag"] = "noindex, follow"

    # CSS·JavaScript·아이콘은 짧게 캐시해 페이지 사이를 이동할 때마다
    # Render 원본 서버에 재검증 요청을 보내지 않도록 한다. HTML과
    # service-worker.js는 변경 사항을 바로 받을 수 있도록 제외한다.
    if request.path.startswith("/static/") and response.status_code == 200:
        response.cache_control.no_cache = None
        response.cache_control.public = True
        response.cache_control.max_age = 3600
    return response

app.add_url_rule(
    "/business-status",
    endpoint="business_status_page",
    view_func=business_status_page,
    methods=["GET"],
)
app.add_url_rule(
    "/api/business/status",
    endpoint="api_business_status",
    view_func=api_business_status,
    methods=["POST"],
)
app.add_url_rule(
    "/business-bulk-status",
    endpoint="business_bulk_status_page",
    view_func=business_bulk_status_page,
    methods=["GET"],
)
app.add_url_rule(
    "/api/business/bulk-status",
    endpoint="api_business_bulk_status",
    view_func=api_business_bulk_status,
    methods=["POST"],
)
app.add_url_rule(
    "/api/business/bulk-parse",
    endpoint="api_business_bulk_parse",
    view_func=api_business_bulk_parse,
    methods=["POST"],
)
app.add_url_rule(
    "/api/business/bulk-export-xlsx",
    endpoint="api_business_bulk_export_xlsx",
    view_func=api_business_bulk_export_xlsx,
    methods=["POST"],
)
app.add_url_rule(
    "/api/business/excel-enrich",
    endpoint="api_business_excel_enrich",
    view_func=api_business_excel_enrich,
    methods=["POST"],
)

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
