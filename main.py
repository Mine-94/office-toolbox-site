import app as app_module
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

# 브랜드명 통일. 기존 app.py 라우트가 참조하는 전역값도 런타임에 함께 갱신한다.
app_module.SITE_NAME = "업무 도구함"

# 전수 점검 후 허브/사이트맵에서 제외하는 도구.
# - 실제 오류 확인: PDF → Word
# - 계산 정확성 보완 필요: 퇴직금 계산기(통상임금 비교 미반영)
# - 업무 도구함 핵심 방향과 검색/재방문 가치가 낮음: QR, 텍스트 비교, 회전, 워터마크, 비밀번호, 서명, PDF → PPT
# 기존 URL은 즉시 삭제하지 않고 유지하되 검색엔진에는 noindex로 안내한다.
HIDDEN_TOOL_SLUGS = {
    "qr-code",
    "text-diff",
    "pdf-rotate",
    "pdf-to-word",
    "watermark",
    "pdf-password",
    "pdf-sign",
    "pdf-to-ppt",
    "severance-calculator",
}
TOOLS[:] = [tool for tool in TOOLS if tool.get("slug") not in HIDDEN_TOOL_SLUGS]
HIDDEN_TOOL_PATHS = {f"/{slug}" for slug in HIDDEN_TOOL_SLUGS}

# 한국 업무 특화 카테고리/도구 확장
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
            "desc": "Excel 원본을 유지한 채 최대 100개 거래처의 휴업·폐업 상태를 점검하고 결과 열을 추가해요.",
            "available": True,
            "category": "business",
            "popular": True,
        }
    )

# 기존 개별 템플릿에 남아 있는 옛 브랜드명을 운영 화면에서 일괄 통일하고,
# 허브에서 제외한 구형/저가치 도구는 검색엔진에 색인하지 않도록 안내한다.
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

    if app_module.request.path in HIDDEN_TOOL_PATHS:
        response.headers["X-Robots-Tag"] = "noindex, follow"
    return response

# home.html이 기존 endpoint 명명 규칙을 그대로 사용할 수 있도록 명시적으로 등록
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
