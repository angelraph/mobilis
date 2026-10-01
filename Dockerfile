# Mobilis public demo ledger on Canton 3.x: a Canton sandbox with the
# Mobilis contracts, the four demo parties and an empty agreement, and the
# interface served at /ui/ by scripts/serve-ui.js (which also forwards
# ledger calls to the JSON Ledger API v2). Shared by everyone who opens it,
# and reset to a clean start every RESET_HOURS. Needs about 2 GB of memory.
#
#   docker build -t mobilis-demo .
#   docker run -p 7575:7575 mobilis-demo
#   open http://localhost:7575/ui/demo-wall.html
FROM eclipse-temurin:21-jdk-jammy

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl unzip ca-certificates nodejs \
 && rm -rf /var/lib/apt/lists/*

# The Canton 3.x SDK (dpm). The installer puts it under the home directory.
RUN curl -sSL https://get.digitalasset.com/install/install.sh | sh
ENV PATH="/root/.dpm/bin:/root/.local/bin:${PATH}"

WORKDIR /app
COPY multi-package.yaml ./
COPY daml ./daml
COPY daml-test ./daml-test
COPY ui ./ui
COPY scripts ./scripts

# Build once at image time so a restart only has to start the ledger.
RUN dpm build --all && MOBILIS_HOSTED=true sh scripts/generate-config.sh

ENV UI_HOST=0.0.0.0 \
    MOBILIS_HOSTED=true \
    RESET_HOURS=6 \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=60"

EXPOSE 7575
CMD ["sh", "scripts/hosted-ledger.sh"]
