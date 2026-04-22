# GitHub Releases Strategy

Sori is now prepared for a release-driven update flow even if the repository is not published yet.

## Release Model

- Use semantic tags: `v1.0.0`, `v1.1.0`, `v1.1.1`
- Keep `main` deployable
- Treat GitHub Releases as the public install/update reference

## Recommended Release Process

1. merge to `main`
2. verify:
   - backend build
   - web build
   - smoke gate
   - Caddy validation
3. create and push a tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

4. publish a GitHub Release for that tag
5. reference that tag in install/update commands:

```bash
sudo bash install.sh --repo-url https://github.com/<owner>/<repo>.git --ref v1.0.0
sudo bash update.sh --ref v1.0.0
```

## Why this works

- installs are reproducible because they can target a fixed git tag
- updates can stay conservative and explicit
- release notes can map changes to operational impact

## Suggested Release Assets

Attach or reference:

- `install.sh`
- `update.sh`
- `.env.example`
- `docker-compose.yml`
- `docker-compose.production.yml`
- `infrastructure/caddy/Caddyfile.production`
- `infrastructure/livekit.production.yaml`
- `docs/DEPLOYMENT.md`

## What is already wired

- release notes categories via [`.github/release.yml`](../.github/release.yml)
- GitHub build workflow via [`.github/workflows/build.yml`](../.github/workflows/build.yml)
- install/update scripts already accept a target git ref, so they work with branches today and release tags later
