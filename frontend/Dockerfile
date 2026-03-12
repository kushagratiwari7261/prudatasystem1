# frontend/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all source code
COPY . .

# Build the app for production (optional - comment out for development)
# RUN npm run build

# Expose port 3005
EXPOSE 3005

# Start the app
CMD ["npm", "start"]