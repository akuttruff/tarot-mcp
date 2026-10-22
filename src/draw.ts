import { randomInt } from "node:crypto";
import { CARDS, SPREAD_BY_ID } from "./deck.js";
import type { Card, Position, Spread } from "./deck.js";

export interface DrawOptions {
  /** A spread id, or a number of cards for a plain row. */
  spread?: string | number;
  question?: string;
  /** Whether a card may come out reversed (half do, on average). */
  reversals?: boolean;
  /** A seed makes the draw repeatable; without one the shuffle is truly random. */
  seed?: number;
}

export interface DrawnCard {
  position: { index: number; name: string; meaning: string };
  card: { id: string; name: string; arcana: Card["arcana"]; suit: Card["suit"]; number: number };
  reversed: boolean;
  keywords: string[];
  meaning: string;
  /** Where the picture is: a resource this server serves. */
  image: string;
}

export interface Reading {
  spread: { id: string; name: string; description: string };
  question: string | null;
  drawnAt: string;
  seed: number;
  cards: DrawnCard[];
  /** Counts a reader looks at first: how many majors, how many reversed, which suit leads. */
  summary: { majors: number; reversed: number; suits: Record<string, number> };
}

export class DrawError extends Error {}

/** A small, fast, seedable generator (mulberry32), so a reading can be dealt again from its seed. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The spread asked for, or a row of n cards. */
export function spreadFor(spread: string | number | undefined): Spread {
  if (spread === undefined || spread === "") return SPREAD_BY_ID.get("single")!;
  if (typeof spread === "number" || /^\d+$/.test(spread)) {
    const n = Number(spread);
    if (!Number.isInteger(n) || n < 1 || n > 21) throw new DrawError("A custom spread is 1 to 21 cards");
    if (n === 1) return SPREAD_BY_ID.get("single")!;
    if (n === 3) return SPREAD_BY_ID.get("three")!;
    const positions: Position[] = Array.from({ length: n }, (_, i) => ({ name: `Card ${i + 1}`, meaning: `Position ${i + 1} of ${n}.` }));
    return { id: `row-${n}`, name: `${n} cards`, description: `${n} cards in a row, read left to right.`, positions };
  }
  const found = SPREAD_BY_ID.get(spread.trim().toLowerCase().replace(/\s+/g, "-"));
  if (!found) throw new DrawError(`No such spread: ${spread}. Use list_spreads, or a number of cards.`);
  return found;
}

/** Shuffle the whole deck and deal the spread. */
export function draw(options: DrawOptions = {}): Reading {
  const spread = spreadFor(options.spread);
  const seed = options.seed ?? randomInt(0, 2 ** 31);
  const next = rng(seed);
  const deck = [...CARDS];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  const reversals = options.reversals ?? true;
  const cards: DrawnCard[] = spread.positions.map((p, i) => {
    const card = deck[i]!;
    const reversed = reversals && next() < 0.5;
    const side = reversed ? card.reversed : card.upright;
    return {
      position: { index: i + 1, name: p.name, meaning: p.meaning },
      card: { id: card.id, name: card.name, arcana: card.arcana, suit: card.suit, number: card.number },
      reversed,
      keywords: side.keywords,
      meaning: side.meaning,
      image: `tarot://card/${card.id}`,
    };
  });
  const suits: Record<string, number> = {};
  for (const c of cards) if (c.card.suit) suits[c.card.suit] = (suits[c.card.suit] ?? 0) + 1;
  return {
    spread: { id: spread.id, name: spread.name, description: spread.description },
    question: options.question?.trim() || null,
    drawnAt: new Date().toISOString(),
    seed,
    cards,
    summary: { majors: cards.filter((c) => c.card.arcana === "major").length, reversed: cards.filter((c) => c.reversed).length, suits },
  };
}
