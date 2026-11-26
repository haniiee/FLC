FROM node:20-bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/tsconfig/package.json packages/tsconfig/
COPY packages/eslint-config/package.json packages/eslint-config/
RUN pnpm install --frozen-lockfile --filter @app/api...

COPY packages/shared-types packages/shared-types
COPY packages/tsconfig packages/tsconfig
COPY apps/api apps/api

WORKDIR /app/apps/api
ENV NODE_ENV=production
ENV FFMPEG_PATH=ffmpeg
ENV FFPROBE_PATH=ffprobe
EXPOSE 10000
CMD ["pnpm", "exec", "tsx", "src/index.ts"]
