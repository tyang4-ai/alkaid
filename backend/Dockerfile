FROM python:3.13-slim

WORKDIR /app

# Copy requirements first for layer caching
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the full project (needed for ai-training imports)
COPY shared/ ./shared/
COPY ai-training/ ./ai-training/
COPY backend/ ./backend/

WORKDIR /app/backend

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
