# Changelog

## 0.1.4 - 2026-09-16

- README 新增「跨仓一致性」一节，区分两类性质：**本地**——消费仓 `npm test` 的 `loopback:check` / `guard:check` 把本仓两个片段与它们所 pin 的本仓版本逐字节比对，覆盖「私自改块」与「忘了重新 `sync`」；**跨仓**——本仓版本发布后不可变、消费仓 pin 的是精确版本，故「三仓 pin 同一版本」已经蕴含「三仓的块逐字节相同」。
- 该节同时记录：消费仓的 `scripts/guard-parity.mjs` 是**人工诊断工具而非 CI 门禁**，理由是它断言的性质在 peer 检出解析到不同分支时不成立，门禁化会误报。
- LICENSE 的版权署名统一为 `xswt442-cmd`。

## 0.1.3 - 2026-09-14

- 新增两个 host 侧片段：`dist/loopback.js`（`dsh-loopback-helpers`）导出 `LOOPBACK_HOSTNAMES`、`normalizeHostValue`、`hostHostname`、`isLoopbackName`、`isLoopbackAddress`；`dist/guard.js`（`dsh-host-guard`）导出 `portOf`、`GUARD_REASONS`、`DEFAULT_GUARD_POLICY` 与内部的 `bindGuard()` 工厂。调用方以 `policy` 传入自己的错误码与文案，判定逻辑不随之分叉。
- `sync` / `check` 改为处理目标文件中**所有**已标记的片段，按 `FRAGMENTS` 顺序自下而上应用，不再要求恰好一个块。单块调用方的行为不变。
- 修正 README 与包描述：说明 host 侧两个片段各自的职责、固定顺序，以及 `bindGuard` 不导出的原因。
- 新增测试：多块同步与幂等 `check`、块顺序、两个片段均不引入 `import`/`require`、`bindGuard` 不导出且判据不被重复声明。

## 0.1.2 - 2026-09-06

- 修正 README 的 `npm run dock:embed` 示例：补上 `package.json` 缺失的 `dock:embed` 脚本，用法改为 `npm run dock:embed -- check|sync path/to/client.js`（npm 传参需要 `--` 分隔符，CLI 接受 `sync|check` 子命令而非 `--check`）。新增从双语 README 提取命令逐条执行的 smoke test，防止文档与脚本漂移。

## 0.1.1 - 2026-09-04

- 归一化 `register()` 的 `label`：缺省、空白或非字符串的 `label` 回退为 `id`，避免渲染出 `aria-label="undefined"`。

## 0.1.0

- Add the Mini Utility Dock protocol v1 bootstrap.
- Add `sync` and `check` commands for self-contained DSH client bundles.
- Validate icons, registration ownership, placement, and load-order behavior.
