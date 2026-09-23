FROM oven/bun:1

WORKDIR /app

COPY dist ./dist
COPY node_modules ./node_modules
COPY package.json ./package.json
COPY server-node.mjs ./server-node.mjs

EXPOSE 3000

CMD ["bun", "server-node.mjs"]
