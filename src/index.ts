#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListResourcesRequestSchema, ListToolsRequestSchema, ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CARDS, SPREADS, SUIT_ELEMENT, findCard } from "./deck.js";
import { DrawError, draw } from "./draw.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** The card pictures: deck/ beside src/ and dist/. */
export const DECK_DIR = path.resolve(HERE, "..", "deck");

const TOOLS = [
  {
    name: "draw_cards",
    description:
      "Shuffle the Rider-Waite-Smith deck and deal a spread for the user's question. Returns each position's name and what it asks, " +
      "the card dealt there, whether it is reversed, its keywords and its meaning that way up, and where its picture is. " +
      "Read the cards together, in the light of the question and of each position, rather than listing keywords: say what the " +
      "spread as a whole suggests, name the cards and positions as you go, and treat a reversal as a shading of the card, not its opposite. " +
      "Spreads: single (one card), three (past, present, future), situation (situation, obstacle, advice), celtic-cross (ten cards), " +
      "or a number from 1 to 21 for a plain row. Draw once per question; use the seed to deal the same reading again.",
    inputSchema: {
      type: "object" as const,
      properties: {
        spread: { type: "string", description: "single, three, situation, celtic-cross, or a number of cards. Default single." },
        question: { type: "string", description: "The user's question, as they put it." },
        reversals: { type: "boolean", description: "Whether cards may fall reversed. Default true." },
        seed: { type: "integer", description: "Deal the same reading again: the seed from an earlier draw." },
      },
    },
    annotations: { title: "Draw tarot cards", readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "card_meaning",
    description:
      "Look up one card of the Rider-Waite-Smith deck by name (\"The Tower\", \"queen of cups\", \"3 of swords\") or id: its keywords and " +
      "meaning upright and reversed, and what is in Pamela Colman Smith's picture. For a card already dealt, the draw's own text is usually enough.",
    inputSchema: {
      type: "object" as const,
      properties: { card: { type: "string", description: "The card's name or id." } },
      required: ["card"],
    },
    annotations: { title: "A card's meaning", readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "list_spreads",
    description: "The spreads draw_cards can deal, with each position's name and what it asks.",
    inputSchema: { type: "object" as const, properties: {} },
    annotations: { title: "The spreads", readOnlyHint: true, openWorldHint: false },
  },
];

const text = (value: unknown) => ({ content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] });
const failure = (message: string) => ({ content: [{ type: "text" as const, text: message }], isError: true });

export function createServer(deckDir = DECK_DIR): Server {
  const server = new Server({ name: "tarot-mcp", version: "0.1.0" }, { capabilities: { tools: {}, resources: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;
    try {
      switch (request.params.name) {
        case "draw_cards": {
          const spread = typeof args.spread === "number" ? args.spread : typeof args.spread === "string" ? args.spread : undefined;
          const question = typeof args.question === "string" ? args.question : undefined;
          const reversals = typeof args.reversals === "boolean" ? args.reversals : undefined;
          const seed = typeof args.seed === "number" && Number.isInteger(args.seed) ? args.seed : undefined;
          const reading = draw({ ...(spread !== undefined ? { spread } : {}), ...(question !== undefined ? { question } : {}), ...(reversals !== undefined ? { reversals } : {}), ...(seed !== undefined ? { seed } : {}) });
          return text(reading);
        }
        case "card_meaning": {
          const card = findCard(String(args.card ?? ""));
          if (!card) return failure(`No card called "${String(args.card ?? "")}". Try a name like "The Star" or "seven of pentacles".`);
          return text({ ...card, element: card.suit ? SUIT_ELEMENT[card.suit] : null, image: `tarot://card/${card.id}` });
        }
        case "list_spreads":
          return text(SPREADS);
        default:
          return failure(`Unknown tool: ${request.params.name}`);
      }
    } catch (err) {
      if (err instanceof DrawError) return failure(err.message);
      throw err;
    }
  });

  // Each card's picture, as a resource: tarot://card/<id>.
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: CARDS.map((c) => ({ uri: `tarot://card/${c.id}`, name: c.name, mimeType: "image/jpeg", description: c.imagery })),
  }));
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const m = /^tarot:\/\/card\/([a-z]+-\d{2})$/.exec(request.params.uri);
    const file = m ? path.join(deckDir, `${m[1]}.jpg`) : null;
    if (!file || !existsSync(file)) throw new Error(`No such card picture: ${request.params.uri}`);
    return { contents: [{ uri: request.params.uri, mimeType: "image/jpeg", blob: readFileSync(file).toString("base64") }] };
  });

  return server;
}

async function main(): Promise<void> {
  const server = createServer();
  await server.connect(new StdioServerTransport());
}

const entry = process.argv[1] ? realpathSync(process.argv[1]) : "";
if (entry === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
