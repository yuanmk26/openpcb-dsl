# CLI 使用说明

`openpcb-dsl` 提供一个调试型 CLI，主要用于：

- 查看 AST
- 查看 IR
- 跑基础校验

它同时支持 legacy 和 vNext 文本语法，并且支持以入口文件递归展开定义层 `import`。

## 命令

### `openpcb-dsl parse <file>`

读取 `.opcb` 入口文件并输出 `ProgramAst` JSON。

适用场景：

- 调试 parser
- 查看 `import/component/package/device/inst/diff_pair` 是否按预期进入 AST
- 查看多文件定义层导入展开后的总 AST

```bash
openpcb-dsl parse examples/dsl/imports/vnext-device-board.opcb --pretty
```

### `openpcb-dsl compile <file>`

读取 `.opcb` 入口文件并输出 `CircuitIR` JSON。

这是更接近实际集成的主命令。

```bash
openpcb-dsl compile examples/dsl/vnext-diff-pair.opcb --pretty
```

### `openpcb-dsl validate <file>`

读取 `.opcb` 入口文件，先编译为 `CircuitIR`，再输出 diagnostics JSON。

```bash
openpcb-dsl validate examples/dsl/imports/vnext-device-board.opcb --pretty
```

## 可选参数

### `--pretty`

使用格式化 JSON 输出，便于人工阅读。

## 多文件行为

CLI 现在以入口文件为单位工作：

- 相对入口文件和被导入文件目录解析 `import`
- 递归展开定义层依赖
- 检测循环导入
- 合并多个文件中的 `component / package / device`
- 对重复定义直接报错

被导入文件当前只允许包含：

- `import`
- `component`
- `package`
- `device`

## 当前限制

- CLI 仍然是调试工具，不提供交互模式
- 还不支持 `stdin`
- 还不支持 `--out`
- emitter 子命令还没有接到 CLI
