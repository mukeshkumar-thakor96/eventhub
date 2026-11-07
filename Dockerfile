# Playwright test runner for EventHub.
# The official image ships Node + Chromium + all OS deps, so the host needs only Docker.
# Keep this tag in sync with @playwright/test in package-lock.json.
FROM mcr.microsoft.com/playwright:v1.58.2-noble

WORKDIR /app

# CI=true: forbid test.only, and stop the HTML reporter from trying to open/serve the report
ENV CI=true \
    PLAYWRIGHT_HTML_OPEN=never

# Install only the test dependencies (browsers are already in the image)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts && npm cache clean --force

# Bake tests into the image so it also works standalone (compose mounts live copies over these)
COPY playwright.config.ts ./
COPY tests/ ./tests/

# Extra CLI args are appended, e.g. `docker compose run --rm tests -g "booking"`
ENTRYPOINT ["npx", "playwright", "test"]
CMD ["--reporter=list,html"]
