# Changelog

## 0.1.5 - 2026-09-17

- 文档维护：README 与 CHANGELOG 的整理，片段与命令行为不变，故无需改动消费仓的 pin。

## 0.1.4 - 2026-09-16

- README 新增「跨仓一致性」一节：本地由消费仓 `npm test` 的 `loopback:check` / `guard:check` 逐字节比对，跨仓由消费仓 pin 精确版本保证。
- 该节记录 `scripts/guard-parity.mjs` 是人工诊断工具而非 CI 门禁。
- LICENSE 版权署名统一为 `xswt442-cmd`。

## 0.1.3 - 2026-09-14

- 新增两个 host 侧片段：`dist/loopback.js`（`dsh-loopback-helpers`）导出回环判定谓词；`dist/guard.js`（`dsh-host-guard`）导出 `portOf`、`GUARD_REASONS`、`DEFAULT_GUARD_POLICY` 与内部的 `bindGuard()` 工厂，调用方以 `policy` 传入自己的错误码与文案。
- `sync` / `check` 处理目标文件中所有已标记的片段，按 `FRAGMENTS` 顺序自下而上应用。
- 修正 README 与包描述：说明两个 host 侧片段的职责、固定顺序与 `bindGuard` 不导出的原因。
- 新增测试：多块同步与幂等 `check`、块顺序、片段不引入 `import`/`require`、判据不被重复声明。

## 0.1.2 - 2026-09-06

- 修正 README 的 `npm run dock:embed` 示例：补上 `package.json` 缺失的 `dock:embed` 脚本，用法改为 `npm run dock:embed -- check|sync path/to/client.js`（npm 传参需要 `--` 分隔符，CLI 接受 `sync|check` 子命令而非 `--check`）。新增从双语 README 提取命令逐条执行的 smoke test，防止文档与脚本漂移。

## 0.1.1 - 2026-09-04

- 归一化 `register()` 的 `label`：缺省、空白或非字符串的 `label` 回退为 `id`，避免渲染出 `aria-label="undefined"`。

## 0.1.0

- Add the Mini Utility Dock protocol v1 bootstrap.
- Add `sync` and `check` commands for self-contained DSH client bundles.
- Validate icons, registration ownership, placement, and load-order behavior.
