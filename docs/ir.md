# IR 设计

## 目的

`CircuitIR` 是 AST 降级之后使用的规范化语义表示。它需要足够稳定，能够被验证器、导出器和后续变换步骤共享，同时仍然保留电路设计意图。

## `ComponentIR`

表示电路中的一个元件实例。

- `ref`：规范化 reference designator，例如 `U1`、`R1`
- `type`：语义层的元件类型，例如 `MCU`、`Resistor`、`Capacitor`
- `value`：可选的便捷字段，用于常见数值型元件
- `footprint`：可选的未来映射目标
- `params`：从源语义中保留下来的附加参数

## `NetIR`

表示一个具名电气网络。

- `name`：网络名称
- `pins`：网络成员，例如 `U1.NRST`、`R1.1`、`C1.2`
- `kind`：可选的大类标记，例如 `signal`、`power`、`ground`

## `PatternIR`

表示建立在纯连通性之上的高层结构。

例如：

- `pullup`
- `series`
- `shunt`
- `decouple`
- `tap`
- `bridge`

这些 pattern 让后续工具能够在底层连通关系相似的情况下，仍然区分不同的设计意图。

## `DiffPairIR`

为差分对语义保留专门的数据结构，包括：

- 差分对名称
- 正负两侧网络
- 参与的 pins
- 成对约束信息

MVP-0 只定义类型，不实现真正展开；后续会补充更完整的扩展与校验。

## `ConstraintIR`

用于承载通用电路约束，采用相对灵活的结构。这样设计是因为最终约束词汇表还在演进，不适合过早完全固化。

## 为什么底层仍然保留 netlist，而不是只保留 pattern

Pattern 有助于表达意图，但下游工具仍然需要明确连通关系：

- validator 需要具体的 net 成员关系
- emitter 需要显式的 component-to-net 映射
- exporter 可能并不理解 OpenPCB 自定义 pattern
- 变换与调试工具通常更依赖规范化、可展平的数据结构

因此 IR 同时保留两类信息：

- 底层 netlist 事实
- 高层 pattern 摘要
