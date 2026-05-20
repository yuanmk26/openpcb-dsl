import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileAstToIr } from "../src/compiler/ast-to-ir";
import { compileOpenPcbDsl, parseOpenPcbDsl } from "../src/parser/parse";

function readFixture(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

describe("parseOpenPcbDsl", () => {
  it("parses the mcu-reset example", () => {
    const source = readFixture("examples/dsl/mcu-reset.opcb");
    const ast = parseOpenPcbDsl(source);

    expect(ast).toMatchObject({
      kind: "program",
      components: [],
      packages: [],
      devices: [],
      diffPairs: [],
      instances: [
        {
          ref: "U1",
          target: "MCU",
          targetKind: "legacy_component",
          componentType: "MCU",
          pins: [
            {
              pin: "NRST",
              node: "RESET",
              operations: [
                {
                  kind: "pullup",
                  component: {
                    ref: "R1",
                    type: "Resistor",
                    params: { value: "10k" },
                    value: "10k",
                  },
                  to: "3V3",
                },
                {
                  kind: "shunt",
                  component: {
                    ref: "C1",
                    type: "Capacitor",
                    params: { value: "100nF" },
                    value: "100nF",
                  },
                  to: "GND",
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it("matches the simple-pin-ops AST shape", () => {
    const source = readFixture("examples/dsl/simple-pin-ops.opcb");
    const expectedAst = JSON.parse(readFixture("examples/ast/simple-pin-ops.ast.json"));

    expect(parseOpenPcbDsl(source)).toEqual(expectedAst);
  });

  it("supports comments, empty lines, trailing commas, and Tap", () => {
    const source = `
# instance comment
TP1 TestPoint(
  P1.Node(net1)
    .Tap(TP_OUT ProbeTag(label=scope),)
    .PullDown(R1 Resistor(value=100k), to=GND), // trailing comma

  P2.Node(net2)
    .Series(R2 Resistor(value=22R, footprint=0402), to=ADC_IN)
);
`;

    expect(parseOpenPcbDsl(source)).toEqual({
      kind: "program",
      components: [],
      packages: [],
      devices: [],
      diffPairs: [],
      instances: [
        {
          kind: "instance",
          ref: "TP1",
          target: "TestPoint",
          targetKind: "legacy_component",
          componentType: "TestPoint",
          pins: [
            {
              kind: "pin_expr",
              pin: "P1",
              node: "net1",
              operations: [
                {
                  kind: "tap",
                  component: {
                    ref: "TP_OUT",
                    type: "ProbeTag",
                    params: { label: "scope" },
                  },
                },
                {
                  kind: "pulldown",
                  component: {
                    ref: "R1",
                    type: "Resistor",
                    params: { value: "100k" },
                    value: "100k",
                  },
                  to: "GND",
                },
              ],
            },
            {
              kind: "pin_expr",
              pin: "P2",
              node: "net2",
              operations: [
                {
                  kind: "series",
                  component: {
                    ref: "R2",
                    type: "Resistor",
                    params: { value: "22R", footprint: "0402" },
                    value: "22R",
                    footprint: "0402",
                  },
                  to: "ADC_IN",
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it("compiles text DSL to the same IR as the AST path", () => {
    const source = readFixture("examples/dsl/simple-pin-ops.opcb");
    const ast = parseOpenPcbDsl(source);

    expect(compileOpenPcbDsl(source)).toEqual(compileAstToIr(ast));
  });

  it("parses vNext component/package/device/inst syntax", () => {
    const source = readFixture("examples/dsl/vnext-device.opcb");

    expect(parseOpenPcbDsl(source)).toMatchObject({
      kind: "program",
      components: [
        expect.objectContaining({
          name: "MCU",
          pins: expect.arrayContaining([
            expect.objectContaining({ name: "NRST", kind: "in" }),
            expect.objectContaining({ name: "PA0", kind: "inout" }),
          ]),
        }),
      ],
      packages: [
        expect.objectContaining({
          name: "LQFP48",
          pads: expect.arrayContaining(["1", "2", "3"]),
        }),
      ],
      devices: [
        {
          name: "STM32F103C8T6",
          component: "MCU",
          package: "LQFP48",
        },
      ],
      instances: [
        {
          ref: "U1",
          target: "STM32F103C8T6",
          targetKind: "device",
          attrs: {
            role: "control",
          },
        },
      ],
    });
  });

  it("parses diff_pair, endpoint near, bridge, and constraints", () => {
    const source = readFixture("examples/dsl/adc-lvds.opcb");

    expect(parseOpenPcbDsl(source)).toMatchObject({
      kind: "program",
      diffPairs: [
        {
          name: "ADC_D0",
          pNet: "ADC_D0_P",
          nNet: "ADC_D0_N",
          endpoints: [
            {
              name: "rx",
              near: "U_FPGA",
              bridges: [
                {
                  component: {
                    ref: "RT0",
                    type: "Resistor",
                  },
                },
              ],
            },
          ],
          constraints: {
            differentialImpedance: "100ohm",
            intraPairLengthMatch: "within 0.2mm",
            routeTogether: true,
          },
        },
      ],
    });
  });

  it("supports mixing legacy instances with vNext definitions", () => {
    const source = `
component MCU {
  pins {
    NRST: in
  }
}

package DIP1 {
  pads { 1 }
}

device MCU_DEV : MCU @ DIP1 {
  pinmap {
    NRST -> 1
  }
}

inst U1 MCU_DEV {
  NRST.Node(RESET)
}

TP1 TestPoint(
  P1.Node(RESET)
);
`;

    expect(parseOpenPcbDsl(source)).toMatchObject({
      components: [{ name: "MCU" }],
      devices: [{ name: "MCU_DEV" }],
      instances: [
        { ref: "U1", targetKind: "device" },
        { ref: "TP1", targetKind: "legacy_component", componentType: "TestPoint" },
      ],
    });
  });

  it("rejects unknown operations", () => {
    const source = `
U1 MCU(
  P1.Node(net1)
    .Foo(R1 Resistor(value=10k), to=VCC)
);
`;

    expect(() => parseOpenPcbDsl(source)).toThrow('Unsupported operation "Foo"');
  });

  it("rejects missing closing parentheses with a location", () => {
    const source = `
U1 MCU(
  P1.Node(net1)
    .PullUp(R1 Resistor(value=10k), to=VCC)
`;

    expect(() => parseOpenPcbDsl(source)).toThrow('Expected ")"');
    expect(() => parseOpenPcbDsl(source)).toThrow("line");
    expect(() => parseOpenPcbDsl(source)).toThrow("column");
  });

  it("rejects pin chains that do not start with Node", () => {
    const source = `
U1 MCU(
  P1.PullUp(R1 Resistor(value=10k), to=VCC)
);
`;

    expect(() => parseOpenPcbDsl(source)).toThrow('Pin "P1" must start with Node(...)');
  });

  it("rejects invalid component instantiation", () => {
    const source = `
U1 MCU(
  P1.Node(net1)
    .PullUp(R1(value=10k), to=VCC)
);
`;

    expect(() => parseOpenPcbDsl(source)).toThrow("Expected component type");
  });
});
