FROM node:22-slim

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      ca-certificates \
      fonts-crosextra-carlito \
      fonts-dejavu-core \
      fonts-liberation \
      libreoffice-writer \
      python3 \
      python3-venv \
    && python3 -m venv /opt/courrier-ea-venv \
    && /opt/courrier-ea-venv/bin/pip install --no-cache-dir python-docx openpyxl pypdf \
    && rm -rf /var/lib/apt/lists/*

ENV PATH="/opt/courrier-ea-venv/bin:${PATH}"
WORKDIR /app
COPY . .
RUN npm install -g corepack@latest && corepack pnpm install && corepack pnpm run build
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
