FROM node:22-alpine AS build
WORKDIR /app
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_APP_NAME
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
COPY package*.json ./
RUN npm ci
COPY tsconfig.json next.config.ts postcss.config.mjs eslint.config.mjs components.json proxy.ts ./
COPY app ./app
COPY components ./components
COPY lib ./lib
COPY public ./public
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3001
ENV PORT=3001
CMD ["node", "server.js"]
