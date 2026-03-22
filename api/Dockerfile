FROM python:3.11-slim

WORKDIR /app

# Install app dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download NLTK data at build time (not runtime)
RUN python -c "import nltk; nltk.download('punkt', quiet=True); nltk.download('punkt_tab', quiet=True)"

# Copy source
COPY . .

EXPOSE 8000

CMD uvicorn api:app --host 0.0.0.0 --port ${PORT:-8000}
