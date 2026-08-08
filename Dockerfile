FROM node:20.20.2-bookworm-slim

WORKDIR /app

# Enable corepack and pin npm
RUN corepack enable && corepack prepare npm@10.9.0 --activate

# Copy manifests first for better layer caching
COPY package.json package-lock.json* ./
COPY artifacts/api-server/package.json artifacts/api-server/package.json
COPY scripts/package.json scripts/package.json
# if you have more workspace package.json files under lib/*, keep this:
COPY lib ./lib
COPY artifacts ./artifacts
COPY scripts ./scripts
COPY . .

RUN npm ci --no-audit --no-fund
RUN npm run build --workspace=@workspace/api-server

EXPOSE 10000
CMD ["npm", "run", "start", "--workspace=@workspace/api-server"]
