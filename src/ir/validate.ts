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

    if (component.device) {
      const deviceDef = ir.deviceDefs[component.device];
      if (!deviceDef) {
        diagnostics.push({
          severity: "error",
          code: "MISSING_DEVICE_DEF",
          message: `Instance "${component.ref}" references missing device "${component.device}".`,
          target: component.ref,
        });
        continue;
      }

      const componentDef = ir.componentDefs[deviceDef.component];
      if (!componentDef) {
        diagnostics.push({
          severity: "error",
          code: "MISSING_COMPONENT_DEF",
          message: `Device "${deviceDef.name}" references missing component "${deviceDef.component}".`,
          target: deviceDef.name,
        });
      }

      const packageDef = ir.packageDefs[deviceDef.package];
      if (!packageDef) {
        diagnostics.push({
          severity: "error",
          code: "MISSING_PACKAGE_DEF",
          message: `Device "${deviceDef.name}" references missing package "${deviceDef.package}".`,
          target: deviceDef.name,
        });
      }

      if (componentDef) {
        for (const net of Object.values(ir.nets)) {
          for (const pinRef of net.pins) {
            const [ref, pinName] = pinRef.split(".");
            if (ref === component.ref && !componentDef.pins[pinName]) {
              diagnostics.push({
                severity: "error",
                code: "INVALID_INSTANCE_PIN",
                message: `Instance "${component.ref}" uses pin "${pinName}" that is not declared by component "${componentDef.name}".`,
                target: pinRef,
              });
            }
          }
        }
      }
    }
  }

  for (const [name, deviceDef] of Object.entries(ir.deviceDefs)) {
    const componentDef = ir.componentDefs[deviceDef.component];
    const packageDef = ir.packageDefs[deviceDef.package];

    if (!componentDef) {
      diagnostics.push({
        severity: "error",
        code: "MISSING_DEVICE_COMPONENT_DEF",
        message: `Device "${name}" references missing component "${deviceDef.component}".`,
        target: name,
      });
    }

    if (!packageDef) {
      diagnostics.push({
        severity: "error",
        code: "MISSING_DEVICE_PACKAGE_DEF",
        message: `Device "${name}" references missing package "${deviceDef.package}".`,
        target: name,
      });
    }

    for (const [pin, pad] of Object.entries(deviceDef.pinmap)) {
      if (componentDef && !componentDef.pins[pin]) {
        diagnostics.push({
          severity: "error",
          code: "INVALID_DEVICE_PINMAP_PIN",
          message: `Device "${name}" pinmap references undeclared pin "${pin}".`,
          target: name,
        });
      }

      if (packageDef && !packageDef.pads.includes(pad)) {
        diagnostics.push({
          severity: "error",
          code: "INVALID_DEVICE_PINMAP_PAD",
          message: `Device "${name}" pinmap references undeclared pad "${pad}".`,
          target: name,
        });
      }
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

    for (const pin of [...diffPair.pPins, ...diffPair.nPins]) {
      if (!PIN_REF_PATTERN.test(pin)) {
        diagnostics.push({
          severity: "error",
          code: "INVALID_DIFF_PAIR_PIN_REF",
          message: `Diff pair "${diffPair.name}" contains invalid pin reference "${pin}".`,
          target: diffPair.name,
        });
      }
    }

    for (const endpoint of diffPair.endpoints ?? []) {
      if (endpoint.near && !ir.components[endpoint.near]) {
        diagnostics.push({
          severity: "warning",
          code: "UNKNOWN_DIFF_ENDPOINT_NEAR",
          message: `Diff pair "${diffPair.name}" endpoint "${endpoint.name}" references unknown near instance "${endpoint.near}".`,
          target: diffPair.name,
        });
      }
    }
  }

  return diagnostics;
}
