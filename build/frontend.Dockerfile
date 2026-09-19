# Stage 1: Build React App
FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS builder

WORKDIR /app
# Context is repository root
COPY apps/web-app/package*.json ./
RUN npm install

COPY apps/web-app/ ./
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine@sha256:62ff2089abf5a9ed33bd232895bef5e22f7bb4b200675cec49a5ebc48e3d4ac8

# Copy custom nginx config
COPY build/nginx/nginx.conf /etc/nginx/nginx.conf

# Copy built static files
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
