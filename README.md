# dsh-mini-utility-dock

DSH 插件共享的源码片段与嵌入 CLI。片段在构建时写入消费插件，使插件无需依赖本包即可独立发布。

## 片段

三个片段，均由标记界定。

| 片段 | 标记 | 目标文件 | 导出 |
| --- | --- | --- | --- |
| dock 引导 | `dsh-mini-utility-dock` | `lib/client.js` | — |
| loopback 判定 | `dsh-loopback-helpers` | `lib/shared.js` | `LOOPBACK_HOSTNAMES`、`normalizeHostValue`、`hostHostname`、`isLoopbackName`、`isLoopbackAddress` |
| host 请求守卫 | `dsh-host-guard` | `lib/shared.js` | `portOf`、`GUARD_REASONS`、`DEFAULT_GUARD_POLICY` |

`dsh-loopback-helpers` 定义地址的归属：Host 头与 TCP 对端两条路径共用同一判定。`dsh-host-guard` 定义准入策略，并在内部提供 `bindGuard()` 工厂。

## 使用

在目标文件中写入标记，然后运行 CLI。

```sh
npx dsh-mini-utility-dock sync path/to/client.js
npx dsh-mini-utility-dock check path/to/client.js
```

`sync` 保留标记及其缩进并写入片段；`check` 在内容与片段不一致时以非零状态退出。CLI 处理目标文件中所有已标记的片段，按 `FRAGMENTS` 顺序自下而上应用。仅含单个片段的文件行为不变。

本仓库另提供等价入口，目标路径由调用方传入：

```sh
npm run dock:embed -- check path/to/client.js  # 仅校验，漂移时非零退出
npm run dock:embed -- sync path/to/client.js   # 写入标记之间
```

消费插件以 `loopback:sync` / `guard:sync` 调用同一 CLI，目标固定为自身的 `lib/shared.js`；任一命令都会同步该文件中的两个片段。

## host 侧两个片段的约定

`lib/shared.js` 中的两个片段顺序固定，`dsh-loopback-helpers` 在前。

顺序是功能要求，不是风格约定。两者位于同一文件，`dsh-host-guard` 直接使用前一片段导出的模块级名字，因此它既不重新声明这些判据，也不 import 兄弟模块：重新声明与 import 都会与同文件内的声明冲突，且 import 会破坏插件独立发布的约束。`guard-parity` 与消费仓的 `check` 都会在该顺序被颠倒时失败。

`bindGuard` 不从片段导出。消费插件在同一文件中声明自己的 guard 导出（通常沿用 `createGuard` 等既有名字），导出同名标识符会冲突。每个插件调用 `bindGuard()`，通过 `policy` 传入自身的错误码与文案；判定逻辑共用，错误词汇由各插件持有。

## 跨仓一致性

三份手写副本曾漂移三次：三家都拒绝 IPv6 loopback；三家对 Host 拼写各执一词；未加方括号的 IPv6 Host 在一家静默跳过校验、另两家拒绝。现在由两条性质不同的检查覆盖：

- **本地**。每个消费仓的 `npm test` 运行 `loopback:check` / `guard:check`，把本仓的两个块与**它所 pin 的该 dock 版本**的 `dist/` 逐字节比对。这覆盖「私自改块」与「忘了重新 `sync`」。
- **跨仓**。dock 版本发布后不可变，且消费仓 pin 的是精确版本，因此「三仓 pin 同一版本」等价于「三仓的块逐字节相同」。跨仓性质由 pin 的一致性推出，不需要比对三份源码树。唯一现实风险是遗漏对某个 peer 的同步 bump。

消费仓的 `scripts/guard-parity.mjs` 把上述跨仓性质直接检出来，含三仓 pin 一致性断言，也断言三仓在每一道判定上结论相同。

它是**人工诊断工具，不是 CI 门禁**：它断言的性质在 peer 处于不同分支时不成立 —— `dev` 推送时 peer 检出会解析到默认分支。请在三个检出处于同一分支时运行它（发版前或发版后），此时报错才是真信号。

## 开发

片段的唯一来源是 `dist/`。修改后运行 `npm test`；已嵌入片段的消费插件需重新运行对应的 `sync` 命令。

片段不得包含 `import` 或 `require`：它们与消费插件自身的代码位于同一文件，且消费插件必须独立发布。测试对此约束进行断言。

## 注册

`label` 缺省、空白或非字符串时回退为 `id`，避免渲染出 `aria-label="undefined"`。
