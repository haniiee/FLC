import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC_ROOT = join(__dirname, "..");

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walkTsFiles(full));
      continue;
    }
    if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") && !name.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

describe("RTL style hygiene", () => {
  it('does not hard-code textAlign: "right" on Text (RN mirrors it under RTL)', () => {
    const offenders: string[] = [];
    for (const file of walkTsFiles(SRC_ROOT)) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (!/textAlign:\s*["']right["']/.test(line)) return;
        const window = lines.slice(Math.max(0, i - 4), i + 1).join("\n");
        // Allowed only for TextInput physical alignment (Android does not mirror).
        if (/TextInput/.test(window)) return;
        offenders.push(`${relative(SRC_ROOT, file)}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('does not hard-code writingDirection: "rtl"', () => {
    const offenders: string[] = [];
    for (const file of walkTsFiles(SRC_ROOT)) {
      const src = readFileSync(file, "utf8");
      if (/writingDirection:\s*["']rtl["']/.test(src)) {
        offenders.push(relative(SRC_ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
