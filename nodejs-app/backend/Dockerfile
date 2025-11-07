FROM node:lts

# Set working directory
WORKDIR /app

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

