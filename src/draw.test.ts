import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BY_ID, CARDS, SPREADS, findCard } from "./deck.js";
import { draw, spreadFor } from "./draw.js";

describe("the deck", () => {
  it("has 78 distinct cards with both meanings and a picture each", () => {
    assert.equal(CARDS.length, 78);
    assert.equal(new Set(CARDS.map((c) => c.id)).size, 78);
    assert.equal(CARDS.filter((c) => c.arcana === "major").length, 22);
    for (const c of CARDS) {
      assert.ok(c.upright.keywords.length >= 3 && c.reversed.keywords.length >= 3, c.id);
      assert.ok(c.upright.meaning.length > 40 && c.reversed.meaning.length > 40 && c.imagery.length > 20, c.id);
    }
  });

  it("finds a card by id, name or a loose name", () => {
    assert.equal(findCard("major-00")?.name, "The Fool");
    assert.equal(findCard("the tower")?.id, "major-16");
    assert.equal(findCard("Tower")?.id, "major-16");
    assert.equal(findCard("3 of swords")?.id, "swords-03");
    assert.equal(findCard("Queen of Cups")?.id, "cups-13");
    assert.equal(findCard("ace of coins")?.id, "pentacles-01");
    assert.equal(findCard("nothing"), null);
  });
});

describe("drawing", () => {
  it("deals the spread asked for, from a shuffled deck, with no card twice", () => {
    const r = draw({ spread: "celtic-cross", question: "  Should I move?  " });
    assert.equal(r.spread.id, "celtic-cross");
    assert.equal(r.cards.length, 10);
    assert.equal(new Set(r.cards.map((c) => c.card.id)).size, 10);
    assert.equal(r.question, "Should I move?");
    assert.match(r.guidance, /trauma-informed and expansive/);
    assert.match(r.guidance, /Do not predict the future/);
    assert.deepEqual(r.cards.map((c) => c.position.name), SPREADS.find((s) => s.id === "celtic-cross")!.positions.map((p) => p.name));
    for (const c of r.cards) {
      const card = BY_ID.get(c.card.id)!;
      assert.deepEqual(c.keywords, c.reversed ? card.reversed.keywords : card.upright.keywords);
      assert.equal(c.image, `tarot://card/${card.id}`);
    }
    assert.equal(r.summary.majors + Object.values(r.summary.suits).reduce((a, b) => a + b, 0), 10);
  });

  it("deals the same reading again from its seed, and never reverses when told not to", () => {
    const a = draw({ spread: "three", seed: 12345 });
    const b = draw({ spread: "three", seed: 12345 });
    assert.deepEqual(a.cards, b.cards);
    assert.equal(a.guidance, b.guidance);
    assert.notDeepEqual(draw({ spread: "three", seed: 54321 }).cards.map((c) => c.card.id), a.cards.map((c) => c.card.id));
    for (let seed = 1; seed < 20; seed++) assert.equal(draw({ spread: 5, reversals: false, seed }).summary.reversed, 0);
  });

  it("takes a number of cards as a plain row, and refuses nonsense", () => {
    assert.equal(spreadFor(1).id, "single");
    assert.equal(spreadFor("3").id, "three");
    assert.equal(spreadFor(7).positions.length, 7);
    assert.equal(spreadFor("Celtic Cross").id, "celtic-cross");
    assert.throws(() => spreadFor("hexagram"), /No such spread/);
    assert.throws(() => spreadFor(40), /1 to 21/);
  });

  it("spreads the draws across the whole deck", () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 300; seed++) for (const c of draw({ spread: 3, seed }).cards) seen.add(c.card.id);
    assert.ok(seen.size > 70, `only ${seen.size} different cards in 900 draws`);
  });
});
