# dsh-mini-utility-dock

DSH 插件共享的 canonical 片段与嵌入 CLI：一个 utility dock，以及一份 loopback 判定助手，都在构建时嵌入消费插件的源码。

## 使用

在目标文件中放置目标片段对应的标记，然后运行 CLI；片段由标记名选择。

### utility dock 片段

嵌入到插件的 `client.js`：

```js
  // <dsh-mini-utility-dock>
  // </dsh-mini-utility-dock>
```

```sh
npx dsh-mini-utility-dock sync path/to/client.js
npx dsh-mini-utility-dock check path/to/client.js
```

`sync` 保留标记及其缩进；`check` 在内容漂移时以非零状态退出。内嵌脚本通过 global protocol v1 在页面内去重，插件仍可单独运行。

### host 侧两个片段

插件的 `lib/shared.js` 同时嵌入**两个**块，顺序固定：

```js
  // <dsh-loopback-helpers>
  // </dsh-loopback-helpers>

  // <dsh-host-guard>
  // </dsh-host-guard>
```

```sh
npx dsh-mini-utility-dock sync path/to/shared.js
npx dsh-mini-utility-dock check path/to/shared.js
```

**谁负责什么**：`dsh-loopback-helpers` 是「什么算 loopback」——导出 `LOOPBACK_HOSTNAMES`、`normalizeHostValue`、`hostHostname`、`isLoopbackName`、`isLoopbackAddress`，覆盖 Host 头与 TCP 对端两条路径。`dsh-host-guard` 是策略——导出 `portOf`、`GUARD_REASONS`、`DEFAULT_GUARD_POLICY`，并在内部提供 `bindGuard()` 工厂。

**为什么必须分两块、且顺序固定**：一个是关于「地址是什么」的稳定事实，一个是关于「谁可以调 API」的策略；合起来会让策略的变动拖着判定一起走。两块进同一个文件，所以 `dsh-host-guard` **不再重复声明也不再 import 那些判据**，它直接用上面那块导出的模块级名字——重复声明或 import 都会炸（这是实测踩到的）。CLI 一次处理文件里**所有**已标记的块，按依赖顺序；把 guard 块放前面是真实缺陷，parity 检查会红。

**为什么共享**：三份手写副本漂移过三次——三家都拒绝 IPv6 loopback；三家对 Host 拼写各执一词；未加方括号的 IPv6 Host 在一家静默跳过校验、另两家拒绝。不要手改标记之间内容，改 `dist/loopback.js` 或 `dist/guard.js` 后重新 `sync`；跨仓一致性由各消费仓的 `scripts/guard-parity.mjs` 校验，它比对两个块是否逐字节一致、块外是否私藏实现、以及三家在每一道判定上是否给出相同结论。

`bindGuard` **故意不导出**：消费仓会把嵌入块和自己的同名导出放进同一个文件，导出就会撞名。每个插件调用 `bindGuard()`，把自己的错误码与文案作为 `policy` 传入——**判定逻辑共享，词汇表各归各家**。

也可用本仓库脚本同步（不硬编码任何消费仓路径，目标由调用方传入）：

```sh
npm run dock:embed -- check path/to/client.js  # 仅校验，漂移时非零退出
npm run dock:embed -- sync path/to/client.js   # 写入标记之间
```

消费仓另有 `loopback:sync` / `guard:sync`（语义相同，目标固定为自身的 `lib/shared.js`）；两者都会把文件里的两个块一起同步。

注册时若 `label` 缺省、空白或非字符串，会回退为 `id` 作为可访问名称，避免 `aria-label="undefined"`。
