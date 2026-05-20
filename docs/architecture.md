# 架构说明

## 为什么拆成独立库

`openpcb-dsl` 是 OpenPCB 生态中的编译核心。它需要保持确定性、可测试性和可复用性，因此不直接绑定某个具体产品界面，而是作为独立 TypeScript 库存在。

## 与其他模块的关系

- OpenPCB agent：生成或编辑 DSL / AST，并消费 diagnostics 或 IR
- OpenPCB GUI：展示 IR、执行校验，后续也可承载交互式编辑
- VSCode 插件：提供语法感知、诊断和预览
- 导出器：消费统一的 `CircuitIR`

## 分层职责

### 文件加载层

多文件模式下，新增一个“文件加载与合并”阶段：

`entry file -> parse per file -> expand imports -> merge ProgramAst -> compileAstToIr`

职责包括：

- 读取入口文件
- 解析顶层 `import`
- 按当前文件目录解析相对路径
- 递归加载被导入文件
- 检测循环导入
- 限制被导入文件只能包含定义层内容
- 检查重复定义冲突

### AST

AST 保留接近语法层的用户意图表示。它表达 `component / package / device / inst / diff_pair` 以及顶层 `import`，但不负责文件系统语义。

### Compiler

Compiler 负责把 AST lowering 为规范化的 `CircuitIR`。它不处理 `import` 路径，只处理已经合并完成的 `ProgramAst`。

### IR

IR 是验证、导出和后续优化步骤共享的稳定中间层，同时保留定义层事实与设计层事实。

### Emitters

Emitter 负责把 IR 转换为下游目标格式。当前输出仍偏早期映射，不补充尚未确认的目标语义。

## 当前边界

- 字符串入口 `parseOpenPcbDsl(source)` / `compileOpenPcbDsl(source)` 仍只处理单段文本
- 文件入口 `parseOpenPcbDslFile(path)` / `compileOpenPcbDslFile(path)` 负责展开定义层导入
- 多文件能力只覆盖定义层复用，不覆盖设计层拆分
