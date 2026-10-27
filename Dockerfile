FROM node:20-alpine
ENV NODE_ENV=production DATA_DIR=/app/data
WORKDIR /app
COPY package.json server.js ai.js seed.json ./
COPY public ./public
# Coolify: Persistent Storage එකක් /app/data එකට mount කරන්න — එතකොට deploy කළාට ලිස්ට් එක මැකෙන්නේ නැහැ
RUN mkdir -p /app/data
VOLUME ["/app/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
