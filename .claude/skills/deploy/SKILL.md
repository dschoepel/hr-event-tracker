---
name: deploy
description: Deploy a specific version of __APP_NAME__ to the VPS after GitHub Actions has built the image. Usage: /deploy [v1.2.0]
disable-model-invocation: true
---

You are executing the `/deploy` skill for __APP_NAME__.

$ARGUMENTS contains the version tag to deploy (e.g. `v1.2.0`). If empty, read the version from `VERSION.md`.

## Steps

1. **Determine tag**: Use `$ARGUMENTS` if provided, otherwise `cat VERSION.md | tr -d '[:space:]'`.

2. **Verify tag exists locally**: `git tag -l <tag>` — must return the tag. If not, stop: "Tag <tag> not found. Run `/release` first."

3. **Verify tag is pushed**: `git ls-remote --tags origin refs/tags/<tag>` — must return output. If not, stop: "Tag <tag> not pushed to remote. Run `git push --tags`."

4. **Show GitHub Actions URL**: Print:
   ```
   GitHub Actions: https://github.com/__GITHUB_USER__/__APP_NAME__/actions
   ```
   Ask the user: "Has the build for <tag> completed successfully? (yes/no)"
   If no, stop here. The image must be built before deploying.

5. **Load VPS config**: Read `.env.deploy` for VPS_HOST, SSH_USER, APP_NAME, DOMAIN.
   If `.env.deploy` doesn't exist, stop: "Create .env.deploy from .env.deploy.example with your VPS details."

6. **Run deploy script on VPS**:
   ```bash
   ssh <SSH_USER>@<VPS_HOST> 'bash -s' < deploy/scripts/deploy.sh <tag>
   ```
   Stream the output. If exit code is non-zero, report the error and stop.

7. **Tail logs** (brief check):
   ```bash
   ssh <SSH_USER>@<VPS_HOST> 'docker logs <APP_NAME> --tail 20'
   ```

8. **Smoke test**:
   ```bash
   curl -sf https://<DOMAIN>/api/health
   ```
   Report the response.

9. **Report success**:
   ```
   ✓ __APP_NAME__ <tag> deployed to https://<DOMAIN>
   ```

## If deploy fails
- Maintenance mode will remain ON (deploy.sh is safe-fail)
- Check: `ssh <SSH_USER>@<VPS_HOST> 'docker logs <APP_NAME> --tail 50'`
- To restore previous version: `ssh <SSH_USER>@<VPS_HOST> 'cd <DEPLOY_PATH> && docker compose up -d --no-deps app && rm -f <MAINTENANCE_FLAG>'`
