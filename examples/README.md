# 示例目录

示例目录按编译阶段组织：

- `dsl/`：DSL 输入样例
- `dsl/imports/`：多文件定义层导入样例
- `ast/`：AST 快照
- `ir/`：IR 快照
- `schematic/`：SchematicIR 快照
- `emitters/`：导出器输出样例

当前新增的示例包括：

- `examples/dsl/imports/vnext-device.defs.opcb`
- `examples/dsl/imports/vnext-device-board.opcb`
- `examples/ast/vnext-device-imports.ast.json`
- `examples/ir/vnext-device-imports.ir.json`
- `examples/schematic/simple-pin-ops.schematic.json`
- `examples/emitters/circuit-json/simple-pin-ops.schematic.circuit.json`
- `examples/emitters/svg/simple-pin-ops.schematic.svg`

说明：

- `ast/` 下文件是结构化快照，便于协作者理解 parser 输出
- `ir/` 下文件建议通过 `openpcb-dsl compile <input.opcb> --pretty` 重新生成
- `schematic/` 下文件建议通过 `CircuitIR -> SchematicIR` lowering 重新生成
- `emitters/` 下文件建议通过对应 CLI emitter 命令重新生成
