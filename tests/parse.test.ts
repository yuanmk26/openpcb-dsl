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
      diffPairs: [],
      instances: [
        {
          ref: "U1",
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
                  },
                  to: "3V3",
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
      diffPairs: [],
      instances: [
        {
          kind: "instance",
          ref: "TP1",
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

  it("rejects unsupported diff_pair syntax", () => {
    const source = readFixture("examples/dsl/adc-lvds.opcb");

    expect(() => parseOpenPcbDsl(source)).toThrow(
      "diff_pair parsing is not supported in the first parser version.",
    );
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
