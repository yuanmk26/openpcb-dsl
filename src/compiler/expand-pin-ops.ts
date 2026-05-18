import type { InstanceAst, PinExprAst, PinOperationAst } from "../ast/nodes";
import { addComponent, addPinToNet, type CircuitIR, type ComponentIR } from "../ir/circuit-ir";

export function expandPinExpression(ir: CircuitIR, instance: InstanceAst, pinExpr: PinExprAst): void {
  const instancePinRef = `${instance.ref}.${pinExpr.pin}`;
  addPinToNet(ir, pinExpr.node, instancePinRef);

  for (const operation of pinExpr.operations) {
    expandPinOperation(ir, pinExpr.node, operation);
  }
}

function expandPinOperation(ir: CircuitIR, currentNode: string, operation: PinOperationAst): void {
  switch (operation.kind) {
    case "pullup":
    case "pulldown":
    case "series":
    case "shunt":
    case "decouple":
    case "bridge": {
      const component = normalizeComponent(operation.component);
      addComponent(ir, component);
      addPinToNet(ir, currentNode, `${component.ref}.1`);
      addPinToNet(ir, operation.to, `${component.ref}.2`);
      ir.patterns.push({
        kind: operation.kind,
        fromNet: currentNode,
        toNet: operation.to,
        component: component.ref,
        metadata: operation.metadata,
      });
      return;
    }
    case "tap": {
      const component = normalizeComponent(operation.component);
      addComponent(ir, component);
      addPinToNet(ir, currentNode, `${component.ref}.1`);
      ir.patterns.push({
        kind: "tap",
        fromNet: currentNode,
        component: component.ref,
        metadata: operation.metadata,
      });
      return;
    }
    default: {
      const exhaustiveCheck: never = operation;
      throw new Error(`Unsupported pin operation: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}

function normalizeComponent(component: {
  ref: string;
  type: string;
  value?: string;
  footprint?: string;
  params?: Record<string, string>;
}): ComponentIR {
  return {
    ref: component.ref,
    type: component.type,
    value: component.value ?? component.params?.value,
    footprint: component.footprint,
    params: component.params,
  };
}
