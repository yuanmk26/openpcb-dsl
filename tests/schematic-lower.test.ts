import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileOpenPcbDslFile } from "../src/parser/load";
import { lowerCircuitIrToSchematic } from "../src/schematic/lower";

function readFixture(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

describe("lowerCircuitIrToSchematic", () => {
  it("matches the simple-pin-ops schematic snapshot", () => {
    const ir = compileOpenPcbDslFile("examples/dsl/simple-pin-ops.opcb");
    const schematic = lowerCircuitIrToSchematic(ir, "simple-pin-ops");
    const expected = JSON.parse(readFixture("examples/schematic/simple-pin-ops.schematic.json"));

    expect(schematic).toEqual(expected);
  });

  it("matches the connector header 1x4 schematic snapshot", () => {
    const ir = compileOpenPcbDslFile("examples/dsl/connector-header-1x4.opcb");
    const schematic = lowerCircuitIrToSchematic(ir, "connector-header-1x4");
    const expected = JSON.parse(readFixture("examples/schematic/connector-header-1x4.schematic.json"));

    expect(schematic).toEqual(expected);
  });
});
