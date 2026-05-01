FROM node:22-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/agent-service packages/agent-service
COPY packages/agent packages/agent
COPY packages/ai packages/ai
COPY packages/tui packages/tui
COPY packages/coding-agent packages/coding-agent
COPY tsconfig.base.json ./
RUN npm ci --workspace packages/agent-service --include-workspace-root

FROM deps AS build
RUN cd packages/agent-service && npm run build

FROM node:22-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/packages/agent-service/dist ./dist
COPY --from=build /app/packages/agent-service/public ./public
COPY --from=build /app/packages/agent-service/package.json ./
COPY --from=build /app/node_modules ./node_modules

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/data/agent-service.db

EXPOSE 3000

VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', r => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

CMD ["node", "dist/index.js"]
