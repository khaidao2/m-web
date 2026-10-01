# syntax=docker/dockerfile:1
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

# Tesseract with Vietnamese data for bill OCR
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-vie \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install -r requirements.txt && useradd --uid 10001 --no-create-home app && mkdir -m 755 /models

# Vietnamese persona voice: Piper vi_VN vais1000 (VAIS-1000 corpus, CC BY 4.0); pinned by checksum
ARG VOICE=https://huggingface.co/rhasspy/piper-voices/resolve/main/vi/vi_VN/vais1000/medium/vi_VN-vais1000-medium
ADD --chmod=644 --checksum=sha256:ec7c89e2c85f4d1edc24b6120c18aaf1bda614f06b511567eb9c7c0de15e2dab ${VOICE}.onnx /models/vi_VN-vais1000-medium.onnx
ADD --chmod=644 --checksum=sha256:fafb9da1354ed4b77c31af228ed41fb41cd825c14cffa105454b25e6ae751ee0 ${VOICE}.onnx.json /models/vi_VN-vais1000-medium.onnx.json

COPY alembic.ini ./
COPY migrations ./migrations
COPY scripts ./scripts
COPY app ./app

USER 10001
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
