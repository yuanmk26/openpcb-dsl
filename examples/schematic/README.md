# SchematicIR 示例

这里放置 `CircuitIR -> SchematicIR` lowering 之后的结构化快照，主要用于：

- 直观看到当前原理图中间层的实际输出形态
- 帮助协作者理解 `symbol / wire / net_label / junction` 等图元如何组织
- 为后续 schematic emitter、布局策略和快照测试提供稳定参考

当前示例文件：

- `simple-pin-ops.schematic.json`：对应 `examples/dsl/simple-pin-ops.opcb`

这些文件建议通过程序重新生成，而不是手工改写，以保证与当前 lowering 行为一致。
