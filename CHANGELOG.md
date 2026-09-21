# 更新日志

Release Notes 由对应版本段生成；最新版本在前。
英文版见 [CHANGELOG.en.md](CHANGELOG.en.md)。

## 0.1.7 - 2026-09-20

- 两个 host 侧片段的注释不再带消费仓数量：「all three plugins」「the three disagree」「the three plugins / diverged three times」改为不指名、不计数的说法。片段会逐字嵌入消费仓，那里的读者无从得知存在几个消费方，计数是工作区知识而非该仓知识。
- 片段字节因此变化，消费仓需重新运行 `loopback:sync` / `guard:sync` 并把 pin 升到 0.1.7。

## 0.1.6 - 2026-09-20

- 修正 `dist/guard.js` 里 `allowRemoteHost` 的说明文字：原文写作「不再被放行」，与代码相反——开启该模式时这两项检查被跳过，即被放行。JSDoc 一直是对的，只有这处行内注释写反。
- 该片段的字节因此变化，消费仓需重新运行 `guard:sync` 并把 pin 升到 0.1.6。

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
