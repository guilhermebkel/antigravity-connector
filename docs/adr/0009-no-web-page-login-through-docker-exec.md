# 0009. No web page: the login link is in the logs and the code goes through docker exec

Status: accepted (2026-11-14)

## Context

`agy` needs a Google login. When there is no session it prints a login link and waits for an authorization code. The server is personal, runs on localhost and has no other user.

## Decision

The server has no web page and no UI. The login link appears in the container logs, and the owner enters the authorization code with `docker exec -it <container> agy`. `/health` reports whether the session is connected, as seen by a real `agy` check.

## Consequences

- No login form to build, secure or keep up to date, and no session cookie.
- The "connected" state is never set by configuration; only a real check sets it.
- Documentation of the login flow lives in the README.
