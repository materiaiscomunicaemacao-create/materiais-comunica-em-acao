FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install -g pnpm@11.25.0 && pnpm install --frozen-lockfile --prod
COPY server.js catalog.js new-products.js manus-routes.json ./
COPY server ./server
COPY public/store.js public/store.css ./public/
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
USER node
CMD ["node", "server.js"]
