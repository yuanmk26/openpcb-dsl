import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { emitTscircuitSchematicCircuitJson } from "../src/emitters/tscircuit/emit-schematic-circuit-json";
import { compileOpenPcbDslFile } from "../src/parser/load";
import { lowerCircuitIrToSchematic } from "../src/schematic/lower";

function readFixture(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

describe("emitTscircuitSchematicCircuitJson", () => {
  it("matches the simple-pin-ops tscircuit schematic snapshot", () => {
    const ir = compileOpenPcbDslFile("examples/dsl/simple-pin-ops.opcb");
    const schematic = lowerCircuitIrToSchematic(ir, "simple-pin-ops");
    const expected = JSON.parse(
      readFixture("examples/emitters/circuit-json/simple-pin-ops.schematic.circuit.json"),
    );

    expect(emitTscircuitSchematicCircuitJson(schematic)).toEqual(expected);
  });

  it("matches the connector header 1x4 tscircuit schematic snapshot", () => {
    const ir = compileOpenPcbDslFile("examples/dsl/connector-header-1x4.opcb");
    const schematic = lowerCircuitIrToSchematic(ir, "connector-header-1x4");
    const expected = JSON.parse(
      readFixture("examples/emitters/circuit-json/connector-header-1x4.schematic.circuit.json"),
    );

    expect(emitTscircuitSchematicCircuitJson(schematic)).toEqual(expected);
  });
});
