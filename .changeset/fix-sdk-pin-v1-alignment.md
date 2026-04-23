---
"keyquill": patch
"keyquill-mobile": patch
"keyquill-relay": patch
---

Fix broken demo + docs that pinned `keyquill@2` — the capability-first
"v2 API" actually ships as `keyquill@1.x` on npm. The changesets major
bump from `0.3.2` landed at `1.0.0`, not `2.0.0`, so `esm.sh/keyquill@2`
returns 404 and the demo site was stuck on "Checking for extension…".

- `docs/demo/index.html` + `docs/demo/README.md`: CDN pin `@2` → `@1`
- SDK README: migration section rewritten as `@0.3.x → @1` with a
  disambiguation note explaining that the "v1 / v2 API" product labels
  and the npm semver major version are independent axes
- Extension README / SUBMISSION.md / submission listing copy and
  relay README: every stale `keyquill@2` reference swapped to `@1.x`
- `streamManager.ts` source comment updated for consistency

No runtime code change — the wire protocol already supported both v1
and v2 shapes since Phase 10. Only the install instructions were wrong.
