import os
import re
from datetime import datetime, timezone

import requests
from flask import Blueprint, jsonify, render_template, request

business_bp = Blueprint("business", __name__)

NTS_STATUS_URL = "https://api.odcloud.kr/api/nts-businessman/v1/status"


def normalize_business_number(value: str) -> str:
    return re.sub(r"\D", "", value or "")


@business_bp.get("/business-status")
def business_status_page():
    return render_template("business_status.html", page="business-status")


@business_bp.post("/api/business/status")
def api_business_status():
    payload = request.get_json(silent=True) or {}
    business_number = normalize_business_number(payload.get("businessNumber", ""))

    if len(business_number) != 10:
        return jsonify({"error": "사업자등록번호 10자리를 입력해주세요."}), 400

    service_key = os.getenv("NTS_SERVICE_KEY")
    if not service_key:
        return jsonify({"error": "사업자 조회 서비스가 아직 설정되지 않았습니다."}), 503

    try:
        response = requests.post(
            NTS_STATUS_URL,
            params={"serviceKey": service_key},
            json={"b_no": [business_number]},
            timeout=8,
        )
        response.raise_for_status()
        data = response.json()
    except requests.Timeout:
        return jsonify({"error": "국세청 조회 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요."}), 504
    except (requests.RequestException, ValueError):
        return jsonify({"error": "국세청 조회 서비스에 일시적으로 연결할 수 없습니다."}), 502

    items = data.get("data") or []
    if not items:
        return jsonify({"error": "조회 결과를 확인할 수 없습니다."}), 502

    item = items[0]
    status_code = (item.get("b_stt_cd") or "").strip()
    status_name = (item.get("b_stt") or "").strip()
    tax_type = (item.get("tax_type") or "").strip()

    registered = bool(status_code or status_name or tax_type)

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
