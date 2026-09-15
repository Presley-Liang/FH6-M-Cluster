# P7 SQLite 路线索引底座

日期：2026-09-09

## 本轮范围

新增独立的 `RouteIndexStore`，只持久化路线、Session、圈和路线识别结果。原始 324-byte UDP 包仍由现有 JSONL/JSON 记录系统保存；本轮不接 UI、parser 或 runtime。

## 设计

- 使用 `PRAGMA user_version` 标记 schema 版本。
- 每个版本的 migration 与版本号更新放在同一事务中；失败整体回滚。
- 初始化与各类写入均幂等，Session 和圈可由历史回填安全重试。
- 每条路线必须带稳定 `catalogKey`；本地观察路线应使用由指纹生成的稳定键，避免重试时产生重复路线。
- `matched`、`ambiguous`、`unknown` 分开保存；只有唯一匹配才能把 `route_id` 写回 Session。
- `backfill_version` 支持旧 Session 分批回填，并避免重复处理。
- 开启 foreign keys 和 WAL；删除 Session 会级联删除圈与匹配结果。

## 运行时兼容边界

当前开发环境 Node 24.13.0 提供实验性的 `node:sqlite`，因此没有增加 npm 依赖。模块采用动态导入，并已通过可选ArchiveIndexCoordinator接入应用启动路径；驱动不存在时自动禁用索引并报告warning，UDP与原始记录继续运行。项目的 Node 20 打包目标不具备该内置模块；P12打包前仍必须升级运行时或选择可打包的SQLite驱动。

## 后续接线

1. 已导入带来源说明的LapScope 77条catalog快照。
2. 已在现有Session最终落盘之后异步更新SQLite，并对完成历史归档幂等回填。
3. SQLite写入失败只产生诊断告警，不改变原始记录成功状态。
4. P8 matcher将写入候选、置信度和最终匹配；歧义结果保持未绑定。
