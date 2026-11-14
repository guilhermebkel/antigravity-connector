# 0011. The landing page and the logo live in the repository

Status: accepted (2026-11-14)

## Context

The project is a private Docker server with no web page of its own (ADR 0009). It still needs a page that says what it is, how to run it and what it does not do, and a logo for that page, the README and the GitHub social preview. better-caprover-mcp already solves this with a static `site/` folder, a `design/` kit and a release that stamps the version on the page.

## Decision

- `site/` is a static landing page (one HTML file, no build step) published to GitHub Pages by `.github/workflows/pages.yml` when `site/` changes on `master`. It is not part of the server and is not in the Docker image.
- `design/` keeps the logo kit and the scripts that generate it. It is not in the Docker image and not in `pnpm check`.
- The release workflow runs `scripts/site-version.mjs` to set the version and the date on the page, commits the change with the version bump, and starts the Pages workflow by hand, because a push made with the workflow token does not start other workflows.

## Consequences

- The server keeps its rule of having no web page; the page is a separate artifact.
- A release changes `package.json` and `site/` in one commit.
- Pages must be set to deploy from GitHub Actions, and the custom domain in `site/CNAME` needs a DNS record; both are done once, by the owner.
