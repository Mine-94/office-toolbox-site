FROM python:3.11-slim

# Ghostscript(PDF 압축) + Tesseract(OCR) 설치
RUN apt-get update \
    && apt-get install -y --no-install-recommends ghostscript tesseract-ocr tesseract-ocr-kor \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "gunicorn -b 0.0.0.0:${PORT} main:app --workers 2 --timeout 120"]
