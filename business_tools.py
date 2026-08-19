import os
import re
from datetime import datetime, timezone
from urllib.parse import unquote

import requests
from flask import Blueprint, current_app, jsonify, render_template, request

business_bp = Blueprint("business", __name__)

NTS_STATUS_URL = "https://api.odcloud.kr/api/nts-businessman/v1/status"


def normalize_business_number(value: str) -> str:
    return re.sub(r"\D", "", value or "")


def normalize_service_key(value: str) -> str:
    """Render에 Encoding/Decoding 키 중 어느 쪽이 저장돼도 requests에서 정상 전송되도록 정규화한다."""
    return unquote((value or "").strip())


@business_bp.get("/business-status")
def business_status_page():
    return render_template("business_status.html", page="business-status")


@business_bp.post("/api/business/status")
def api_business_status():
    payload = request.get_json(silent=True) or {}
    business_number = normalize_business_number(payload.get("businessNumber", ""))

    if len(business_number) != 10:
        return jsonify({"error": "사업자등록번호 10자리를 입력해주세요."}), 400

    service_key = normalize_service_key(os.getenv("NTS_SERVICE_KEY", ""))
    if not service_key:
        return jsonify({"error": "사업자 조회 서비스가 아직 설정되지 않았습니다."}), 503

    try:
        response = requests.post(
            NTS_STATUS_URL,
            params={"serviceKey": service_key, "returnType": "JSON"},
            json={"b_no": [business_number]},
            headers={"Accept": "application/json"},
            timeout=10,
        )
    except requests.Timeout:
        return jsonify({"error": "국세청 조회 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요."}), 504
    except requests.RequestException as exc:
        current_app.logger.warning("NTS API connection error: %s", exc.__class__.__name__)
        return jsonify({"error": "국세청 조회 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해주세요."}), 502

    if not response.ok:
        # 인증키 등 민감정보는 로그에 남기지 않고 상태코드와 응답 본문 일부만 기록한다.
        provider_message = (response.text or "").strip().replace("\n", " ")[:500]
        current_app.logger.warning(
            "NTS API HTTP error status=%s body=%s",
            response.status_code,
            provider_message,
        )

        if response.status_code in (401, 403):
            return jsonify({"error": "공공데이터포털 인증키가 아직 활성화되지 않았거나 유효하지 않습니다. 잠시 후 다시 시도해주세요."}), 503
        if response.status_code == 429:
            return jsonify({"error": "오늘의 국세청 API 조회 한도에 도달했습니다. 잠시 후 다시 시도해주세요."}), 503
        if response.status_code in (400, 411, 413):
            return jsonify({"error": "국세청 API 요청 형식을 확인할 수 없습니다. 관리자에게 문의해주세요."}), 502
        return jsonify({"error": "국세청 조회 서비스가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해주세요."}), 502

    try:
        data = response.json()
    except ValueError:
        current_app.logger.warning("NTS API returned non-JSON response")
        return jsonify({"error": "국세청 조회 결과를 해석할 수 없습니다. 잠시 후 다시 시도해주세요."}), 502

    items = data.get("data") or []
    if not items:
        current_app.logger.warning("NTS API response has no data items")
        return jsonify({"error": "조회 결과를 확인할 수 없습니다."}), 502

    item = items[0]
    status_code = (item.get("b_stt_cd") or "").strip()
    status_name = (item.get("b_stt") or "").strip()
    tax_type = (item.get("tax_type") or "").strip()

    compact_tax_type = tax_type.replace(" ", "")
    not_registered = "등록되지않은" in compact_tax_type
    registered = bool(status_code or status_name or tax_type) and not not_registered

    return jsonify(
        {
            "success": True,
            "data": {
                "businessNumber": f"{business_number[:3]}-{business_number[3:5]}-{business_number[5:]}",
                "registered": registered,
                "statusCode": status_code,
                "statusName": status_name or ("확인 불가" if registered else "미등록 또는 확인 불가"),
                "taxType": tax_type or "확인 불가",
                "closureDate": (item.get("end_dt") or "").strip() or None,
                "taxTypeChangeDate": (item.get("tax_type_change_dt") or "").strip() or None,
                "invoiceApplyDate": (item.get("invoice_apply_dt") or "").strip() or None,
                "checkedAt": datetime.now(timezone.utc).isoformat(),
            },
        }
    )
