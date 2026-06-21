FROM node:20-alpine AS builder

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies (including devDependencies needed for build)
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the app (React frontend + Express backend)
RUN npm run build

# Use a smaller runtime image
FROM node:20-alpine

WORKDIR /app

# Copy package.json and package-lock.json for production install
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy the built output from builder
COPY --from=builder /app/dist ./dist

# Copy the sqlite database if it needs to be initialized (optional, usually created dynamically)
# Note: In production you'd likely use Cloud SQL or mount a volume for SQLite,
# but we leave it here just in case.

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["npm", "start"]
