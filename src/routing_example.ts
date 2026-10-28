import { decideRouting, GameRoutingRequest } from "./game_routing_policy.js";
import { applyRouting } from "./infrai_routing_client.js";

const request = GameRoutingRequest.parse({
  workload: "player_asset",
  capability: "ai.chat",
  action: "pin",
  provider: "openai",
  candidate_providers: ["openai", "anthropic"],
});

const change = decideRouting(request);
const routing = await applyRouting(change);

console.log(JSON.stringify({ ...change, routing }, null, 2));
