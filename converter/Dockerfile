FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /service
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY worker.mjs ./
USER node
CMD ["node", "worker.mjs"]
