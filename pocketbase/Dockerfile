FROM alpine:3.19

ARG PB_VERSION=0.22.4

RUN apk add --no-cache ca-certificates wget unzip python3 py3-pip \
    && pip install --quiet --break-system-packages awscli

RUN wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" \
    -O /tmp/pb.zip \
    && unzip -q /tmp/pb.zip -d /pb \
    && rm /tmp/pb.zip \
    && chmod +x /pb/pocketbase

RUN mkdir -p /pb/pb_data

COPY pb_migrations /pb/pb_migrations
COPY entrypoint.sh /pb/entrypoint.sh
RUN chmod +x /pb/entrypoint.sh

EXPOSE 10000

CMD ["/pb/entrypoint.sh"]
