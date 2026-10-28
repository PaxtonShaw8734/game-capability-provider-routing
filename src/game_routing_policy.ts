import { z } from "zod";

const ProviderName = z.string().trim().min(1);

const RoutingTarget = z.object({
  workload: z.enum(["player_asset", "live_event", "moderation_queue"]),
  capability: z.literal("ai.chat"),
});

const PinPolicy = RoutingTarget.extend({
  action: z.literal("pin"),
  provider: ProviderName,
  candidate_providers: z.array(ProviderName).min(2),
});

const ExcludePolicy = RoutingTarget.extend({
  action: z.literal("exclude"),
  provider: ProviderName,
});

export const GameRoutingRequest = z
  .discriminatedUnion("action", [PinPolicy, ExcludePolicy])
  .superRefine((request, context) => {
    if (
      request.action === "pin" &&
      !request.candidate_providers.includes(request.provider)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["provider"],
        message: "provider must be included in candidate_providers",
      });
    }
  });

export type GameRoutingRequest = z.infer<typeof GameRoutingRequest>;

export type RoutingChange = {
  workload: GameRoutingRequest["workload"];
  capability: string;
  exclude: string[];
  decision: string;
};

export function decideRouting(request: GameRoutingRequest): RoutingChange {
  const exclude =
    request.action === "exclude"
      ? [request.provider]
      : [...new Set(request.candidate_providers)].filter(
          (provider) => provider !== request.provider,
        );

  const decision =
    request.action === "exclude"
      ? `Exclude ${request.provider} from ${request.workload}`
      : `Pin ${request.workload} to ${request.provider} among the declared candidates`;

  return {
    workload: request.workload,
    capability: request.capability,
    exclude,
    decision,
  };
}
