# 语法设计

## Pin-Centered DSL

OpenPCB DSL 的设计出发点是：很多真实电路结构，都是从某个器件引脚出发，再描述这个引脚如何被连接、上拉、串联、并联或测试。

例如：

```opcb
U1 MCU(
  NRST.Node(RESET)
    .PullUp(R1 Resistor(value=10k), to=3V3)
    .Shunt(C1 Capacitor(value=100nF), to=GND)
);
```

当前文档约定里，元件例化使用空格分隔 `ref` 和 `type`，例如 `U1 MCU(...)`、`R1 Resistor(...)`，不再要求 `:`。

这段语义可以自然理解为：

1. 把 `NRST` 绑定到主节点 `RESET`
2. 在 `RESET` 和 `3V3` 之间添加上拉
3. 在 `RESET` 和 `GND` 之间添加并联电容

## 核心操作

### `Node(name)`

把引脚绑定到它的主 node / net。当前设计里这是必须的，因为后续所有链式操作都需要一个稳定的“当前 net”作为展开起点。

### `PullUp(component, to=VCC)`

在当前 node 与某个电源网络之间加入一个辅助元件，通常是电阻。IR 会同时保留底层连线信息和 `pullup` pattern。

### `Series(component, to=targetNet)`

在当前 node 和目标 net 之间加入一个串联的双端辅助元件。IR 会将其记录为 `series` pattern。

### `Shunt(component, to=GND)`

在当前 node 和另一个参考网络之间加入双端辅助元件，常见场景是对地并联。IR 会将其记录为 `shunt` pattern。

### `Decouple(component, to=GND)`

在基础连线语义上与 `Shunt` 相似，但 pattern 层会标记为 `decouple`，方便未来布局或约束逻辑区分去耦器件。

### `Tap(component)`

在当前 net 上挂接一个单端或简单辅助器件，典型用途是测试点、探针点等。

## 为什么每个 pin 都必须先绑定主 node

要求先写 `Node()` 有几个明确好处：

- 链式操作拥有清晰的当前 net
- 校验逻辑可以围绕规范的 pin-to-net 关系工作
- emitter 能同时重建底层连通性和高层 pattern
- 后续变换不必反推一个 pin 最初属于哪个网络

## 为什么 diff pair 不应该被硬塞进单 pin 链式语法

差分对涉及正负两侧网络的耦合语义、端点局部规则、成对约束，以及有时跨 p/n 两侧的 bridge 元件。这些内容更适合专门的结构化语法，而不是过度复用单个 pin 的链式表达。

因此 MVP-0 只先保留 diff pair 的 AST / IR 类型，不急于固定其文本语法实现。
