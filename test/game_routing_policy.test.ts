import { describe, expect, it } from "vitest";
import { decideRouting, GameRoutingRequest } from "../src/game_routing_policy.js";

describe("game routing decision", () => {
  it("pins player-generated assets by excluding every other candidate", () => {
    const request = GameRoutingRequest.parse({
      workload: "player_asset",
      capability: "ai.chat",
      action: "pin",
      provider: "openai",
      candidate_providers: ["openai", "anthropic", "openai"],
    });

    expect(decideRouting(request)).toMatchObject({
      workload: "player_asset",
      capability: "ai.chat",
      exclude: ["anthropic"],
    });
  });

  it("excludes one provider from a moderation queue", () => {
    const request = GameRoutingRequest.parse({
      workload: "moderation_queue",
      capability: "ai.chat",
      action: "exclude",
      provider: "anthropic",
    });

    expect(decideRouting(request).exclude).toEqual(["anthropic"]);
  });
});
