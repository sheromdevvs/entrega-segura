FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3025
ENV STORE_DIR=/app/data
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json /app/next.config.ts ./
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
EXPOSE 3025
VOLUME ["/app/data"]
CMD ["npm", "start"]
