# 사무실 공구함 (Office Tools)

사무직에서 자주 쓰는 온라인 문서 도구 모음. 기존 pdf-compress-site, image-compress-site를 하나의 허브로 통합.

## 제공 도구
- `/pdf-compress` — PDF 압축 (Ghostscript)
- `/image-compress` — 이미지 압축/리사이즈 (Pillow)
- 추후 추가 예정: PDF↔Word 변환, PDF 병합/분할

## 로컬 실행
```bash
pip install -r requirements.txt
python app.py
```
Ghostscript가 로컬에 설치되어 있어야 PDF 압축이 동작합니다 (`brew install ghostscript` / `apt install ghostscript`).

## 배포 (Render)
1. GitHub 레포 생성 후 push
2. Render → New Web Service → 레포 연결 → Dockerfile 자동 인식
3. 배포 후 다음 항목 반영 필요:
   - `templates/base.html`의 GA4/AdSense 코드 주석 해제 및 실제 ID로 교체
   - Search Console 신규 속성 등록 + sitemap.xml 제출
   - 커스텀 도메인 연결 시 기존 두 사이트에서 301 리다이렉트 고려
