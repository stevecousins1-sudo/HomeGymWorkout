FROM alpine:3.19

ARG PB_VERSION=0.22.4

RUN apk add --no-cache ca-certificates wget unzip

RUN wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" \
    -O /tmp/pb.zip \
    && unzip -q /tmp/pb.zip -d /pb \
    && rm /tmp/pb.zip \
    && chmod +x /pb/pocketbase

# Create data dir in the image; Render will overlay the persistent disk here
RUN mkdir -p /pb/pb_data

COPY pb_migrations /pb/pb_migrations

EXPOSE 10000

# Render sets PORT=10000; --migrationsDir tells PocketBase where to find migrations
CMD sh -c "/pb/pocketbase serve \
    --http=0.0.0.0:${PORT:-10000} \
    --dir=/pb/pb_data \
    --migrationsDir=/pb/pb_migrations"
