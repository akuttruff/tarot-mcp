import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { DECK_DIR, createServer } from "./index.js";

type TextResult = { content: { type: string; text: string }[]; isError?: boolean };
const textOf = (r: unknown): string => (r as TextResult).content[0]!.text;

async function connect() {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createServer(DECK_DIR).connect(serverSide);
  const client = new Client({ name: "test", version: "0" });
  await client.connect(clientSide);
  return client;
}

describe("tools, over the MCP protocol", () => {
  it("lists three tools, deals a spread, explains a card and the spreads", async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), ["card_meaning", "draw_cards", "list_spreads"]);

    const reading = JSON.parse(textOf(await client.callTool({ name: "draw_cards", arguments: { spread: "situation", question: "What should I focus on?", seed: 7 } })));
    assert.equal(reading.spread.id, "situation");
    assert.equal(reading.cards.length, 3);
    assert.equal(reading.seed, 7);
    assert.match(reading.cards[0].image, /^tarot:\/\/card\//);

    const card = JSON.parse(textOf(await client.callTool({ name: "card_meaning", arguments: { card: "the star" } })));
    assert.equal(card.id, "major-17");
    assert.match(card.imagery, /kneels by a pool/);

    const bad = (await client.callTool({ name: "card_meaning", arguments: { card: "the moon landing" } })) as TextResult;
    assert.equal(bad.isError, true);
    const worse = (await client.callTool({ name: "draw_cards", arguments: { spread: "hexagram" } })) as TextResult;
    assert.equal(worse.isError, true);

    const spreads = JSON.parse(textOf(await client.callTool({ name: "list_spreads", arguments: {} })));
    assert.equal(spreads.length, 4);
    await client.close();
  });

  it("serves each card's picture as a resource", async () => {
    const client = await connect();
    const { resources } = await client.listResources();
    assert.equal(resources.length, 78);
    const fool = await client.readResource({ uri: "tarot://card/major-00" });
    const blob = (fool.contents[0] as { blob: string; mimeType: string });
    assert.equal(blob.mimeType, "image/jpeg");
    assert.ok(Buffer.from(blob.blob, "base64").length > 5000);
    await assert.rejects(client.readResource({ uri: "tarot://card/major-99" }), /No such card picture/);
    await client.close();
  });
});
