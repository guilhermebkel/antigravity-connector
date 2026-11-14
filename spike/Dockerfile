# Throwaway spike image (issue #2). Not the production image (issue #19).
# Goal: run the official Antigravity CLI (`agy`) inside a container and record how it behaves there.
FROM node:22-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends bash ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

# A non-root user, so the CLI keeps its login under a home directory that a volume can mount.
RUN useradd --create-home --shell /bin/bash agy
USER agy
WORKDIR /home/agy

# Installer from the issue #2 brief. Not verified by a build in this PR: run `docker build` once to confirm.
RUN curl -fsSL https://antigravity.google/cli/install.sh | bash

# Keep the container alive so the owner can `docker exec -it <container> agy` for the login.
CMD ["sleep", "infinity"]
