FROM node:lts

# Set working directory
WORKDIR /app

# Create data directory for persistent storage
RUN mkdir -p /app/data

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port (internal to container network)
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]

