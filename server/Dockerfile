FROM node:24-bookworm-slim

WORKDIR /app
RUN npm install --global pnpm@12.4.1

# 워크스페이스 매니페스트만 먼저 복사해 의존성 레이어를 소스와 분리한다.
ENV HUSKY=0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ui/package.json ./packages/ui/
COPY client/package.json ./client/
COPY server/package.json ./server/
RUN pnpm install --frozen-lockfile --filter in2white-server...

COPY server ./server
RUN pnpm --fail-if-no-match --filter in2white-server build

ENV NODE_ENV=production PORT=10103
WORKDIR /app/server
USER node
EXPOSE 10103
CMD ["node", "dist/server.js"]
