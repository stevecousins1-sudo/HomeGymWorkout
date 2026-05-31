FROM alpine:3.19

ARG PB_VERSION=0.22.4

RUN apk add --no-cache ca-certificates wget unzip

RUN wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" \
    -O /tmp/pb.zip \
    && unzip -q /tmp/pb.zip -d /pb \
    && rm /tmp/pb.zip \
    && chmod +x /pb/pocketbase

COPY pb_migrations /pb/pb_migrations

EXPOSE 8090

# Render injects PORT env var; fall back to 8090 for local dev
CMD sh -c "/pb/pocketbase serve --http=0.0.0.0:${PORT:-8090} --dir=/pb/pb_data"
