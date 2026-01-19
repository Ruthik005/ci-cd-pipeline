# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Accept build args for version
ARG VITE_APP_VERSION=stable
ARG VITE_DEPLOYMENT_STRATEGY=standard
ENV VITE_APP_VERSION=$VITE_APP_VERSION
ENV VITE_DEPLOYMENT_STRATEGY=$VITE_DEPLOYMENT_STRATEGY

RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
