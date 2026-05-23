# Use node image
FROM node:20

WORKDIR /app

# Copy package.json and install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy source files
COPY . .

# Build typescript
RUN npx tsc

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "dist/index.js"]
