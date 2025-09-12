# Stage 1: Build
FROM node:22 AS builder
WORKDIR /app
COPY package.json package-lock.json* pnpm-lock.yaml* ./
RUN npm install --production=false
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:22
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY run-migrations.js ./
COPY start.sh ./
RUN chmod +x start.sh
EXPOSE 3005
CMD ["./start.sh"]