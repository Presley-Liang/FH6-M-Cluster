# P1 / P2 实施与验证

依据：INTEGRATION_MASTER_PLAN_v4.md。第二步为 P1 无视觉拆层，第三步为 P2 Session 可靠性；本阶段不提前重做宝马 UI 或地图。

## P1 边界

- `src/index.js`：进程入口，组装 UDP、HTTP 和运行状态。
- `src/ui/default-html.js`：现有 HTML/CSS/浏览器渲染模板。
- `public/js/telemetry-store.js`：浏览器最新快照和订阅分发；订阅者错误隔离，不让地图绘制异常阻断其他遥测订阅。
- Session 编排、持久化及导出独立于 UI，后续地图只消费遥测/Session 状态。
- 原 parser 和 JSON 遥测字段保持基线；HTTP 路由保持兼容。

浏览器 store 工厂在生成 HTML 时内嵌，因此不新增 CDN 或静态模块请求。P1 原 CSS 的 SHA256 与下载基底相同，63 个 DOM 标识继续存在；这些仅证明源码契约，不能代替浏览器视觉验收。

## P2 验收范围

短手动记录、无后续包 Stop、模式切换关闭、首帧归属、暂停/回溯、换车分段、墙钟宽限期、重启 ID 防覆盖、异步增量日志、索引与中断恢复、保存失败可见性。

测试使用明确标记的合成 324-byte UDP 包；不把合成验证称为真实游戏验证。真实历史存档、长时间驾驶、真实暂停/回溯行为需另行验收。

## 视觉衔接

熄灭归零 → 暗场换色 → 点火满量程 → 回到最新实时值 → 稳定，已补入 V4_COLOR_MOTION_SPEC.md。这个序列只覆盖视觉指针，不能修改真实遥测或暂停记录。完整红蓝科幻主题、点火动画与快速切换接管在 P7 实施。

## 当前验证

`npm test`：34/34通过。parser.js与buffer-utils.js的SHA256与P0基线一致；原CSS哈希相同，63个DOM标识保留。包含：

- 7项parser基线、3项旧Session helper契约、1项HTTP/UDP/SSE基线。
- 5项Session端到端集成、4项runtime竞态/圈速/初始保存失败测试。
- 6项store持久化/恢复/旧格式测试、2项有效时间线测试。
- 3项SSE背压与异常隔离、3项UI/store分离契约测试。

旧Session helper保留为兼容参考；在线编排现在由src/session/runtime.js负责，不再使用旧helper的延迟关停逻辑。

## 数据及存储协议

- 每个Session生成唯一递增数值ID，启动时扫描现有文件ID，避免正常重启或系统时钟回拨导致覆盖。
- 原始包保存在`.jsonl`，200ms周期异步刷写；内存待写队列默认上限8MiB。达到上限拒绝新记录包、报告计数并停止记录，遥测广播继续。
- Stop/切模式先同步解除旧Session归属，再等待持久化后回应HTTP；命令串行处理，保存期间后续UDP不会写入已关闭Session。
- `.json`流式生成，保留原始到达顺序与旧字段；`.meta.json`用于列表索引。旧无metadata的JSON启动时兼容读取。
- 回溯包带`timelineBreak=rewind`和segments；原始包不删除。回放及Compact使用effectiveTimeline剔除被回溯覆盖的未来段，圈速同步撤销；回放地图不跨标记段连线。
- Race使用用户选定Race模式和`isRaceOn && (racePosition > 0 || currentLap > 0)`，不是只凭isRaceOn。Free Roam记录由Rec/Stop控制。
- 默认2500ms墙钟宽限期，超时后结束Session；之后的数据建立新Session，不跨已超时关闭的Session自动合并。
- `/status`、`/debug`及SSE命名state事件提供记录/错误状态；浏览器原信息区域显示错误。POST `/recording-retry`重试，失败日志不静默删除。
- SSE对每个慢客户端仅保留最新telemetry和state各一条，发送异常只移除该客户端。

## 已知限制与后续门槛

- 尚无真实游戏包/真实历史记录/30分钟长测；测试中的旧JSON也是构造的兼容样本。
- 尚未进行浏览器渲染视觉验收或SEA打包验证；本地未安装esbuild开发依赖。
- 默认刷盘间隔存在尾部数据丢失窗口，未启用每批fsync，不承诺断电零丢失；损坏尾行原件保留并报告warning。
- JSON读取、导出及浏览器回放仍按请求加载完整记录，超长Session的大文件内存/导出压力需P8测试；持续录制主链不再累计完整包数组。
- 日志和完成JSON同时保留，磁盘长期增长，未实现自动清理。损坏到无法安全回退的日志停止自动追加，需人工恢复。
- 保存中断恢复以完整日志行及最近metadata为依据，末尾圈速/分段元数据的崩溃一致性仍需真机及故障长测。
- 现有地图的Free Roam隐藏行为在P1/P2保持原样；常驻地图、跟车和赛道视角按P4–P6实施，不能视为本次已完成。
