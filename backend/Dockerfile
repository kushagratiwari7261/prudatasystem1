# Use official Node 20 Alpine for production optimization footprint
FROM node:20-alpine

# Set working directory inside the container
WORKDIR /app

# Copy package descriptors first to leverage Docker layer caching
COPY package.json package-lock.json* ./

# Install only production dependencies cleanly
RUN npm ci --only=production

# Copy all remaining source files into the image
COPY . .

# Expose the API port
EXPOSE 5000

# Docker-level healthcheck using busybox wget
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:5000/health || exit 1

# Start the Node.js server
CMD ["node", "server.js"]
