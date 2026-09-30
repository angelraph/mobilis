# Mobilis public demo ledger: a Canton sandbox with the Mobilis Daml model,
# the four demo parties and an empty agreement, and the interface served at
# /ui/. Shared by everyone who opens it, and reset to a clean start every
# RESET_HOURS. Needs about 2 GB of memory (two JVMs).
#
#   docker build -t mobilis-demo .
#   docker run -p 7575:7575 mobilis-demo
#   open http://localhost:7575/ui/demo-wall.html
FROM eclipse-temurin:17-jdk-jammy

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl unzip ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ENV DAML_SDK_VERSION=2.10.6
RUN curl -sSL https://get.daml.com/ | sh -s "$DAML_SDK_VERSION"
ENV PATH="/root/.daml/bin:${PATH}"

WORKDIR /app
COPY daml ./daml
COPY ui ./ui
COPY scripts ./scripts

# Build once at image time so a restart only has to start the ledger.
RUN cd daml && daml build && cd .. && MOBILIS_HOSTED=true sh scripts/generate-config.sh

ENV JSON_API_ADDRESS=0.0.0.0 \
    MOBILIS_HOSTED=true \
    RESET_HOURS=6 \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=40"

EXPOSE 7575
CMD ["sh", "scripts/hosted-ledger.sh"]
