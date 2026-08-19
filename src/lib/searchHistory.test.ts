import { describe, expect, it } from "vitest";
import { addSearchHistoryEntry, normalizeSearchHistory } from "./searchHistory";

describe("normalizeSearchHistory", () => {
  it("trims, removes blanks and de-duplicates newest first", () => {
    expect(normalizeSearchHistory(["  Star Wars ", "", "star wars", "Dune"])).toEqual([
      "Star Wars",
      "Dune",
    ]);
  });

  it("keeps at most ten entries", () => {
    expect(normalizeSearchHistory(Array.from({ length: 12 }, (_, i) => `term-${i}`))).toHaveLength(10);
  });
});

describe("addSearchHistoryEntry", () => {
  it("moves an existing term to the front", () => {
    expect(addSearchHistoryEntry(["Dune", "Alien"], " alien ")).toEqual(["alien", "Dune"]);
  });

  it("ignores an empty query", () => {
    expect(addSearchHistoryEntry(["Dune"], "   ")).toEqual(["Dune"]);
  });
});
