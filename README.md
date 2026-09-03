# 업무 도구함 (OFFICE TOOLBOX)

한국 업무에서 자주 쓰는 문서·이미지·사업자조회·계산 도구를 한곳에 제공하는 무료 Flask 서비스입니다. 설치나 회원가입 없이 웹에서 바로 사용할 수 있습니다.

**[업무 도구함 바로가기](https://officetoolbox.online/)**

## 검색 노출 대상 핵심 도구
- PDF: [압축](https://officetoolbox.online/pdf-compress), [병합·분할](https://officetoolbox.online/pdf-merge-split), [표 → Excel](https://officetoolbox.online/pdf-to-excel)
- 이미지: [압축·크기 변경](https://officetoolbox.online/image-compress), [포맷 변환](https://officetoolbox.online/image-convert), [OCR 텍스트 추출](https://officetoolbox.online/ocr)
- 텍스트·계산: [글자 수·바이트](https://officetoolbox.online/char-counter), [연봉 예상 실수령액](https://officetoolbox.online/salary-calculator)
- 사업자·경리: [사업자 상태조회](https://officetoolbox.online/business-status), [거래처 일괄점검](https://officetoolbox.online/business-bulk-status), [견적서·거래명세서 만들기](https://officetoolbox.online/quote-statement)

검색 가치나 기능 완성도가 낮은 기존 도구는 URL 호환성을 위해 유지하되 `main.py`의
`HIDDEN_TOOL_SLUGS`에서 홈·사이트맵 제외 및 `noindex` 처리합니다.

## 로컬 실행
```bash
pip install -r requirements.txt
python app.py
```
Ghostscript가 로컬에 설치되어 있어야 PDF 압축이 동작합니다 (`brew install ghostscript` / `apt install ghostscript`).

## 테스트
```bash
python -m unittest discover -v
node tests/test_analytics_events.js
node tests/test_quote_statement.js
python -m gunicorn --check-config main:app
```

## 배포 (Render)
1. GitHub 레포 생성 후 push
2. Render → New Web Service → 레포 연결 → Dockerfile 자동 인식
3. 배포 후 다음 항목 반영 필요:
   - `templates/base.html`의 GA4/AdSense 코드 주석 해제 및 실제 ID로 교체
   - Search Console 신규 속성 등록 + sitemap.xml 제출
   - 커스텀 도메인 연결 시 기존 두 사이트에서 301 리다이렉트 고려
