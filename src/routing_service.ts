import { createServer, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { decideRouting, GameRoutingRequest } from "./game_routing_policy.js";
import { applyRouting, InfraiError } from "./infrai_routing_client.js";

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/routing-decisions") {
    send(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));

    const input: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const routingRequest = GameRoutingRequest.parse(input);
    const change = decideRouting(routingRequest);
    const result = await applyRouting(change);

    send(response, 200, {
      workload: change.workload,
      capability: change.capability,
      excluded_providers: change.exclude,
      decision: change.decision,
      routing: result,
    });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      send(response, 400, { error: "Invalid request body" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      send(response, status, { error: error.code, message: error.message });
      return;
    }
    send(response, 500, { error: "Routing request could not be completed" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => {
  console.log(`Game routing service listening on http://localhost:${port}`);
});
