# MaaNikki Website

- This repository contains the static MaaNikki website. The software repository is `architect9331/MaaNikki`.
- Do not use the frontend-design skill. Preserve the pastel visual identity and concise MAA-style Chinese writing.
- The manual, screenshots, and application icon remain in the software repository. Read them through `MAANIKKI_SOURCE_DIR` or `.upstream/`; do not create a second maintained copy here.
- Do not create, modify, delete, or run tests without specific user authorization. Source checks, builds, and visual inspection are allowed.
- `npm ci` and `npm run build` produce `dist/`. Do not commit generated output, upstream checkouts, credentials, or dependencies.
- Website changes deploy through GitHub Pages. No desktop-client rebuild is needed.
- When interacting with Cloudflare, use the cf CLI unless this project has a Wrangler configuration file.
