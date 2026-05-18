# tscircuit 映射

## 当前计划

长期目标是把 `CircuitIR` 映射到两个下游目标：

- tscircuit 兼容的 TSX 表示
- Circuit JSON 表示

MVP-0 只提供初步 emitter 层，主要用于查看和调试，不构成最终兼容性承诺。

## 当前 TSX Emitter

目前的 TSX emitter 会：

- 输出一个 `<board>` 包裹结构
- 输出少量已知元件，例如 resistor、capacitor、testpoint
- 通过注释保留 net 成员关系
- 在真实目标 API 尚不明确的地方留下明确 TODO

这样做的目标是让输出可读、可检查，同时避免假装 tscircuit 目标接口已经完全确定。

## 未来的 Circuit JSON Emitter

当前 Circuit JSON emitter 返回的是占位式结构化记录，用于表达大致导出形态：

- source component records
- source net records
- source pattern records

它目前更像规划中的中间输出，而不是最终 schema 契约。

## 当前尚不确定的部分

以下映射点仍然需要后续对照官方 API 或 schema 确认：

- tscircuit 中元件 JSX 名称和 props 约定
- 辅助元件连通关系在 TSX 中的最佳表达方式
- Circuit JSON 的最终实体分类
- 约束和 diff pair 语义的目标表示
- OpenPCB 特有元数据应该保留到什么程度
