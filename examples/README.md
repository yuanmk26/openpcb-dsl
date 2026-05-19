# 示例目录

示例目录按编译阶段组织：

- `dsl/`：DSL 输入样例
- `ast/`：当前编译器可直接消费的 AST 样例
- `ir/`：IR 快照或说明性样例
- `emitters/tscircuit-tsx/`：TSX 输出样例
- `emitters/circuit-json/`：Circuit JSON 输出样例

当前仓库已经在 `dsl/`、`ast/` 和 `ir/` 下提供实际示例文件。

注意：

- `ast/` 下的文件当前是手工维护的结构化输入，不是 `.opcb` parser 自动生成的产物。
- `ir/` 下的快照建议通过 `openpcb-dsl compile <input.opcb> --pretty` 重新生成，以保证和当前 lowering 行为一致。
- 其余目录仍作为后续阶段产物的预留位置。
