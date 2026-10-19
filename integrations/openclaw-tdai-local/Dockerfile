FROM node@sha256:14078204b6bb268c107ceff6d3c43f45a888105e5c2b18b14c32b3409d93a1b0
WORKDIR /opt/runtime
RUN npm install --ignore-scripts --omit=dev --no-audit --no-fund openclaw@2026.10.4 @tencentdb-agent-memory/memory-tencentdb@1.0.3 \
 && mkdir -p /home/node/.openclaw /home/node/workspace \
 && chown -R node:node /home/node/.openclaw /home/node/workspace
ENV PATH="/opt/runtime/node_modules/.bin:${PATH}"
ENV OPENCLAW_STATE_DIR=/home/node/.openclaw OPENCLAW_CONFIG_PATH=/run/openclaw.json
# Complete only the host package lifecycle; never run the third-party patch script.
RUN node /opt/runtime/node_modules/openclaw/scripts/postinstall-bundled-plugins.mjs
RUN mkdir -p /home/node/config && chown node:node /home/node/config && chmod 700 /home/node/config
USER 1000:1000
WORKDIR /home/node/workspace
CMD ["openclaw", "gateway", "run", "--port", "18789"]
