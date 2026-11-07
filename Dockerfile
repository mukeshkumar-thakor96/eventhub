# Playwright test runner for EventHub: Node 22 (LTS) + Playwright with all browsers
# (Chromium, Firefox, WebKit) and their OS dependencies pre-installed.
# Used both locally (docker compose run --rm tests) and in GitHub Actions.
ARG NODE_VERSION=22
FROM node:${NODE_VERSION}-bookworm-slim

# CI=true: forbid test.only, and stop the HTML reporter from trying to open/serve the report.
# Browsers go to a fixed path so they're shared by any user running in the container.
ENV CI=true \
    PLAYWRIGHT_HTML_OPEN=never \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

# Install @playwright/test from the lockfile, then the browsers matching that exact
# version (so the image can never drift from package-lock.json), plus OS deps.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts \
 && npx playwright install --with-deps \
 && npm cache clean --force \
 && rm -rf /var/lib/apt/lists/*

# Bake tests into the image so it also works standalone (compose mounts live copies over these)
COPY playwright.config.ts ./
COPY tests/ ./tests/

# Extra CLI args are appended, e.g. `docker compose run --rm tests -g "booking"`
ENTRYPOINT ["npx", "playwright", "test"]
CMD ["--reporter=list,html"]
