FROM mcr.microsoft.com/playwright:v1.48.0-jammy

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application source code
COPY . .

# Create directory for cookies and data persistence
RUN mkdir -p cookies data logs

# Expose port
EXPOSE 3500

# Set default environment variables
ENV PORT=3500
ENV HEADLESS=true
ENV NODE_ENV=production

# Start REST API server & Autonomous Engine
CMD ["node", "src/server/app.js"]
