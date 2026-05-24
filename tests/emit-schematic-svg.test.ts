import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { emitSchematicSvg } from "../src/emitters/svg/emit-schematic-svg";

function readFixture(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

describe("emitSchematicSvg", () => {
  it("renders connector-header-1x4 schematic to svg", () => {
    const schematic = JSON.parse(readFixture("examples/schematic/connector-header-1x4.schematic.json"));
    const svg = emitSchematicSvg(schematic);

    expect(svg).toContain("<svg");
    expect(svg).toContain("J1");
    expect(svg).toContain("<rect");
  });
});
