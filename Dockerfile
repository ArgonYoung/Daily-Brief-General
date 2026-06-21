# Use Node.js LTS base image
FROM node:20-alpine

# Install system dependencies needed for better-sqlite3 and Prisma
RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

# Copy package files and Prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies so we have ts-node for seeding)
RUN npm ci

# Copy the rest of the application files
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js app
RUN npm run build

# Make start script executable
RUN chmod +x start.sh

# Expose port 3000
EXPOSE 3000

# Set environment defaults
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run start script
CMD ["./start.sh"]
