import { describe, expect, it } from "vitest";
import { parseJoinCodeFromUrl } from "./deep-link";

describe("parseJoinCodeFromUrl", () => {
  it("parses flc scheme paths", () => {
    expect(parseJoinCodeFromUrl("flc://join/ABC123")).toBe("ABC123");
    expect(parseJoinCodeFromUrl("flc://join/hello_world")).toBe("hello_world");
  });

  it("parses https web join urls", () => {
    expect(parseJoinCodeFromUrl("https://flc.example/join/XYZ99")).toBe("XYZ99");
    expect(parseJoinCodeFromUrl("https://localhost:3000/join/XYZ99?x=1")).toBe("XYZ99");
  });

  it("parses query code", () => {
    expect(parseJoinCodeFromUrl("flc://join?code=QWERTY")).toBe("QWERTY");
  });

  it("accepts bare codes", () => {
    expect(parseJoinCodeFromUrl("INVITE01")).toBe("INVITE01");
  });

  it("returns null for empty/invalid", () => {
    expect(parseJoinCodeFromUrl("")).toBeNull();
    expect(parseJoinCodeFromUrl("https://example.com/other/x")).toBeNull();
  });
});
