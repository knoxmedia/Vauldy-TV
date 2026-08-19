import { describe, expect, it } from "vitest";
import { groupHistoryItems, historyGroupKey } from "@/lib/historyGroups";

describe("historyGroups", () => {
  const now = Date.parse("2026-08-19T15:00:00+08:00");

  it("buckets by today / week / earlier", () => {
    expect(historyGroupKey({ update_at: "2026-08-19T10:00:00+08:00" }, now)).toBe("today");
    expect(historyGroupKey({ update_at: "2026-08-16T10:00:00+08:00" }, now)).toBe("week");
    expect(historyGroupKey({ update_at: "2026-07-01T10:00:00+08:00" }, now)).toBe("earlier");
  });

  it("orders groups and sorts items", () => {
    const groups = groupHistoryItems(
      [
        { media_id: 1, update_at: "2026-07-01T10:00:00+08:00" },
        { media_id: 2, update_at: "2026-08-19T12:00:00+08:00" },
        { media_id: 3, update_at: "2026-08-19T08:00:00+08:00" },
        { media_id: 4, update_at: "2026-08-15T10:00:00+08:00" },
      ],
      now,
    );
    expect(groups.map((g) => g.key)).toEqual(["today", "week", "earlier"]);
    expect(groups[0]!.items.map((i) => i.media_id)).toEqual([2, 3]);
  });
});
