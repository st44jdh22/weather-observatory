# ARA Worker — controlled GitHub deployment

This proposal **does not deploy** or modify the live Cloudflare Worker.

## Already configured by owner
- GitHub environment: `ara-production`
- Required reviewer: `st44jdh22`
- Allowed deployment branch: `main`
- Environment secret: `CLOUDFLARE_API_TOKEN`
- Environment variable: `CLOUDFLARE_ACCOUNT_ID`
- Cloudflare account is restricted by token scope.

## Remaining hard stops
1. Export the **current production** Worker code from Cloudflare as a raw `worker.js`. Do not substitute an archived version.
2. Verify source and full deployed settings: compatibility date, all routes, bindings, KV namespace ID, triggers, variables and secrets. Preserve current production configuration.
3. Add verified `cloudflare/worker.js` and replace the placeholder in `cloudflare/wrangler.toml` only after inspection.
4. Review and explicitly approve the changes before merging to `main`.
5. From GitHub Actions, manually run the workflow from `main` with confirmation `DEPLOY_ARA_WORKER`. The `ara-production` environment reviewer must approve the run.
6. Check Actions deployment logs and live API readback.

## Safeguards
- Manual dispatch only; no on-push deploy.
- The workflow refuses to deploy if the Worker source is missing, the KV namespace ID is unverified, the actor isn't the owner, or the branch isn't main.
- The workflow references `vars.CLOUDFLARE_ACCOUNT_ID`, not `secrets.CLOUDFLARE_ACCOUNT_ID`.
- `keep_vars` protects Cloudflare environment variables/secrets, **not all bindings**; verify bindings explicitly.
- Do not change the root `index.html` or `ara/index.html` as part of this deployment.
- This token grants Workers Scripts Edit across the selected Cloudflare account, not exclusively this one Worker.
- A provider outage can fail the post-deploy METAR check even when the Worker itself deployed; investigate logs.
