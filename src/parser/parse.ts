import type { ProgramAst } from "../ast/nodes";

export function parseOpenPcbDsl(_source: string): ProgramAst {
  throw new Error(
    "parseOpenPcbDsl is not implemented in MVP-0. Use AST-based compilation for now; text parser support is planned for MVP-1.",
  );
}
