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

### loopback 助手片段

嵌入到插件的 `lib/shared.js`：

```js
  // <dsh-loopback-helpers>
  // </dsh-loopback-helpers>
```

```sh
npx dsh-mini-utility-dock sync path/to/shared.js
npx dsh-mini-utility-dock check path/to/shared.js
```

片段导出 `LOOPBACK_HOSTNAMES`、`normalizeHostValue`、`hostHostname`、`isLoopbackName`、`isLoopbackAddress`，是「什么算 loopback」的唯一判定源，同时覆盖 Host 头与 TCP 对端两条路径。三份副本曾两次漂移（一次三家都拒绝 IPv6 loopback，一次三家对 Host 拼写各执一词），共享与生成就是为了消除这个类别的问题：不要手改标记之间内容，改 `dist/loopback.js` 后重新 `sync`；跨仓一致性由各消费仓的 `scripts/guard-parity.mjs` 校验。

也可用本仓库脚本同步（不硬编码任何消费仓路径，目标由调用方传入）：

```sh
npm run dock:embed -- check path/to/client.js  # 仅校验，漂移时非零退出
npm run dock:embed -- sync path/to/client.js   # 写入标记之间
```

消费仓另有 `loopback:sync` / `loopback:check`，语义相同，只是目标固定为自身的 `lib/shared.js`。

注册时若 `label` 缺省、空白或非字符串，会回退为 `id` 作为可访问名称，避免 `aria-label="undefined"`。
