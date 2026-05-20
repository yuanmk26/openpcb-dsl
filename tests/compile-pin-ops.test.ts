import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ProgramAst } from "../src/ast/nodes";
import { compileAstToIr } from "../src/compiler/ast-to-ir";
import { compileOpenPcbDsl } from "../src/parser/parse";

function readFixture(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

const ast: ProgramAst = {
  kind: "program",
  imports: [],
  components: [],
  packages: [],
  devices: [],
  instances: [
    {
      kind: "instance",
      ref: "Inst_U1",
      target: "U1",
      targetKind: "legacy_component",
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

  it("lowers vNext device definitions and instance attrs into IR", () => {
    const ir = compileOpenPcbDsl(readFixture("examples/dsl/vnext-device.opcb"));

    expect(ir.componentDefs.MCU.pins.NRST).toEqual({ kind: "in" });
    expect(ir.packageDefs.LQFP48.pads).toContain("48");
    expect(ir.deviceDefs.STM32F103C8T6).toMatchObject({
      component: "MCU",
      package: "LQFP48",
      pinmap: {
        NRST: "7",
      },
    });
    expect(ir.components.U1).toMatchObject({
      ref: "U1",
      type: "STM32F103C8T6",
      device: "STM32F103C8T6",
      component: "MCU",
      package: "LQFP48",
      attrs: {
        role: "control",
      },
    });
  });

  it("lowers diff_pair bridges into patterns and nets", () => {
    const ir = compileOpenPcbDsl(readFixture("examples/dsl/vnext-diff-pair.opcb"));

    expect(ir.diffPairs.ADC_D0).toMatchObject({
      pNet: "ADC_D0_P",
      nNet: "ADC_D0_N",
      constraints: {
        differentialImpedance: "100ohm",
        intraPairLengthMatch: "within_0p2mm",
        routeTogether: true,
      },
    });
    expect(ir.nets.ADC_D0_P.pins).toEqual(
      expect.arrayContaining(["U_ADC.DOUT0_P", "U_FPGA.ADC_D0_P", "RT0.1"]),
    );
    expect(ir.patterns).toContainEqual({
      kind: "bridge",
      fromNet: "ADC_D0_P",
      toNet: "ADC_D0_N",
      component: "RT0",
      metadata: {
        endpoint: "rx",
        near: "U_FPGA",
      },
    });
  });
});
