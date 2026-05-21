import { describe, expect, it } from "vitest";
import { compileOpenPcbDslFile } from "../src/parser/load";
import { lowerCircuitIrToSchematic } from "../src/schematic/lower";

describe("lowerCircuitIrToSchematic", () => {
  it("lowers the simple-pin-ops example into a single-sheet schematic", () => {
    const ir = compileOpenPcbDslFile("examples/dsl/simple-pin-ops.opcb");
    const schematic = lowerCircuitIrToSchematic(ir, "simple-pin-ops");

    expect(schematic).toMatchObject({
      id: "schematic-1",
      title: "simple-pin-ops",
      sheets: [
        {
          id: "sheet-1",
          name: "Sheet 1",
        },
      ],
    });

    const [sheet] = schematic.sheets;
    const symbols = sheet.items.filter((item) => item.kind === "symbol");
    const wires = sheet.items.filter((item) => item.kind === "wire");
    const labels = sheet.items.filter((item) => item.kind === "net_label");
    const junctions = sheet.items.filter((item) => item.kind === "junction");

    expect(symbols).toHaveLength(4);
    expect(wires.length).toBeGreaterThanOrEqual(5);
    expect(labels.map((item) => item.netName).sort()).toEqual(["GND", "VCC", "net4", "node1"]);
    expect(junctions).toContainEqual(
      expect.objectContaining({
        kind: "junction",
        id: "junction:node1",
      }),
    );
    expect(symbols).toContainEqual(
      expect.objectContaining({
        sourceRef: "R1",
        symbolKind: "resistor",
        properties: expect.objectContaining({
          value: "10k",
        }),
      }),
    );
    expect(symbols).toContainEqual(
      expect.objectContaining({
        sourceRef: "Inst_U1",
        symbolKind: "generic_component",
        pins: expect.arrayContaining([
          expect.objectContaining({ name: "P1" }),
          expect.objectContaining({ name: "P2" }),
        ]),
      }),
    );
  });
});
