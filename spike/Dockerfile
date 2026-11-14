# Throwaway spike image (issue #2). Not the production image (issue #19).
# Goal: run the official Antigravity CLI (`agy`) inside a container and record how it behaves there.
FROM node:22-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends bash ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

# A non-root user, so the CLI keeps its login under a home directory that a volume can mount.
RUN useradd --create-home --shell /bin/bash agy \
 && mkdir -p /home/agy/.gemini && chown agy:agy /home/agy/.gemini
# The named volume copies this directory's owner on first mount, so agy can write its login.
USER agy
WORKDIR /home/agy

# Fail the build when the installer fails (a bare pipe would hide a curl error).
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Installer from the issue #2 brief.
RUN curl -fsSL https://antigravity.google/cli/install.sh | bash \
 && test -x /home/agy/.local/bin/agy

# `docker exec` does not read ~/.bashrc, so put agy on the PATH for every process.
ENV PATH="/home/agy/.local/bin:${PATH}"

# Keep the container alive so the owner can `docker exec -it <container> agy` for the login.
CMD ["sleep", "infinity"]
