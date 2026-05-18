import type { Diagnostic } from "./diagnostics";
import type { CircuitIR } from "./circuit-ir";

const PIN_REF_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z0-9_]+$/;

export function validateCircuitIr(ir: CircuitIR): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const [name, net] of Object.entries(ir.nets)) {
    if (net.pins.length === 0) {
      diagnostics.push({
        severity: "error",
        code: "EMPTY_NET",
        message: `Net "${name}" does not contain any pins.`,
        target: name,
      });
    }

    if (net.pins.length === 1) {
      diagnostics.push({
        severity: "warning",
        code: "SINGLE_PIN_NET",
        message: `Net "${name}" only has one connected pin.`,
        target: name,
      });
    }

    const seenPins = new Set<string>();
    for (const pin of net.pins) {
      if (!PIN_REF_PATTERN.test(pin)) {
        diagnostics.push({
          severity: "error",
          code: "INVALID_PIN_REF",
          message: `Pin reference "${pin}" is not in a valid "REF.PIN" format.`,
          target: pin,
        });
      }

      if (seenPins.has(pin)) {
        diagnostics.push({
          severity: "warning",
          code: "DUPLICATE_NET_PIN",
          message: `Net "${name}" contains duplicate pin "${pin}".`,
          target: name,
        });
      }

      seenPins.add(pin);
    }
  }

  for (const component of Object.values(ir.components)) {
    if (!component.ref.trim()) {
      diagnostics.push({
        severity: "error",
        code: "EMPTY_COMPONENT_REF",
        message: "Component reference must not be empty.",
        target: component.type,
      });
    }
  }

  for (const constraint of ir.constraints) {
    if (constraint.kind === "component_conflict") {
      diagnostics.push({
        severity: "error",
        code: "CONFLICTING_COMPONENT_DEF",
        message: `Component "${constraint.target}" is defined with conflicting properties.`,
        target: constraint.target,
      });
    }
  }

  for (const diffPair of Object.values(ir.diffPairs)) {
    if (!ir.nets[diffPair.pNet]) {
      diagnostics.push({
        severity: "error",
        code: "MISSING_DIFF_PAIR_P_NET",
        message: `Diff pair "${diffPair.name}" references missing pNet "${diffPair.pNet}".`,
        target: diffPair.name,
      });
    }

    if (!ir.nets[diffPair.nNet]) {
      diagnostics.push({
        severity: "error",
        code: "MISSING_DIFF_PAIR_N_NET",
        message: `Diff pair "${diffPair.name}" references missing nNet "${diffPair.nNet}".`,
        target: diffPair.name,
      });
    }
  }
  return diagnostics;
}
