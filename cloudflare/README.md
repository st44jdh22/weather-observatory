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

## 17 October 2026 — IT independent-review remediation (CHANGES REQUIRED)

**Production deployment is ON HOLD; this PR is draft and has not been merged.**

Source modifications on the review branch:

- Health check sends the permitted `Origin: https://st44jdh22.github.io` header on the successful /metar request and separately requires HTTP 403 without Origin. An Origin header is *not* strong authentication: it can be supplied by non-browser clients.
- The existing website POST briefing endpoint is **/**; it remains available after access-code verification. POST to any other path is rejected. Parsed JSON must be an object, not null, array or primitive.
- AI Captain instructions flag selected destinations whose straight-line minimum exceeds the operating radius; do not call straight routes over land navigable; do not claim east-facing shorelines sheltered in strong easterlies. Retains safeguards against fictitious weather, unsupported AEMET warnings and invented forecast confidence.
- Forecast and AI upstream error responses no longer expose raw upstream errors/status.
- Required secret references `AEMET_API_KEY`, `OPENAI_API_KEY`, `ARA_ACCESS_CODE`, `AI_USAGE`, optional `OPENAI_MODEL` and weather GET endpoints remain. No secret *values* are committed.
- New non-production PR checks `.github/workflows/ara-worker-review.yml` and Node tests in `cloudflare/tests/worker.test.mjs`. Tests mock providers and credentials: they do **not** establish production availability, actual Cloudflare configuration, or rollback readiness.
- GitHub deployment workflow now runs local tests before any Cloudflare action.

**Unresolved, mandatory clearance blockers:**

1. Verify current **live Cloudflare Worker source/version**, and obtain retrievable backup plus version/deployment ID. The original RTF export is not sufficient proof of present production state.
2. Replace `REPLACE_EXISTING_AI_USAGE_KV_NAMESPACE_ID` with the **verified existing namespace ID**, not a guess. Independently compare live compatibility date/flags, all secret names, plain vars, KV bindings, routes, triggers, workers.dev settings and account/target. Preserve all existing settings and secret values in Cloudflare.
3. Read back GitHub `ara-production` environment required reviewers, allowed branch and token scope through authorised controls. Declaring `environment: ara-production` in YAML does not prove GitHub's reviewer settings are active.
4. **Concurrency:** existing `AI_USAGE` KV get-then-put is non-atomic and eventually consistent. A nominal 30/day ceiling can be exceeded by concurrent requests. Agree and verify an atomic limiter (such as a Durable Object) or obtain independent IT acceptance of documented residual risk before production approval. No new binding has been provisioned.
5. The weather GET endpoints rely on an Origin check (not authentication) and present no edge rate limit. Evaluate abuse controls and provider/API quotas before rollout. Public caching headers do not in themselves enforce rate limits. Also note soft KV quota is consumed before successful OpenAI output.
6. Verify actual GitHub Actions execution and conclusion for the new CI tests; local mocked tests alone are not evidence of a Cloudflare staging deploy.
7. Rollback is **documented but not verified**: before deployment, save a recoverable current Cloudflare version and source/config snapshot in private authorised storage, verify it can be retrieved, then establish the Cloudflare rollback/version restoration steps with readbacks. Do not claim a tested rollback until performed in a permitted safe environment.

**Next clearance chain:** IT independent re-review → `APPROVE FOR DEPLOYMENT REVIEW` → Stephen's separate authorisation before merging or deploying. Never change live sites, secrets, KV, routes or Worker during this review.
