FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY src/ ./src/
COPY drizzle/ ./drizzle/
EXPOSE 3000
CMD ["node", "--import", "tsx", "src/index.ts"]
