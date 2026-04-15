# Imagen oficial: evita Node 22.11 (Prisma 7.7 exige ^22.12) que a veces resolvía Nixpacks.
FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# prisma.config.ts usa env("DIRECT_URL"); generate no conecta, solo necesita URL válida.
ENV DIRECT_URL=postgresql://build:build@127.0.0.1:5432/build

COPY package.json package-lock.json tsconfig.base.json prisma.config.ts ./
COPY prisma ./prisma
COPY scripts ./scripts
COPY apps ./apps
COPY packages ./packages

RUN node scripts/railway-prebuild.mjs
RUN npm ci
RUN npm run build:api

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "run", "start:api"]
