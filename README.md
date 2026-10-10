# FH6 年代仪表

11 个年代 × 欧洲／美洲／日本，共 33 套独立仪表主画面；32 套自定义仪表与原有 2015–2019 欧系基准共用遥测和动画基础。

## 当前状态

- 用户于2026-10-10确认当前版本可以玩；长时间驾驶、真实EV、断线和异常恢复仍单独验收。
- Race／Free是主题内的模式覆盖，EV是动力覆盖，不增加基础主题数量。
- Race已按每套实际画面实现竞技配色与专属双向动作：冷黑灰材质、冷白读数，搭配性能红／电蓝／电光青／荧光绿；32套新增动作，原欧系保留已认可的完整切换。普通信息与比赛信息沿用真实数据映射。
- 换车：旧表退场 → 全黑 → 一张融合品牌、车型与参数的车型卡 → 卡片退场 → 新表构建 → 扫表 → 最新遥测接管。无需独立车标轮次或ENGINE自检。
- Manual用于主题与模式调试；新主题只显示Race／Free必要数据，原欧系保留已认可的构图和动画。
- 未知／陈旧数据降级，不制造SOC、水温、油压或真实再生等读数。原厂精细拟真已取消。

## 启动

使用支持Node内置SQLite的环境，安装依赖后运行：

```powershell
npm install
npm start
```

网页默认 `http://127.0.0.1:3000/`；本机游戏Data Out目标为 `127.0.0.1`、UDP `20440`。

已有桌面接收器占用20440／3000时，运行 `npm run live` 后打开 `http://127.0.0.1:3002/`，以当前源码UI连接原接收器。`?preview=1`不表示已接收游戏数据。

## 项目入口

| 内容 | 文件 |
|---|---|
| 当前进度与待办 | [PROGRESS.md](PROGRESS.md) |
| 33套构图与Race设计大纲 | [设计台账](docs/ERA_REGION_33_DESIGN_EXPECTATIONS.md) |
| 真实字段与降级边界 | [遥测字段表](docs/TELEMETRY_FIELD_MATRIX.md) |
| R01–R36修复与历史证据 | [审查记录](docs/ERA_REGION_COMPLETED_THEMES_LAYOUT_AUDIT_2026-09-30.md) |
| 更新历史 | [CHANGELOG.md](CHANGELOG.md) |
| 旧计划、来源、预览与检查证据 | [归档索引](docs/archive/README.md) |

`src/`为接收、会话与页面入口；`public/js/`为共享数据、动画和主题组件；`public/css/`为样式。驾驶记录在`sessions/`，日志在`logs/`，构建产物在`dist/`，这些目录保持原位置。

本轮Race改版、短暂N缓冲与文档归档一起提交到独立PR审阅。既有修复[PR #6](https://github.com/Presley-Liang/FH6-M-Cluster/pull/6)已合并；本轮实际游戏与桌面EXE仍分别验收，不以本地检查代替云端审核。

检查入口为`npm test`。自动检查、模拟预览和真实驾驶分别记录。

2026-10-10本轮：298项回归、198组Free基线对照、66次实际时间动画及打断／车型卡／针影检查通过；[验证汇总](docs/previews/race-combat-2026-10-10/verification-summary.json)。本轮读取诊断时实际游戏包数0，真实驾驶观感仍待验收。

PR #7复审的3项P2已返修：欧系scan辉光、车型卡身份样式、Civic竞技描线。新增回归后301/301通过，8组欧系阶段、132组车型卡和8组Civic浏览器检查通过；[返修证据](docs/previews/race-combat-2026-10-10/pr7-review-fixes.json)。新提交重新申请云端审核，暂不合并，真实游戏与桌面EXE仍待验收。
