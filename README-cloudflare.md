# Cloudflare setup

This app now supports shared horse storage through a Cloudflare Pages Function at `/api/pferde`.

## Required binding

Create a KV namespace binding named `PFERDE` for the Pages project or Worker deployment.

## Data flow

- The browser loads horses from `/api/pferde` when available.
- If the API is unavailable, the app falls back to localStorage.
- Saving or deleting horses updates both the browser cache and the remote store when possible.

## Files

- `functions/api/pferde.js`
- `script.js`
