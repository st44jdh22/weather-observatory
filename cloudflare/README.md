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

## 17 October 2026 — production settings confirmed by owner's Cloudflare screenshots

Screenshots reviewed, **not a live API readback**:
- Production Worker runtime compatibility date: `2026-10-16` (matches this PR's `wrangler.toml`).
- Production compatibility flags: none shown (empty field).
- Runtime placement: Default.
- Cache: Disabled.
- No cron triggers configured and no queue consumers configured in the visible settings.
- Encrypted production secret binding **names** visible: `AEMET_API_KEY`, `ARA_ACCESS_CODE`, `OPENAI_API_KEY` (values not requested).
- KV binding visible: `AI_USAGE` → `ARA_AI_USAGE`. User separately supplied 32-hex namespace ID `63e2f17382b847279244c081ffa6e3b9`, now entered into the PR Wrangler file; screenshot only verifies the namespace **name**, not that the numeric ID belongs to that name.
- Worker domains/routes, latest deployed version and independently retrievable rollback source are still NOT verified.
- No production Worker, secrets, bindings or website were changed during these checks.

**Action remaining:** inspect Worker **Domains** and production **Deployments/Versions** screens, check existing namespace ID in Cloudflare, verify GitHub environment protections, and have IT review soft KV concurrency risk. Keep draft PR unmerged until cleared.

## 17 October 2026 — production domains screenshot review

The owner's Cloudflare **Domains → Production** screenshot shows:
- `ara-sr-ai-capitan.stevehullock.workers.dev` is enabled for production.
- `*.ara-sr-ai-capitan.stevehullock.workers.dev` preview URL switch is off.
- **No custom domains or routes** appear in the table.
- Therefore the `workers_dev = true` setting in this PR corresponds to the existing production address; no custom route should be added as part of this deployment.
- This is screenshot evidence only; no Cloudflare settings were changed.

**Still pending:** verify recoverable latest production deployment/source and rollback, independently confirm GitHub environment controls, and resolve or accept the soft KV request-counter concurrency risk before deploying.

## 17 October 2026 — manual Cloudflare deployment-history screenshot

Owner-supplied production **Deployments** screenshot (21:00 UTC approximate screenshot; user local 22:00 BST):
- Active deployment version shown: `c55b402e`, **100% traffic**, manually deployed about five hours before screenshot.
- Immediately prior listed version: `aced450f`, listed **Ready**, manually deployed about six hours before screenshot.
- Several earlier versions shown Ready, including separate secret/KV-binding creation history.
- Observed panel displays **0% error rate** at screenshot time and **0 req/sec** (point-in-time only, not performance validation).
- These UI version labels are truncated; exact full version IDs, source hash, and confirmed rollback action still require verification.
- RTF export source **not yet compared with the actual code of active production version** `c55b402e`.
- No rollback or deploy action has been executed; no production changes made.

### Non-destructive rollback plan (unverified until evidence obtained)
1. Open currently deployed `c55b402e` version and record its complete version identifier. Export/retrieve source and settings into authorised private backup storage, read it back, and compare against proposed commit.
2. Verify Cloudflare **Deployments** version menu explicitly offers rollback to that exact saved version. Record whether restoring a version also restores necessary settings/bindings; do not assume it restores deleted secrets.
3. If a *separately approved* future production deployment fails: use Cloudflare's version/deployment rollback controls to restore `c55b402e` at 100% traffic; check ARA API with allowed Origin and the existing secret + KV binding names; log restored version and health results.
4. Never test rollback on production without specific user approval.

**Current release gate:** Remains on hold until live source is independently compared, exact version and rollback mechanism confirmed, GitHub approvals confirmed, and rate-limiting risk disposition recorded.

## 17 October 2026 — active production source backup and line comparison

User exported the **currently selected active** Cloudflare Worker version `c55b402e` using the Cloudflare code editor and supplied `ARA-Worker-c55b402e-backup(1).js` privately. JavaScript syntax checked successfully; source file is 27,137 UTF-8 bytes / 281 lines, with **SHA-256 `a26e2716407231e6100555ab9d0d4c2249eda1921c1b798937b3413d3f068a56`**.

**Privacy:** Backup contains a private Google Docs reference in the historic `KNOWLEDGE` string; do **not** commit or redistribute this backup in this public repository. Backup remains in the user's Mac/Desktop copy and attached privately in the authorised conversation, not the GitHub repo. No API secret values observed in source.

Independent textual line comparison against `cloudflare/worker.js` (GitHub blob `2395f826ef969e95737686c5422b7c4b2dd91dd3`) confirms **276 identical lines**, 5 deleted/replaced source lines and 14 added/replacement lines. Differences exclusively in:
- Private knowledge string replaced with generic location-safety knowledge, without private master-document URL or personal details.
- Error response from MET Norway no longer exposes detailed upstream error.
- Added POST endpoint path restriction `/`, JSON null/object guard, selected-destination distance/radius flag, and explicit explanation that KV usage counter is soft (non-atomic).
- Reduced / security-reviewed AI response instructions, preserving weather and navigation safeguards.
- OpenAI structured input includes selected-distance warning fields; provider status omitted from failed response.

**Confirmed unchanged** against operator-exported code: METAR implementation and fallback, AEMET coastal bulletin and CAP archive warning parsing, MET Norway fallback forecast, Open-Meteo wind/marine retrieval, model-agreement calculation and quick-look computations, secret/KV environment references, user-facing response schema, and existing 30-per-day soft budget logic.

**Evidence limitation:** This is a comparison against the user's export made while Cloudflare showed version `c55b402e (Active Latest)`, not an authenticated Cloudflare API content hash. Exact full Cloudflare version ID and Cloudflare rollback-menu behaviour still require readback. The local backup is a recoverable source copy, but it is not proof that restoring all production settings and secrets has been tested.

**Release gate:** Hold merge/deploy until IT verifies rollback/production settings, confirms test evidence, and Stephen separately authorises production. This entry supersedes earlier `source not yet compared` statements above.
