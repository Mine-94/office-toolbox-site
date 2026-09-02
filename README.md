# 업무 도구함 (OFFICE TOOLBOX)

한국 업무에서 자주 쓰는 문서·이미지·사업자조회·계산 도구를 한곳에 제공하는 Flask 서비스입니다.

## 검색 노출 대상 핵심 도구
- PDF 압축, 병합·분할, PDF 표 → Excel
- 이미지 압축·크기 변경, 이미지 포맷 변환, OCR
- 글자 수·바이트, 연봉 예상 실수령액 계산
- 사업자등록번호 단건·일괄 상태조회, 견적서·거래명세서 만들기

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
