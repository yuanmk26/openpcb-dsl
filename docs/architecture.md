# 架构说明

## 为什么拆成独立库

`openpcb-dsl` 是 OpenPCB 生态中的编译核心。这个编译层需要具备确定性、可测试性和可复用性，因此不适合直接嵌入某一个具体产品界面，而应作为独立 TypeScript 库存在。

这样拆分后，语义模型可以保持稳定，而上层工具可以分别演进，不必把编译逻辑和界面、导出器或 agent 行为耦合在一起。

## 与其他 OpenPCB 模块的关系

- OpenPCB agent：生成或编辑 DSL / AST，并消费 diagnostics 或 IR。
- OpenPCB GUI：展示 IR、执行校验，后续也可能承载交互式编辑。
- VSCode 插件：提供语法感知、诊断和预览能力。
- KiCad exporter：消费规范化后的 IR，而不是直接依赖某种文本拼装结果。
- tscircuit / Circuit JSON exporter：把同一份 IR 映射到不同下游表示。

## 分层职责

### AST

AST 保留接近语法层的用户意图表示。它应该能够表达 `Node`、`PullUp`、`Series`、`Shunt` 这类 pin-centered 操作，但此时还不需要先压平成最终 netlist。

### Compiler

Compiler 负责把 AST 降级为规范化的 `CircuitIR`。它会把高层 pin operation 展开成明确的辅助元件、net 成员和 pattern 元数据。

### IR

IR 是验证、导出和后续优化步骤共享的稳定中间层。它同时保留底层 netlist 事实和更高层的 pattern 信息。

### Emitters

Emitter 负责把 IR 转换为下游目标格式。MVP-0 阶段这些输出都刻意保持保守和初步，不会伪造尚未确认的目标语义。

## 当前设计边界

MVP-0 有意不实现真实 parser。因为语法表面还在演进，但语义中间层已经可以先定义并测试。这样可以让上游和下游模块先围绕 AST、IR、diagnostics 和 emitter 集成，而不用等待最终文本语法完全定稿。
