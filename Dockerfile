# Use the official Playwright image — browsers pre-installed, no extra setup needed
FROM mcr.microsoft.com/playwright:v1.58.2-noble

WORKDIR /app

# Install only the @playwright/test package (browsers already in the image)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy test files
COPY playwright.config.ts ./
COPY tests/ ./tests/

# Default: run all tests with a line reporter (CI-friendly)
CMD ["npx", "playwright", "test", "--reporter=line"]
