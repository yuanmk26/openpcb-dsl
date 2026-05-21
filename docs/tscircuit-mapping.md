# tscircuit 映射

## 当前计划

当前阶段先把 `CircuitIR` 直接映射到 tscircuit JSON，不再把 TSX 作为近期目标。

MVP-0 的 emitter 目标是尽快形成可检查、可测试、可对接下游的 JSON 输出，而不是先提供一层展示性质更强的 TSX 表示。

## 当前 JSON Emitter

当前 `Circuit JSON` emitter 返回的是占位式结构化记录，用于表达大致导出形态：

- source component records
- source net records
- source pattern records

它目前更像朝向 tscircuit JSON 的早期导出层，还不是最终 schema 契约。

## 当前尚不确定的部分

以下映射点仍然需要后续对照官方 schema 或实际消费接口确认：

- Circuit JSON 的最终实体分类
- 约束、net 和 diff pair 语义的目标表示
- OpenPCB 特有元数据应该保留到什么程度
