FROM node:24-bookworm-slim

WORKDIR /app/backend
RUN npm install --global pnpm@12.4.1

ENV HUSKY=0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

ENV NODE_ENV=production PORT=4000
USER node
EXPOSE 4000
CMD ["node", "dist/server.js"]
