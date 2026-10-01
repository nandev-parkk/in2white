FROM node:24-bookworm-slim

WORKDIR /app
RUN npm install --global pnpm@12.4.1

# 워크스페이스 매니페스트만 먼저 복사해 의존성 레이어를 소스와 분리한다.
ENV HUSKY=0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ui/package.json ./packages/ui/
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
RUN pnpm install --frozen-lockfile --filter backend...

COPY backend ./backend
RUN pnpm --filter backend build

ENV NODE_ENV=production PORT=4000
WORKDIR /app/backend
USER node
EXPOSE 4000
CMD ["node", "dist/server.js"]
