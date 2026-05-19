# IR 示例

这里放置 `AST -> IR` lowering 之后的 IR 快照，主要用于：

- 直观查看当前 `CircuitIR` 的实际输出结构
- 辅助协作者理解 `components`、`nets`、`patterns` 等字段含义
- 为后续 emitter、validator 和文档演进提供稳定参考样例

当前示例文件：

- `simple-pin-ops.ir.json`：对应 `examples/dsl/simple-pin-ops.opcb`
- `mcu-reset.ir.json`：对应 `examples/dsl/mcu-reset.opcb`

这些文件建议通过以下命令重新生成，而不是手工改写：

```bash
openpcb-dsl compile <input.opcb> --pretty
```
