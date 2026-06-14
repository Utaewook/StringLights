# Stage 1: Build React App
FROM node:20-alpine AS builder

WORKDIR /app
# Context is repository root
COPY apps/web-app/package*.json ./
RUN npm install

COPY apps/web-app/ ./
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy custom nginx config
COPY build/nginx/nginx.conf /etc/nginx/nginx.conf

# Copy built static files
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
