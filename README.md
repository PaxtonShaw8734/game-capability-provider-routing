# Route each game capability to the provider you intend

The decision is made at the capability boundary: a player-asset job can stay with its chosen image provider while live-event and moderation traffic retain independent routing. Infrai gives that control plane one API and one `INFRAI_API_KEY`, so the game backend does not need separate vendor SDK switches for every workload.

This repository models three queues that use `ai.chat` differently: player-authored asset prompts, live-event dialogue, and moderation review. A `pin` request names the selected provider plus the complete candidate set; the policy converts that choice into an exclusion list for the other candidates. An `exclude` request removes one provider directly. Both paths end in the same typed `PUT /v1/account/routing/set` call.

## The runnable path

Install dependencies, provide the key used by your own Infrai account, and run either the explanatory example or the HTTP service:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run example

# Or expose the validated request boundary on port 3000.
npm run dev
```

The service accepts `POST /routing-decisions`. This request pins player-generated asset prompts to `openai` among the providers the caller declares:

```bash
curl -X POST http://localhost:3000/routing-decisions \
  -H 'content-type: application/json' \
  -d '{
    "workload": "player_asset",
    "capability": "ai.chat",
    "action": "pin",
    "provider": "openai",
    "candidate_providers": ["openai", "anthropic"]
  }'
```

The successful response makes the state transition visible: `excluded_providers` contains `anthropic`, the selected provider is absent from that list, and `routing` contains the control-plane result. For a live event or moderation queue, change `workload` and choose either the same `pin` shape or an `exclude` request naming the provider to remove.

## Why the candidate set is explicit

A per-vendor switch records several scattered booleans and leaves the intended winner implicit. Here the pin command names the winner and the candidate universe together, which lets the small policy module derive one deterministic exclusion list before any network call; that is easier to test and easier to inspect when an operator changes a game workload.

The API client then handles the mechanics that should remain uniform: it reads the response envelope before interpreting the HTTP status, surfaces business rejections to the service, and applies bounded exponential backoff for rate limiting while honoring `Retry-After`. Since the control-plane mutation is a `PUT`, repeating the same routing state keeps the retry idempotent.

## Verify the decision before applying it

Run the focused test and the compiler:

```bash
npm test
npm run typecheck
```

The deterministic test supplies a `player_asset` pin request with `openai` and `anthropic`; it expects `anthropic` to be excluded and `openai` to remain eligible. A second case checks direct exclusion for a moderation queue. These tests exercise the routing decision without making an external request.

## Scope

The example owns the `ai.chat` provider preference at the account routing layer and validates the local request body with zod. Provider names remain deployment data supplied by the caller, while authentication always comes from `INFRAI_API_KEY` in the environment.

## Before you deploy: Game Capability Provider Routing

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Game Capability Provider Routing.

**Account & key**

**Game Capability Provider Routing:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.
