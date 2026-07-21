# Photo Enhancer backend — runs on any container host (Render, Cloud Run, Fly, …)
FROM python:3.11-slim

# libglib2.0-0 is needed by opencv-python-headless at runtime.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

# Hosts inject $PORT (Render, Cloud Run). Default to 8080 for local `docker run`.
ENV PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
