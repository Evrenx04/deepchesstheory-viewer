import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SOURCES, SOURCES_EN, SOURCES_TEXT, SOURCES_TEXT_EN } from "../lib/sources";

// The "Kaynaklar ve lisanslar" page and THIRD-PARTY-NOTICES must cover every package shipped in the site,
// with the license and version that node_modules actually has.
const WEB = path.resolve(__dirname, "../..");
const notices = readFileSync(path.join(WEB, "../THIRD-PARTY-NOTICES"), "utf8");
const pkg = (name: string) => JSON.parse(readFileSync(path.join(WEB, "node_modules", name, "package.json"), "utf8"));
const listed = SOURCES.flatMap((s) => s.items.flatMap((i) => i.packages ?? []));

describe("sources page and THIRD-PARTY-NOTICES", () => {
  it("cover every runtime dependency", () => {
    const deps = Object.keys(JSON.parse(readFileSync(path.join(WEB, "package.json"), "utf8")).dependencies);
    expect(deps.filter((d) => !listed.includes(d))).toEqual([]);
  });

  it.each(listed)("%s: license and version as installed", (name) => {
    const { license, version } = pkg(name);
    const row = notices.split("\n").find((line) => line.split(/[\s,]+/).includes(name) && line.includes(` ${license} `));
    expect(row, `${name} ${license} in the table`).toBeDefined();
    expect(row).toContain(` ${version} `);
  });

  it("has the same items in English, in the same order", () => {
    const shape = (sections: typeof SOURCES) => sections.map((s) => [s.intro?.length ?? 0, s.items.map((i) => [i.url, i.packages, Boolean(i.license)])]);
    expect(shape(SOURCES_EN)).toEqual(shape(SOURCES));
    expect(Object.keys(SOURCES_TEXT_EN)).toEqual(Object.keys(SOURCES_TEXT));
  });
});
