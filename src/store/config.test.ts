import { describe, expect, it } from "vitest";
import { normalizeServerUrl } from "@/store/config";

describe("normalizeServerUrl", () => {
  it("adds http:// when scheme is missing", () => {
    expect(normalizeServerUrl("192.168.1.100:8200")).toBe("http://192.168.1.100:8200");
  });

  it("strips trailing slashes and api suffixes", () => {
    expect(normalizeServerUrl("http://192.168.1.100:8200/")).toBe("http://192.168.1.100:8200");
    expect(normalizeServerUrl("http://192.168.1.100:8200/api/v1")).toBe("http://192.168.1.100:8200");
    expect(normalizeServerUrl("http://192.168.1.100:8200/api")).toBe("http://192.168.1.100:8200");
  });

  it("normalizes full-width punctuation and spaces", () => {
    expect(normalizeServerUrl("192.168.1.100：8200")).toBe("http://192.168.1.100:8200");
    expect(normalizeServerUrl("http://192．168．1．100:8200")).toBe("http://192.168.1.100:8200");
    expect(normalizeServerUrl(" 192.168.1.100 : 8200 ")).toBe("http://192.168.1.100:8200");
  });

  it("rejects empty or host-less values", () => {
    expect(normalizeServerUrl("")).toBe("");
    expect(normalizeServerUrl("   ")).toBe("");
    expect(normalizeServerUrl("http://")).toBe("");
    expect(normalizeServerUrl("https://")).toBe("");
  });

  it("keeps https and hostnames", () => {
    expect(normalizeServerUrl("https://vauldy.home:8200")).toBe("https://vauldy.home:8200");
  });
});
