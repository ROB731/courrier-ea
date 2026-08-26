FROM node:22-slim

RUN set -eux; \
    rm -rf /var/lib/apt/lists/*; \
    for attempt in 1 2 3; do \
      apt-get update \
      && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends --fix-missing -o Acquire::Retries=3 \
        ca-certificates \
        fonts-crosextra-carlito \
        fonts-dejavu-core \
        fonts-liberation \
        libreoffice-writer \
        python3 \
        python3-venv \
      && break; \
      rm -rf /var/lib/apt/lists/*; \
      if [ "$attempt" = "3" ]; then exit 1; fi; \
      sleep 3; \
    done; \
    python3 -m venv /opt/courrier-ea-venv \
    && /opt/courrier-ea-venv/bin/pip install --no-cache-dir python-docx openpyxl pypdf \
    && rm -rf /var/lib/apt/lists/*

ENV PATH="/opt/courrier-ea-venv/bin:${PATH}"
WORKDIR /app
COPY . .
RUN npm install -g corepack@latest && corepack pnpm install && corepack pnpm run build
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
