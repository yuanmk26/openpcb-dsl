# CLI 使用说明

`openpcb-dsl` 提供一个很薄的测试用 CLI，主要用于 DSL 调试、集成验证和端到端测试。

## CLI 的定位

- 这是对现有 parser / compiler / validate API 的命令行封装
- 当前主要目标是方便查看 AST、IR 和 diagnostics
- 它是推荐的测试与调试入口之一
- 如果你只是想“把 DSL 跑起来看看结果”，优先使用这个 CLI

同时需要明确：

- CLI 面向文本 DSL 使用场景
- AST 不是 CLI 的主要目标产物，而是其中一个可观察的中间阶段
- 对普通使用者，更推荐 `compile` 和 `validate`
- `parse` 更适合调试 parser 或观察内部结构

## 命令列表

### `openpcb-dsl parse <file>`

读取 `.opcb` 文件并输出 `ProgramAst` JSON。

适合场景：

- 调试 parser
- 查看 DSL 被解析成什么 AST
- 编译器开发和分阶段测试

```bash
openpcb-dsl parse examples/dsl/mcu-reset.opcb
```

### `openpcb-dsl compile <file>`

读取 `.opcb` 文件并输出 `CircuitIR` JSON。

这是当前更推荐的主命令，因为它更接近实际集成使用方式。

```bash
openpcb-dsl compile examples/dsl/simple-pin-ops.opcb
```

### `openpcb-dsl validate <file>`

读取 `.opcb` 文件，先编译为 `CircuitIR`，再输出 diagnostics JSON 数组。

适合场景：

- 快速检查 DSL 是否存在结构性问题
- 在测试或 CI 中做基础校验

```bash
openpcb-dsl validate examples/dsl/mcu-reset.opcb
```

## 可选参数

### `--pretty`

使用格式化 JSON 输出，便于人工阅读。

```bash
openpcb-dsl compile examples/dsl/simple-pin-ops.opcb --pretty
```

## 推荐用法

如果你的目标是普通调试或集成验证，优先使用：

```bash
openpcb-dsl compile <file> --pretty
openpcb-dsl validate <file> --pretty
```

只有在你需要观察 parser 中间结果时，再使用：

```bash
openpcb-dsl parse <file> --pretty
```

## 当前限制

- 只支持 `Ref Type(...)` 形式的顶层实例声明
- 只支持 `Node`、`PullUp`、`PullDown`、`Series`、`Shunt`、`Decouple`、`Tap`
- 还不支持 `diff_pair`
- 还不支持 `bridge`
- 还不支持 `stdin`、`--out`、emitter 子命令和交互模式
