FROM node:24-bookworm-slim AS build

WORKDIR /app
RUN npm install --global pnpm@12.4.1

# 의존성 매니페스트를 먼저 복사해 의존성 설치를 소스와 분리한다.
# 루트 package.json의 prepare(husky)는 컨테이너에서 필요 없다.
ENV HUSKY=0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ui/package.json ./packages/ui/
COPY admin/package.json ./admin/
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
RUN pnpm install --frozen-lockfile --filter admin...

COPY packages/ui ./packages/ui
COPY admin ./admin
ARG VITE_API_BASE_URL
RUN test -n "$VITE_API_BASE_URL" && pnpm --filter admin build

FROM nginx:1.28-alpine
COPY admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/admin/dist /usr/share/nginx/html
EXPOSE 80
