# Specify the AWS SAM Node.js 20.x build image
ARG IMAGE=public.ecr.aws/sam/build-nodejs20.x
FROM $IMAGE

# Install pnpm 9.12.3
RUN npm install --global pnpm@9.12.3

# Install typescript
RUN npm install --global typescript

# Install esbuild with a specific version
ARG ESBUILD_VERSION=0.21
RUN npm install --global --unsafe-perm=true esbuild@$ESBUILD_VERSION

# Ensure all users can write to npm cache
RUN mkdir /tmp/npm-cache && \
  chmod -R 777 /tmp/npm-cache && \
  npm config --global set cache /tmp/npm-cache

# Ensure all users can write to pnpm cache
RUN mkdir /tmp/pnpm-cache && \
  chmod -R 777 /tmp/pnpm-cache && \
  pnpm config --global set store-dir /tmp/pnpm-cache

# Disable npm update notifications
RUN npm config --global set update-notifier false

# Create a non-root user and change permissions for execution
RUN /sbin/useradd -u 1000 user && chmod 711 /

# Set the default command to esbuild
CMD [ "esbuild" ]
