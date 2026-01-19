# Use Alpine-based Node.js image for minimal attack surface
FROM node:20-alpine

# Accept build args for deployment version
ARG APP_VERSION=stable
ARG DEPLOYMENT_STRATEGY=standard

# Set environment variables
ENV APP_VERSION=$APP_VERSION
ENV DEPLOYMENT_STRATEGY=$DEPLOYMENT_STRATEGY
ENV NODE_ENV=production
ENV PORT=3000

# Set working directory inside container
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy the rest of the code
COPY . .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Expose the port the app runs on
EXPOSE 3000

# Run the app
CMD ["node", "app.js"]
