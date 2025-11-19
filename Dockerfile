FROM node:22-alpine AS base

FROM base AS builder

RUN apk add --no-cache gcompat
WORKDIR /app

COPY package*json tsconfig.json src ./
COPY db-init ./db-init

RUN npm ci && \
    npm run build && \
    npm prune --production

FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 hono

COPY --from=builder --chown=hono:nodejs /app/node_modules /app/node_modules
COPY --from=builder --chown=hono:nodejs /app/dist /app/dist
COPY --from=builder --chown=hono:nodejs /app/package.json /app/package.json
COPY --from=builder --chown=hono:nodejs /app/db-init /app/db-init

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Database Configuration
ENV DB_HOST=localhost
ENV DB_PORT=5432
ENV DB_NAME=your_database_name
ENV DB_USER=your_username
ENV DB_PASSWORD=your_password

# AWS S3 Configuration
ENV AWS_REGION=us-east-1
ENV AWS_ACCESS_KEY_ID=your_aws_access_key_id
ENV AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
ENV AWS_S3_BUCKET=your_s3_bucket_name

# AWS Cognito Configuration
ENV COGNITO_USER_POOL_ID=your_cognito_user_pool_id
ENV COGNITO_CLIENT_ID=your_cognito_client_id
ENV COGNITO_REGION=your_cognito_region

USER hono
EXPOSE 3000

CMD ["node", "/app/dist/index.js"]