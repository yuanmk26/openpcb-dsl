import type { DiffPairAst } from "../ast/nodes";
import type { CircuitIR } from "../ir/circuit-ir";

export function expandDiffPair(_ir: CircuitIR, _diffPair: DiffPairAst): void {
  throw new Error(
    "Diff pair expansion is not implemented in MVP-0. Define AST and IR first, then add pair-specific lowering in MVP-2.",
  );
}
