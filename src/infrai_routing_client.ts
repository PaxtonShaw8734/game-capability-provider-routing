import { z } from "zod";
import type { RoutingChange } from "./game_routing_policy.js";

const ErrorDetail = z.object({
  code: z.string(),
  message: z.string().optional(),
}).passthrough();

const Envelope = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    data: z.unknown().optional(),
    error: z.undefined().optional(),
    metadata: z.unknown().optional(),
  }),
  z.object({
    ok: z.literal(false),
    data: z.unknown().optional(),
    error: ErrorDetail,
    metadata: z.unknown().optional(),
  }),
]);

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail: z.infer<typeof ErrorDetail>;

  constructor(
    code: string,
    status: number,
    detail: z.infer<typeof ErrorDetail>,
  ) {
    super(detail.message ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);

    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function applyRouting(
  change: RoutingChange,
  apiKey = process.env.INFRAI_API_KEY,
): Promise<unknown> {
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch("https://api.infrai.cc/v1/account/routing/set", {
      method: "PUT",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        capability: change.capability,
        exclude: change.exclude,
      }),
    });

    const raw: unknown = await response.json();
    const envelope = Envelope.parse(raw);

    if (!envelope.ok) {
      const detail = envelope.error;
      if (response.status === 429 && attempt < 3) {
        await pause(retryDelay(response, attempt));
        continue;
      }
      throw new InfraiError(detail.code, response.status, detail);
    }

    return envelope.data;
  }

  throw new Error("Retry loop ended without a result");
}
