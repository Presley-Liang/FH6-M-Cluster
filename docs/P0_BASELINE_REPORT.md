# P0 基线记录 · 2026-09-09

本次结果：`node --test tests/*.test.js` 11/11通过；清单包含89个JSON字段、63个DOM标识和4个源文件SHA256。通过范围为合成parser、Session helper和实际HTTP/UDP/SSE服务链路，不包含浏览器渲染或完整Session编排修复。

依据：INTEGRATION_MASTER_PLAN_v4.md。P0只建立基线，不修改UDP parser、Session状态机和页面运行逻辑。

新增node:test检查：合成324-byte解析、Session纯逻辑、实际Node服务HTTP启动、原页面关键DOM、模式API以及UDP→SSE字段传输。服务测试使用临时sessions目录与临时端口，不触碰用户记录。合成fixture不代表真实FH6数据验证。

运行：`npm test`。字段/DOM及源码SHA256基线：`node scripts/capture-baseline.js`，输出tests/fixtures/baseline-manifest.json。

当前真实历史Session未提供，不伪称历史档兼容已验证。323字节兼容行为、非有限浮点值处理按当前parser记录；是否收紧规则留至后续明确实现。Rewind helper通过不代表上层编排正确，progress=0调用问题仍需P2修复。

P0自动化检查与源码清单可在本阶段完成；浏览器实际渲染、真实包和历史记录、真实驾驶长测分开标记待验证。此前file URL浏览器策略拒绝仍未解决，本次HTTP检查只验证服务输出，不冒称截图验收。

v4视觉变更已采纳：宝马固定仪表壳、中央四页、蓝红科幻模式和高转灯效。配色及动画量化要求见V4_COLOR_MOTION_SPEC.md，P0不提前重构显示层。
