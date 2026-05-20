import { describe, expect, it } from "vitest";
import { addComponent, addPinToNet, createEmptyCircuitIr } from "../src/ir/circuit-ir";

describe("circuit ir helpers", () => {
  it("createEmptyCircuitIr returns normalized empty state", () => {
    expect(createEmptyCircuitIr()).toEqual({
      componentDefs: {},
      packageDefs: {},
      deviceDefs: {},
      components: {},
      nets: {},
      patterns: [],
      diffPairs: {},
      constraints: [],
    });
  });

  it("addPinToNet dedupes repeated pins", () => {
    const ir = createEmptyCircuitIr();
    addPinToNet(ir, "RESET", "U1.NRST");
    addPinToNet(ir, "RESET", "U1.NRST");
    addPinToNet(ir, "RESET", "R1.1");

    expect(ir.nets.RESET.pins).toEqual(["U1.NRST", "R1.1"]);
  });

  it("addComponent inserts a component definition", () => {
    const ir = createEmptyCircuitIr();
    addComponent(ir, {
      ref: "R1",
      type: "Resistor",
      params: { value: "10k" },
      value: "10k",
    });

    expect(ir.components.R1).toEqual({
      ref: "R1",
      type: "Resistor",
      params: { value: "10k" },
      value: "10k",
    });
  });

  it("addComponent records a conflict instead of silently overwriting", () => {
    const ir = createEmptyCircuitIr();
    addComponent(ir, {
      ref: "R1",
      type: "Resistor",
      params: { value: "10k" },
      value: "10k",
    });
    addComponent(ir, {
      ref: "R1",
      type: "Capacitor",
      params: { value: "100nF" },
      value: "100nF",
    });

    expect(ir.components.R1).toMatchObject({
      ref: "R1",
      type: "Resistor",
    });
    expect(ir.constraints).toContainEqual({
      kind: "component_conflict",
      target: "R1",
      params: {
        existingType: "Resistor",
        incomingType: "Capacitor",
      },
    });
  });
});
