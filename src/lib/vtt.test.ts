import { describe, expect, it } from "vitest";
import { activeCueText, parseVtt } from "@/lib/vtt";

describe("parseVtt", () => {
  it("parses basic cues", () => {
    const cues = parseVtt(`WEBVTT

1
00:00:01.000 --> 00:00:03.000
Hello

00:00:04.000 --> 00:00:05.500
World
`);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({ start: 1, end: 3, text: "Hello" });
    expect(activeCueText(cues, 1.5)).toBe("Hello");
    expect(activeCueText(cues, 3.5)).toBe("");
    expect(activeCueText(cues, 4.2)).toBe("World");
  });
});
