from app import app, TOOLS, TOOL_CATEGORIES, SITE_NAME
from business_tools import api_business_status, business_status_page

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

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
