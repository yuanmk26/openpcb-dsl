import type { ProgramAst } from "../ast/nodes";
import { createEmptyCircuitIr, addComponent, type CircuitIR } from "../ir/circuit-ir";
import { expandPinExpression } from "./expand-pin-ops";

export function compileAstToIr(ast: ProgramAst): CircuitIR {
  const ir = createEmptyCircuitIr();

  for (const instance of ast.instances) {
    addComponent(ir, {
      ref: instance.ref,
      type: instance.componentType,
      params: instance.params,
    });

    for (const pinExpr of instance.pins) {
      expandPinExpression(ir, instance, pinExpr);
    }
  }

  for (const diffPair of ast.diffPairs) {
    ir.diffPairs[diffPair.name] = {
      name: diffPair.name,
      pNet: diffPair.pNet,
      nNet: diffPair.nNet,
      pPins: diffPair.pPins,
      nPins: diffPair.nPins,
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
  }

  return ir;
}
