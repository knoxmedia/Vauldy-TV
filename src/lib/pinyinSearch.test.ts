import { describe, expect, it } from "vitest";
import type { MediaItem } from "@/api/types";
import { mediaMatchesPinyin, titlePinyinKeys } from "./pinyinSearch";

const item = { id: 1, title: "\u6d41\u6d6a\u5730\u7403", original_title: "", file_path: "", file_type: "video" } as MediaItem;

describe("pinyin title search", () => {
  it("builds title initials", () => {
    expect(titlePinyinKeys("\u6d41\u6d6a\u5730\u7403").initials).toBe("lldq");
  });

  it("matches initials and full pinyin", () => {
    expect(mediaMatchesPinyin(item, "lldq")).toBe(true);
    expect(mediaMatchesPinyin(item, "liulang")).toBe(true);
    expect(mediaMatchesPinyin(item, "xhl")).toBe(false);
  });
});
