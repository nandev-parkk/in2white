FROM node:24-bookworm-slim AS build

WORKDIR /app
RUN npm install --global pnpm@12.4.1

# 워크스페이스 매니페스트만 먼저 복사해 의존성 레이어를 소스와 분리한다.
# 루트 package.json의 prepare(husky)는 컨테이너에서 필요 없다.
ENV HUSKY=0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ui/package.json ./packages/ui/
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
RUN pnpm install --frozen-lockfile --filter frontend...

COPY packages/ui ./packages/ui
COPY frontend ./frontend
ARG VITE_API_BASE_URL
RUN test -n "$VITE_API_BASE_URL" && pnpm --filter frontend build

FROM nginx:1.28-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
