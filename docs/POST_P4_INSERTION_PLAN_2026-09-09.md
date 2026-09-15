# P4 后新增需求插入计划（2026-09-09）

本文件是 `INTEGRATION_MASTER_PLAN_v4.md` 的增量排期。P0–P4 的历史编号和完成结论不重写；四份用户提供的 TXT 是设计输入，只有经当前代码、协议资料和测试验证的部分才进入“已完成”。

## 当前基线

- P0–P2：parser、SSE、Session、JSONL/JSON、Rewind、记录可靠性已建立。
- P3/P3-V：宝马固定壳、四页、红蓝视觉基础及字段接入已建立，真实车辆与最终视觉仍待验收。
- P4：本地 Leaflet、离线瓦片、CRS.Simple、两点标定和位置/yaw adapter 已完成开发环境验证。
- 当前手动 `race/freeRoam` 是服务端权威模式；Race 判断仍不足以直接升级为可靠 AUTO。

## 新排期

| 阶段 | 内容 | 进入下一阶段的门槛 |
|---|---|---|
| P5 Event/AUTO 基础 | 独立 `gameActivity`/候选/确认状态；综合排名、圈时、比赛时间、DistanceTraveled 行为和连续性；先 shadow log，再启用默认 AUTO；保留手动 override | 暂停、Rewind、结算、短断流不抖动；AUTO 不能由 `isRaceOn` 单字段或“正在记录”循环自证 |
| P6 地图实时行为 | Race 当前圈线、Session bounds、断段；Free Roam follow、拖图暂停/Resume、可选轨迹、Rec 独立、瞬移断段 | 换圈不丢累计范围；隐藏 MAP 仍更新；未录制仍跟车；Stop 不清地图 |
| P7 Route 数据基础 | SQLite 仅索引 routes/sessions/laps；原始大量包继续 JSONL/JSON；幂等 migration；内置带版本/来源的 LapScope catalog；历史 Race 有效时间线回填 | 空库可获得目录；旧 Session 不重跑；数据库失败不影响 UDP、原始记录和基础地图 |
| P8 Route 识别与 Race 增强 | 距离采样、清理/重采样、fingerprint、候选预筛、部分轨迹 matcher、置信度/歧义、最终确认、outline 缓存；随后接 Best/Ghost/Delta | 同路线不同车/走线可归并，共起点不同路线不误并；Rewind/瞬移不污染；已知路线可提前显示完整 outline |
| P9 Vehicle/RPM/BOOST | 稳定 CarOrdinal 识别；`niceScale(engineMaxRpm)`、动态刻度/红线/rpmRatio；车辆绑定 Boost peak 学习、UNKNOWN/READY/ACTIVE/PEAK 回差状态；Free Roam DRIVE 简化为 Power + Top Speed | 高低转车辆切换无旧量程残留；旧车 Boost peak 不泄漏；Boost 单位由真实样本确认后才显示 psi/bar |
| P9-V DYN可视化重构 | 移除滚动参数墙；上半区为车辆俯视模型及四轮邻近状态，下半区为油门/刹车/离合/手刹柱状指示；红蓝主题共用固定DOM | 1280×720及常见窗口无滚动条；四轮对应不串位；高频更新不重建DOM；未知字段明确显示而不伪造 |
| P10 动画系统 | `UIAnimationCoordinator` + 点火控制器；首次连接/自动模式/换车/长重连事件合并；主题、弧线唤醒、身份锁定、live handover；再分批接 Gear、G-ball、yaw、圈速、REC、页面等微动画 | 动画只改 display state；UDP/Session/MAP 持续；快速事件不排队；reduced-motion 可用；无 `transition: all` |
| P11 联调与长测 | 合成事件矩阵、旧 Session migration、SQLite 故障、AUTO 误判、模式+换车并发、地图/动画性能、真实驾驶 ≥30 分钟 | 合成与真机证据分别记录；UI 延迟和内存达到 v4 门槛 |
| P12 视觉/打包/交付 | 参考图终验、SEA/EXE 静态资源和 SQLite/native 依赖验证、许可证清单 | 开发版与打包版一致；瓦片发布权未解决前不把瓦片打进公开发行物 |

## 四份新增文件的归属

### Race SQLite / Route Identification

拆入 P5、P7、P8，不直接塞进浏览器 Leaflet：

- P5 先提供可信 Event 生命周期。
- P7 建表、catalog、历史回填与失败降级。
- P8 才执行几何识别、完整轮廓、Best/Ghost/Delta 关联。
- Route matcher 只消费按距离抽样的有效点，约 2–5 Hz；UDP 原包与记录不降采样。
- 当前 Node 24 可用 `node:sqlite`，但现有 bundle 目标写的是 Node 20，因此 SQLite 驱动必须先做 SEA/目标运行时 spike，不能只按本机开发环境决定。

### BOOST READY / ACTIVE / PEAK

归入 P9，动画归入 P10：

- 固定 RPM 区只放 `BOOST + 一个动态状态词`，四页常驻且不重建。
- DYN 继续显示连续原始 Boost；确认实际单位前保持 `raw`。
- PEAK 使用当前车辆已观察峰值的比例、最小样本和进入/退出回差，不能全车共用固定绝对阈值。
- Profile 不能只绑定 CarOrdinal；PI、最大转速等改装特征明显变化时必须失效或重学。绝对有效正压只负责 READY/ACTIVE，成熟峰值比例负责 PEAK。

### AUTO / Dynamic RPM / Ignition

拆入 P5、P9、P10：

- AUTO 是服务端 Event 状态的消费者，不自行猜比赛。
- `autoPolicy`、`detectedActivity`、`manualOverride`、`effectiveMode` 分开保存；记录状态只是结果，不能反过来证明 Race。
- 动态 RPM 和稳定换车识别先于点火动画。
- 点火只接管 visual/display state；最新 telemetry、地图和记录一直运行。
- `MODE + CAR_CHANGE` 等短时间事件合并一次，动画结束落到最新目标，不补播积压动画。

### Global UI Micro Animations

归入 P10，按优先级分批：Ignition/Mode/Car → Safety/Shift/Rewind → Race event → Driving feedback → Cosmetic。先实现调度、取消接管和 reduced-motion，再加单个动画，禁止各组件自行排队。

### DYN 无滚动驾驶视图

插入为P9-V，位于P9车辆/单位状态稳定之后、P10动画之前。详细布局、字段裁剪和验收标准见`docs/P9V_DYN_COCKPIT_PLAN.md`。本阶段只重构DYN展示层，不修改parser、telemetry state、Session或记录格式。

## FH6 数据输出设置图如何填写

程序当前默认 UDP 监听为 `0.0.0.0:20440`，网页端口 `3000` 与游戏 Data Out 无关。

同一台 Windows 电脑运行 FH6 和本程序时：

| FH6 设置项 | 填写值 |
|---|---|
| 数据输出 | 开启 |
| 数据输出 IP 地址 | `127.0.0.1` |
| 数据输出 IP 端口 | `20440` |

如果接收程序运行在另一台局域网电脑，IP 改为接收电脑的局域网 IPv4（例如 `192.168.1.20`），端口仍为 `20440`，并允许 Windows 防火墙入站 UDP 20440。不要把浏览器端口 `3000` 填进游戏。

启动程序后，控制台应出现 `[udp] listening ...:20440`。进入实际驾驶画面后访问 `/debug`，`packetsTotal` 应持续增加；菜单中不发包不应误判为配置失败。若同机 `127.0.0.1` 无包，再尝试本机局域网 IPv4，并检查端口占用和防火墙。

## 需要真实数据确认的声明

- `isRaceOn` 在 Free Roam 的具体行为、AUTO 阈值、DistanceTraveled 语义、Boost 单位和 yaw 方向均保留为待真机验证。
- LapScope 的目录/算法可作为 MIT 参考，但导入数据要固定版本、保存来源和更新策略，不能在首次启动时强制联网。
- FH6 地图瓦片再分发许可仍未确认，与 Route catalog 的代码许可不是同一件事。
