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

### host guard 片段

嵌入到插件的 `lib/shared.js`：

```js
  // <dsh-host-guard>
  // </dsh-host-guard>
```

```sh
npx dsh-mini-utility-dock sync path/to/shared.js
npx dsh-mini-utility-dock check path/to/shared.js
```

片段导出 `LOOPBACK_HOSTNAMES`、`normalizeHostValue`、`hostHostname`、`portOf`、`isLoopbackName`、`isLoopbackAddress`、`GUARD_REASONS`、`DEFAULT_GUARD_POLICY`，并在内部提供 `bindGuard()` 工厂。它是「什么算 loopback」与「同源请求怎么判」的唯一源，覆盖 Host 头与 TCP 对端两条路径。

`bindGuard` **故意不导出**：消费仓会把嵌入块和自己的同名导出放进同一个文件，导出就会撞名。每个插件调用 `bindGuard()`，把自己的错误码与文案作为 `policy` 传入——**判定逻辑共享，词汇表各归各家**。三份副本曾漂移三次（三家都拒绝 IPv6 loopback；三家对 Host 拼写各执一词；未加方括号的 IPv6 Host 在一家静默跳过校验、另两家拒绝），共享与生成就是为了消除这个类别的问题：不要手改标记之间内容，改 `dist/guard.js` 后重新 `sync`；跨仓一致性由各消费仓的 `scripts/guard-parity.mjs` 校验，它比对生成块是否逐字节一致，并断言三家在每一道判定上给出相同结论。

也可用本仓库脚本同步（不硬编码任何消费仓路径，目标由调用方传入）：

```sh
npm run dock:embed -- check path/to/client.js  # 仅校验，漂移时非零退出
npm run dock:embed -- sync path/to/client.js   # 写入标记之间
```

消费仓另有 `guard:sync` / `guard:check`，语义相同，只是目标固定为自身的 `lib/shared.js`。

注册时若 `label` 缺省、空白或非字符串，会回退为 `id` 作为可访问名称，避免 `aria-label="undefined"`。
