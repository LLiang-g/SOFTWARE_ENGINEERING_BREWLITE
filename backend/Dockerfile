FROM node:24-bookworm-slim AS tools
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate

FROM tools AS build
RUN npm run build && npm prune --omit=dev --ignore-scripts

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3001
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json
USER node
EXPOSE 3001
CMD ["node", "dist/main.js"]
