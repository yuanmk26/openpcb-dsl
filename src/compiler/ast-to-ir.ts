import type { ComponentDefAst, DeviceDefAst, DiffPairAst, PackageDefAst, ProgramAst } from "../ast/nodes";
import { createEmptyCircuitIr, addComponent, addPinToNet, type CircuitIR } from "../ir/circuit-ir";
import { expandPinExpression } from "./expand-pin-ops";

export function compileAstToIr(ast: ProgramAst): CircuitIR {
  const ir = createEmptyCircuitIr();

  for (const componentDef of ast.components) {
    ir.componentDefs[componentDef.name] = lowerComponentDef(componentDef);
  }

  for (const packageDef of ast.packages) {
    ir.packageDefs[packageDef.name] = lowerPackageDef(packageDef);
  }

  for (const deviceDef of ast.devices) {
    ir.deviceDefs[deviceDef.name] = lowerDeviceDef(deviceDef);
  }

  for (const instance of ast.instances) {
    if (instance.targetKind === "device") {
      const deviceDef = ir.deviceDefs[instance.target];
      addComponent(ir, {
        ref: instance.ref,
        type: instance.target,
        device: instance.target,
        component: deviceDef?.component,
        package: deviceDef?.package,
        attrs: instance.attrs,
      });
    } else {
      addComponent(ir, {
        ref: instance.ref,
        type: instance.componentType ?? instance.target,
        params: instance.params,
      });
    }

    for (const pinExpr of instance.pins) {
      expandPinExpression(ir, instance, pinExpr);
    }
  }

  for (const diffPair of ast.diffPairs) {
    for (const pin of diffPair.pPins) {
      addPinToNet(ir, diffPair.pNet, pin);
    }
    for (const pin of diffPair.nPins) {
      addPinToNet(ir, diffPair.nNet, pin);
    }

    ir.diffPairs[diffPair.name] = {
      name: diffPair.name,
      pNet: diffPair.pNet,
      nNet: diffPair.nNet,
      pPins: diffPair.pPins,
      nPins: diffPair.nPins,
      endpoints: diffPair.endpoints?.map((endpoint) => ({
        name: endpoint.name,
        near: endpoint.near,
        bridges: endpoint.bridges.map((bridge) => ({
          component: bridge.component.ref,
          legs: bridge.legs,
        })),
      })),
      constraints: diffPair.constraints
        ? {
            differentialImpedance:
              typeof diffPair.constraints.differentialImpedance === "string"
                ? diffPair.constraints.differentialImpedance
                : undefined,
            intraPairLengthMatch:
              typeof diffPair.constraints.intraPairLengthMatch === "string"
                ? diffPair.constraints.intraPairLengthMatch
                : undefined,
            interPairSkew:
              typeof diffPair.constraints.interPairSkew === "string"
                ? diffPair.constraints.interPairSkew
                : undefined,
            routeTogether:
              typeof diffPair.constraints.routeTogether === "boolean"
                ? diffPair.constraints.routeTogether
                : undefined,
            polarity:
              diffPair.constraints.polarity === "fixed" || diffPair.constraints.polarity === "swappable"
                ? diffPair.constraints.polarity
                : undefined,
          }
        : undefined,
    };

    lowerDiffPairEndpoints(ir, diffPair);
  }

  return ir;
}

function lowerComponentDef(componentDef: ComponentDefAst): CircuitIR["componentDefs"][string] {
  return {
    name: componentDef.name,
    pins: Object.fromEntries(componentDef.pins.map((pin) => [pin.name, { kind: pin.kind }])),
    groups: componentDef.groups ? Object.fromEntries(componentDef.groups.map((group) => [group.name, group.pins])) : undefined,
    attrs: componentDef.attrs,
  };
}

function lowerPackageDef(packageDef: PackageDefAst): CircuitIR["packageDefs"][string] {
  return {
    name: packageDef.name,
    pads: packageDef.pads,
  };
}

function lowerDeviceDef(deviceDef: DeviceDefAst): CircuitIR["deviceDefs"][string] {
  return {
    name: deviceDef.name,
    component: deviceDef.component,
    package: deviceDef.package,
    attrs: deviceDef.attrs,
    pinmap: Object.fromEntries(deviceDef.pinmap.map((entry) => [entry.pin, entry.pad])),
  };
}

function lowerDiffPairEndpoints(ir: CircuitIR, diffPair: DiffPairAst): void {
  for (const endpoint of diffPair.endpoints ?? []) {
    for (const bridge of endpoint.bridges) {
      const component = {
        ref: bridge.component.ref,
        type: bridge.component.type,
        value: bridge.component.value ?? bridge.component.params?.value,
        footprint: bridge.component.footprint,
        params: bridge.component.params,
      };

      addComponent(ir, component);
      addPinToNet(ir, diffPair.pNet, `${component.ref}.1`);
      addPinToNet(ir, diffPair.nNet, `${component.ref}.2`);
      ir.patterns.push({
        kind: "bridge",
        fromNet: diffPair.pNet,
        toNet: diffPair.nNet,
        component: component.ref,
        metadata: endpoint.near ? { endpoint: endpoint.name, near: endpoint.near } : { endpoint: endpoint.name },
      });
    }
  }
}
