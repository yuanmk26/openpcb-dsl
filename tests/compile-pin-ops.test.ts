import { describe, expect, it } from "vitest";
import type { ProgramAst } from "../src/ast/nodes";
import { compileAstToIr } from "../src/compiler/ast-to-ir";

const ast: ProgramAst = {
  kind: "program",
  instances: [
    {
      kind: "instance",
      ref: "Inst_U1",
      componentType: "U1",
      pins: [
        {
          kind: "pin_expr",
          pin: "P1",
          node: "node1",
          operations: [
            {
              kind: "pullup",
              component: {
                ref: "R1",
                type: "Resistor",
                params: { value: "10k" },
              },
              to: "VCC",
            },
          ],
        },
        {
          kind: "pin_expr",
          pin: "P2",
          node: "node1",
          operations: [
            {
              kind: "series",
              component: {
                ref: "R2",
                type: "Resistor",
                params: { value: "22R" },
              },
              to: "net4",
            },
            {
              kind: "shunt",
              component: {
                ref: "C1",
                type: "Capacitor",
                params: { value: "100nF" },
              },
              to: "GND",
            },
          ],
        },
      ],
    },
  ],
  diffPairs: [],
};

describe("compileAstToIr", () => {
  it("merges pin expressions targeting the same node into one net", () => {
    const ir = compileAstToIr(ast);

    expect(ir.nets.node1.pins).toEqual(
      expect.arrayContaining(["Inst_U1.P1", "Inst_U1.P2", "R1.1", "R2.1", "C1.1"]),
    );
  });

  it("expands pullup into helper component and VCC connection", () => {
    const ir = compileAstToIr(ast);

    expect(ir.components.R1).toMatchObject({
      ref: "R1",
      type: "Resistor",
      value: "10k",
    });
    expect(ir.nets.VCC.pins).toContain("R1.2");
    expect(ir.patterns).toContainEqual({
      kind: "pullup",
      fromNet: "node1",
      toNet: "VCC",
      component: "R1",
      metadata: undefined,
    });
  });

  it("expands series into current node and target net", () => {
    const ir = compileAstToIr(ast);

    expect(ir.components.R2).toMatchObject({
      ref: "R2",
      type: "Resistor",
      value: "22R",
    });
    expect(ir.nets.node1.pins).toContain("R2.1");
    expect(ir.nets.net4.pins).toContain("R2.2");
  });

  it("expands shunt into current node and GND", () => {
    const ir = compileAstToIr(ast);

    expect(ir.components.C1).toMatchObject({
      ref: "C1",
      type: "Capacitor",
      value: "100nF",
    });
    expect(ir.nets.node1.pins).toContain("C1.1");
    expect(ir.nets.GND.pins).toContain("C1.2");
    expect(ir.patterns).toContainEqual({
      kind: "shunt",
      fromNet: "node1",
      toNet: "GND",
      component: "C1",
      metadata: undefined,
    });
  });
});
