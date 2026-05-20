import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createEmptyCircuitIr } from "../src/ir/circuit-ir";
import { validateCircuitIr } from "../src/ir/validate";
import { compileOpenPcbDsl } from "../src/parser/parse";

function readFixture(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

describe("validateCircuitIr", () => {
  it("reports single-pin nets as warnings", () => {
    const ir = createEmptyCircuitIr();
    ir.nets.RESET = { name: "RESET", pins: ["U1.NRST"] };

    const diagnostics = validateCircuitIr(ir);

    expect(diagnostics).toContainEqual({
      severity: "warning",
      code: "SINGLE_PIN_NET",
      message: 'Net "RESET" only has one connected pin.',
      target: "RESET",
    });
  });

  it("reports invalid pin references", () => {
    const ir = createEmptyCircuitIr();
    ir.nets.RESET = { name: "RESET", pins: ["invalid pin"] };

    const diagnostics = validateCircuitIr(ir);

    expect(diagnostics).toContainEqual({
      severity: "error",
      code: "INVALID_PIN_REF",
      message: 'Pin reference "invalid pin" is not in a valid "REF.PIN" format.',
      target: "invalid pin",
    });
  });

  it("reports empty nets as errors", () => {
    const ir = createEmptyCircuitIr();
    ir.nets.FLOATING = { name: "FLOATING", pins: [] };

    const diagnostics = validateCircuitIr(ir);

    expect(diagnostics).toContainEqual({
      severity: "error",
      code: "EMPTY_NET",
      message: 'Net "FLOATING" does not contain any pins.',
      target: "FLOATING",
    });
  });

  it("reports duplicate pins when present in raw IR input", () => {
    const ir = createEmptyCircuitIr();
    ir.nets.RESET = { name: "RESET", pins: ["U1.NRST", "U1.NRST"] };

    const diagnostics = validateCircuitIr(ir);

    expect(diagnostics).toContainEqual({
      severity: "warning",
      code: "DUPLICATE_NET_PIN",
      message: 'Net "RESET" contains duplicate pin "U1.NRST".',
      target: "RESET",
    });
  });

  it("reports conflicting component definitions", () => {
    const ir = createEmptyCircuitIr();
    ir.constraints.push({
      kind: "component_conflict",
      target: "R1",
      params: {
        existingType: "Resistor",
        incomingType: "Capacitor",
      },
    });

    const diagnostics = validateCircuitIr(ir);

    expect(diagnostics).toContainEqual({
      severity: "error",
      code: "CONFLICTING_COMPONENT_DEF",
      message: 'Component "R1" is defined with conflicting properties.',
      target: "R1",
    });
  });

  it("reports invalid device pinmap definitions", () => {
    const ir = compileOpenPcbDsl(`
component MCU {
  pins {
    NRST: in
  }
}

package DIP1 {
  pads { 1 }
}

device BROKEN_DEV : MCU @ DIP1 {
  pinmap {
    BOOT0 -> 2
  }
}
`);

    const diagnostics = validateCircuitIr(ir);

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "INVALID_DEVICE_PINMAP_PIN",
      }),
    );
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "INVALID_DEVICE_PINMAP_PAD",
      }),
    );
  });

  it("reports missing device references from vNext instances", () => {
    const ir = compileOpenPcbDsl(`
inst U1 MissingDevice {
}
`);

    const diagnostics = validateCircuitIr(ir);

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "MISSING_DEVICE_DEF",
        target: "U1",
      }),
    );
  });

  it("reports invalid vNext instance pins against component definitions", () => {
    const ir = compileOpenPcbDsl(`
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
  BOOT0.Node(RESET)
}
`);

    const diagnostics = validateCircuitIr(ir);

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "INVALID_INSTANCE_PIN",
      }),
    );
  });

  it("accepts valid vNext diff_pair inputs", () => {
    const ir = compileOpenPcbDsl(readFixture("examples/dsl/vnext-diff-pair.opcb"));
    const diagnostics = validateCircuitIr(ir);

    expect(diagnostics.find((item) => item.severity === "error")).toBeUndefined();
  });
});
