# 全功能与宝马风格仪表 UI 整合总规划

> 2026-09-09执行补充：科幻色彩与动画按 [V4_COLOR_MOTION_SPEC.md](V4_COLOR_MOTION_SPEC.md)；P0证据见 [P0_BASELINE_REPORT.md](P0_BASELINE_REPORT.md)。新版UI为宝马固定壳，不再以旧卡片排布作视觉验收。水温缺失时不得伪造。

版本：4 · 2026-09-09更新 · P1/P2已实施，P3接入中；新增 [P3-V参考图重构](P3V_REFERENCE_REBUILD.md)，通过外观验收后再推进P4。

本文件为唯一执行顺序。ARCHITECTURE_PLAN.md 的现状资料保留；PROGRAMMING_ROADMAP.md 的配色方案保留，其旧阶段顺序由本文件替代。

## 一、审查结论与必要修订

旧规划方向可行，但存在五个执行问题：

1. Session 修复被排在 Race/Free Roam 集成之后，而后两者依赖可靠的录制状态；必须提前。
2. 没有覆盖“已解析但尚未显示”的扭矩、Slip、悬挂、姿态和车辆信息，应逐项定义 UI 接入位置。
3. Node 后端与浏览器地图边界混在一起；Leaflet 只能在浏览器消费 SSE，不能由服务端直接更新地图。
4. 真实 fixture 未提供不应阻断开发：先用标注为合成的二进制样本验证偏移，真实驾驶作为独立验收阶段。
5. 不能用未限量的内存数组实现长期记录；记录写盘、导出和地图显示必须分别设计容量策略。

UI 基线调整为宝马 M 风格数字仪表：左右速度/转速大弧形表盘与外框固定，中央为可横向切换的内容视窗，底部以 `DRIVE   MAP   DYN   RPY` 作为小型分页指示。当前工作区 src/index.js 的遥测、Session、地图和回放能力作为功能来源，不再要求沿用原黑底卡片式排布。仪表固定层与分页内容层必须解耦，切页不得使速度、RPM、挡位、油量、水温等基础仪表跳动或重建。

## 二、全部功能与 UI 对接

以下“来源”是当前 parser 或业务计算能力，不代表已经完成 UI 接入。

| 功能 | 来源与转换 | 宝马仪表 UI 接入位置 | 验收 |
|---|---|---|---|
| 速度 / RPM / 挡位 / 红线比例 | speedKmh、currentEngineRpm、engineMaxRpm、gear；`rpmRatio = currentEngineRpm / engineMaxRpm`，engineMaxRpm≤0 时为 null；建议仅对 UI 控制值 clamp 到 0–1.1 | 固定仪表层：左速度弧/数字、右转速弧/挡位；Shift Light 使用 rpmRatio | 0、倒挡、高转速及换车不误显示；换车后 engineMaxRpm 必须同步更新，不得沿用上一辆车；切页时固定层不重建 |
| 油门 / 刹车 / 离合 / 手刹 | 0–255 转百分比 | DYN 页动态输入区 | 0/半程/满程准确 |
| 转向 | steer 有符号值 | DYN 页动态输入区 | 左右极值与回中 |
| 功率 / 扭矩 / Boost | 功率 W→kW，扭矩 Nm；Boost 单位按协议和真实包核实 | DYN 页完整动力区；Free Roam 的 DRIVE 页可显示 Power + 条件浮现 Boost | 保留负功率含义，不用 abs 冒充输出；Boost 单位未验证前不得标 psi/bar；无明显正 Boost 时 DRIVE 页 Boost 模块弱化或隐藏 |
| G-force | accelX/Y/Z ÷ 9.80665；轴标签真机验证 | DYN 页 | 正负方向、静止值、无效值 |
| 胎温 | 保留 parser 华氏→摄氏处理 | DYN 页四轮区 | 不重复换算 |
| Slip | 每轮 ratio、angle、combined | DYN 页四轮区，沿用 FL/FR/RL/RR | 分别命名，不混成胎耗 |
| 轮胎磨损 | 当前324-byte布局无此字段 | DYN 页不展示或明确“不提供” | 不估造磨损百分比 |
| 四轮悬挂 | normalized travel 与 meters | DYN 页四轮区 | 两种单位分别标注 |
| XYZ 位置 | positionX/Y/Z | MAP 页定位；必要时在调试详情显示 XYZ | 坐标有限值；无数据不跳零点 |
| Yaw / Pitch / Roll | 弧度，显示可转换为角度 | MAP 页 yaw 控制车标；DYN 页姿态区 | 跨 ±π 最短角平滑 |
| 圈速 / 排名 / 圈数 | current/last/best lap、race time、lapNumber、racePosition | 固定信息带仅显示当前圈速 / 最快圈 / 排名；其余圈数细节放 RPY | 时间单位不重复 /1000，非比赛显示 — |
| 车辆 ID / PI / 等级 / 驱动形式 | carOrdinal、carPi、carClass、drivetrainType | 固定信息带仅显示 PI / 车型 / 4WD（或实际驱动形式）；车型名称由 carOrdinal 映射，未知时显示 ID | 未知枚举保留原始值；不伪造车型名称 |
| Fuel | fuel 原始值；单位先验证 | 固定仪表层左下燃油小表 | 0 是合法值，不以真值判断隐藏；禁止未经验证标 L |
| Session 自动识别 | Race 模式 + 有效比赛/计时状态 | RPY 页；固定层只保留极简录制/连接状态，不占用固定信息带 | 进出比赛、换车、暂停、回溯、断流 |
| JSON / Compact / 回放 | 保留接口及现有存档兼容 | RPY 页 | 旧档可读、导出可重新加载 |

所有信息按“固定仪表层 + 中央分页层”组织，不再把所有功能堆在同一画面。固定信息带只保留两组内容：① 当前圈速 / 最快圈 / 排名；② PI / 车型 / 驱动形式（如 4WD）。其余遥测信息进入 MAP、DYN、RPY 分页，DRIVE 页保持最克制的原厂仪表观感。缺失值显示 —，过期值标记 stale，不能默认为有效零。

### 二-A、宝马仪表壳与横向分页

固定层始终可见：左侧速度弧与数字速度、右侧转速弧与挡位、左右小表（燃油/水温或当前已有等价状态）、仪表外框、顶部灯效区域以及底部固定信息带。任何分页切换都不能重建这些节点。

中央内容视窗采用横向分页，顺序固定为：

`DRIVE  →  MAP  →  DYN  →  RPY`

底部以小型文字页码 `DRIVE   MAP   DYN   RPY` 常驻显示；当前页提高亮度并允许使用极短下划线/光点强调，非当前页降为低亮度。分页指示不得做成网页式大 Tab 或侧栏。

- **DRIVE**：默认驾驶页，目标是“驾驶时一眼扫完”，保持宝马原厂感，不复制 DYN 的全部数据。Race 与 Free Roam 使用不同的中央摘要内容：
  - **Race**：中央主信息优先显示“当前圈相对最佳圈的实时 Delta”。在空间匹配 Delta 尚未完成前，可临时显示 CURRENT 当前圈时间，但最终目标仍为 Delta。中央下方保留极细的 Throttle / Brake 双条。Wheelspin、Lockup、Peak G、Rewind 等仅作为 1–2 秒的瞬时提示浮现，不常驻。
  - **Free Roam**：中央显示实时 Power，Boost 仅在单位已验证且出现明显正压/有效增压时浮现，可同时显示本次 Top Speed。Boost 无意义、接近零或为负压时不强行显示“BOOST 数字墙”。
  - DRIVE 页不放完整胎温、Slip、悬挂、姿态或 Session 列表，避免和 DYN / RPY 重复。
- **MAP**：Leaflet 地图占中央主要面积，显示实时位置、yaw 车辆朝向和轨迹。
  - **Race**：显示当前圈轨迹、Session 已知范围和自动录制状态；换圈只重置“当前圈显示轨迹”，不得清空累计赛道视野或原始 Session。
  - **Free Roam**：默认 Follow Car；用户拖图后暂停 follow，提供恢复按钮；显示轨迹开关与 Rec/Stop 完全独立；快速旅行/瞬移必须断段，不能跨地图画直线。
  - 后续增强允许增加轨迹按 Speed / Brake / Throttle 染色，但属于增强项，不阻塞基础地图交付。
- **DYN**：车辆动态页，信息量最大，优先图形化而不是把所有原始值堆成表格。
  - 中央核心：二维 G-Ball（横向/纵向 G）+ 当前/峰值 G。
  - 四轮区：FL/FR/RL/RR 显示胎温 + 抓地状态摘要；Slip Ratio / Slip Angle / Combined Slip 与悬挂行程作为小字号详情或可展开信息。
  - 驾驶输入：Throttle / Brake / Clutch / Handbrake 进度、Steer 左右条。
  - 动力区：Power / Torque / Boost。
  - 姿态区：Pitch / Roll；Yaw 主要供 MAP 车辆朝向使用，仅在 DYN 作为小字号辅助值。
  - 可基于 Slip 推断 GRIP / WHEELSPIN / LOCKUP 等状态，但必须标记为派生判断，不冒充游戏直接字段。
- **RPY**：Session / Replay / 历史分析页。
  - Session 列表、当前 Session、圈数、Last Lap、Best Lap、Session 时长。
  - Replay 地图、播放/暂停、回放时间轴、拖动定位与回放倍率。
  - JSON / Compact / Export 与历史记录。
  - 后续高级分析可扩展：Current vs Best、Ghost 轨迹、Brake Point / Apex / Throttle Point、Session Summary；这些属于派生分析，不阻塞第一版 RPY。

固定信息带只显示：
- 当前圈速 / 最快圈 / 排名；
- PI / 车型 / 实际驱动形式（RWD/FWD/AWD/4WD 等）。
不在固定信息带追加 Power、Boost、胎温、G、Session 详情，避免固定层膨胀。

页面信息层级固定为：DRIVE 最克制，MAP 次之，DYN 信息最密集，RPY 功能最深。四页职责分别回答：
- DRIVE：我现在开得怎么样？
- MAP：我现在在哪？
- DYN：车现在怎么样？
- RPY：我刚才开得怎么样？

横向切页只移动中央内容层与其对应的次级内容，左右仪表弧、速度、RPM、挡位、燃油、水温、顶部灯效和固定信息带保持原位。动画使用约 220–300 ms 的 `transform` 横移配合轻微 opacity 过渡；禁止整页重新布局或 `transition: all`。快速连续切页时以最后一次目标页为准，不累计长动画队列。键盘左右键、点击底部分页文字均可切换；后续可再映射手柄按键。

MAP 页切入或容器尺寸变化后调用 `invalidateSize()`，但 Leaflet 实例只初始化一次。分页隐藏不等于停止地图数据更新；地图 marker、Session 和 telemetry store 始终继续工作。

## 三、模块与数据流

```text
Node 服务端
UDP → 原 parser → 原始字段(currentEngineRpm/engineMaxRpm等) → 派生字段(rpmRatio等) → 接收序号/时间/有效性 → Session 状态机 → 记录队列
                          └→ 最新遥测与模式状态 → SSE / 状态 API

浏览器
单个 SSE 连接 → telemetry store
                  ├→ UI bindings → 固定宝马仪表层 + 当前分页内容
                  ├→ page controller → DRIVE / MAP / DYN / RPY 横向分页
                  ├→ shift-light controller → Race 灯条 / Free Roam 顶框漫反射
                  └→ map scheduler → Leaflet marker / trace / camera
模式 API 成功响应 → mode store → 主题、Shift Light 形态、录制控件与 camera 策略
Session API → replay store → RPY 回放地图与滑条（不覆盖实时 store）
```

建议文件归属：src/parser.js 保留，src/session.js 保留核心圈逻辑；新增 src/server/{receiver,state,sse,routes}.js、src/session/{service,repository,export}.js；浏览器代码放 public/js/{telemetry-store,ui-bindings,mode-controller,page-controller,shift-light-controller,drive-page-controller,dyn-page-controller,replay-controller}.js 和 public/js/map/{calibration,track-buffer,camera,leaflet-adapter}.js；样式放 public/css/，Leaflet 固定版本本地资源放 public/vendor/。宝马固定仪表壳与四个分页内容应拆成稳定 DOM 区域，避免切页重建整套 UI。

一个 UDP 监听器、一个页面 SSE 连接；地图无单独 UDP parser。扩展 API 时旧字段兼容，模式状态附加版本号。多个页面通过状态通知或低频 /mode 同步，以服务端为权威。

## 四、模式与记录状态

| 场景 | 地图 | 记录 | 主题 | 顶部 Shift Light / 灯效 |
|---|---|---|---|---|
| Race 等待比赛 | 显示底图及最后有效位置 | idle | 红 | Race 灯条结构进入就绪；低转保持不可见 |
| Race 计时中 | 当前圈线 + 累计已知范围 | 自动 recording | 红 | 顶部中央实体 Shift Light，按转速比例分级点亮 |
| Race 暂停/疑似回溯 | 保留位置，停止追加无效点 | pendingClose，按墙钟超时判定 | 红 | 保持当前转速响应，不因 Session 状态闪断 |
| Free Roam 未录制 | 默认跟车，可选漫游线 | idle | 蓝 | 不显示实体灯条，改为仪表顶部边框漫反射溢出光 |
| Free Roam 手动 Rec | 记录范围全览，车标继续更新 | manual recording | 蓝，录制红点 | 同 Free Roam 漫反射灯效，录制状态独立显示 |
| 手动 Stop | 保留地图及最后轨迹，可恢复跟车 | 明确关闭，不等待下一个包 | 蓝 | 漫反射灯效继续按转速响应 |
| Replay | 完整记录范围，滑条定位 | 不启动记录、不改实时 Session | 保持当前主题 | 默认使用回放帧转速驱动，但不得修改实时 Session |

显示轨迹开关与记录开关独立。地图始终可见；录制时采用全轨迹 camera 策略，即使关闭漫游线也能计算范围。Race 模式不等于 isRaceOn；结合计时/排名识别比赛，Rivals/计时赛需覆盖。

Session：idle → recording → pendingClose → recording（确认回溯）或 saving → idle。手动 Stop、切模式、换车走显式关闭路径。保存失败保留可恢复数据并显示错误。回溯保留原始到达顺序，使用分段元数据或派生有效时间线处理重走区间；回放和圈统计采用同一规则，禁止跨回溯连直线。短手动记录也应保存，不因400包阈值静默丢弃。

## 五、地图规则

使用 fh6-tel 的两点逐轴标定和 CRS.Simple 变体、z/y/x 瓦片路径。校准保存版本、两组world/pixel、native zoom；任何轴差值接近0则拒绝保存。提供恢复默认标定。yaw与标定的轴方向一并验证。

当前圈轨迹、Session完整轨迹、相机累计bounds分别保存。换圈只切当前圈线，不清除赛道视野。新赛道没有完整路线元数据，首圈仅展示已驶范围；历史Session不能凭车型ID匹配赛道，应由用户明确选择参考记录或未来可靠赛道标识。

跟车采用有限频率无动画定位或短时panTo，避免每50ms叠加250ms动画。手动拖图暂停跟随，恢复按钮重新居中。瞬移、无效包、断流恢复、回溯均断段。距离阈值结合时间间隔与速度，200m只作初值。

Leaflet初始化一次，尺寸变化invalidateSize；更新marker而不重建icon；轨迹增量追加。地图显示缓冲有限，原始记录独立写盘。瓦片缺失时保留位置/轨迹并给地图局部错误。离线需同时本地化JS、CSS、图片和瓦片，不能只复制瓦片。

## 六、统一执行顺序与阶段门槛

| 阶段 | 工作 | 必须通过后才进入下一阶段 |
|---|---|---|
| P0 基线 | 核对现有源码/截图，建立字段及DOM清单，合成324B样本与历史JSON样本 | parser正常/截断/异常值；旧UI可启动，真实fixture标为待采集 |
| P1 无视觉拆层 | 提取服务端编排、浏览器store和原UI模板，保持接口 | SSE字段、所有原控件和存档读取无回归 |
| P2 Session可靠性 | 修复Rewind、无后续包Stop、ID防覆盖、短手动记录；异步增量写盘及元数据索引 | 模式切换/暂停/回溯/断流/重启/保存失败可重复验证 |
| P3 全数据UI接入 | 按功能表接入宝马固定仪表层与 DRIVE/MAP/DYN/RPY 分页，补 currentEngineRpm / engineMaxRpm / rpmRatio、单位、枚举、stale及缺失状态 | 十三类功能有数据或明确不支持；换车时 engineMaxRpm 正确刷新；固定信息带只保留圈速/最快圈/排名与 PI/车型/驱动形式；切页不影响固定仪表 |
| P3-V 参考图仪表重构 | 图1蓝色漫游、图2–6红色Race；银白双层框、折面底、点阵纹理、累计带、细化指示前沿 | DRIVE两种形态对照参考验收后再推进地图；不重写P1/P2 |
| P4 地图基础 | 固定Leaflet版本、本地路由、CRS、两点校准、position/yaw | 校准点落位，地图报错时仪表和记录继续 |
| P5 Race集成 | 自动Session事件联动、当前圈线、独立累计bounds、回放全览 | 换圈不缩丢视野，回溯不错误连线，原记录完整 |
| P6 Free Roam集成 | 常驻地图、follow、手动拖图/恢复、可选轨迹、Rec/Stop | 未录制仍跟车；录制和轨迹独立；瞬移不跨图连线 |
| P7 主题、分页与 Shift Light 动画 | Race红/FreeRoam蓝、横向分页、底部 `DRIVE MAP DYN RPY`、Race 灯条、Free Roam 顶框漫反射、DRIVE 条件浮现摘要、模式切换平滑 | rpmRatio 阈值/hysteresis 正确；快速切页/切模式不重建固定仪表；失败/超时/多页面同步/reduced-motion正确 |
| P8 联调与长测 | 合成UDP端到端、旧JSON回放、真实驾驶≥30分钟、多客户端与慢客户端 | 遥测持续刷新，点数有界，内存趋稳，文件可恢复 |
| P9 视觉与交付 | 精修宝马仪表外框、分页层级、Shift Light 漫反射/灯条质感；启动说明、端口说明、离线包和构建资源核对 | 1920×1080 等目标尺寸下固定壳不位移，分页无网页后台感；不依赖CDN，SEA/普通Node启动一致 |

主题变量可在P1后独立准备，但主题动画验收放到模式和地图稳定后。不把已知Session错误推迟到Race功能完成之后。

## 七、宝马主题、横向分页与 Shift Light 动画规范

Race 主色 `#C0392B`、高亮 `#E74C3C`；Free Roam 主色 `#2563EB`、高亮 `#3B82F6`。`body[data-drive-mode]` 驱动模式变量。刹车红、胎温等级、油门绿、错误和录制红点保持语义色，不随模式主题替换。

### 7.1 横向分页动画

固定仪表壳不参与切页动画。切页只作用于中央分页视窗及对应次级内容：

1. 当前页沿切换方向横移并轻微淡出。
2. 目标页从另一侧以较小位移进入并淡入。
3. 总时长约 220–300 ms，优先使用 `transform` 与 `opacity`，不触发布局重排。
4. 底部 `DRIVE   MAP   DYN   RPY` 同步更新高亮；分页文字本身不整体移动。
5. 遥测绑定不断开，速度/RPM/挡位继续以 rAF 更新；隐藏页可降低 DOM 绘制频率，但不能停止 telemetry store、Session 或地图状态。
6. 快速连续切页时取消/接管前一次视觉动画并落到最新目标页，不能排队播放多次长动画。
7. `prefers-reduced-motion` 下取消横向位移，只做即时切换或极短淡入淡出。

### 7.2 Race 模式 Shift Light

Race 使用顶部正中间的实体 Shift Light。切入 Race 时，在服务端确认模式成功之后，以中央为原点使用 mask/clip/scaleX 类方式向左右展开，形成“从中间拉开卷轴”的显现效果，建议 280–360 ms。该动画只负责灯条结构进入 Race 形态，不暂停遥测；若当前处于低转区，展开后的发光单元仍保持不可见，顶部继续呈纯黑。

Shift Light 使用归一化转速 `rpmRatio`，但必须同时保留原始 `engineMaxRpm`。两者不是二选一：
- `currentEngineRpm`：当前发动机转速，供右侧 RPM 仪表直接显示。
- `engineMaxRpm`：游戏 UDP 包中的发动机最大转速/红线参考，属于原始遥测字段。
- `rpmRatio`：派生控制值，`rpmRatio = currentEngineRpm / engineMaxRpm`，专门供 Shift Light、Free Roam 顶框高转灯效等 UI 逻辑使用。
- 当 `engineMaxRpm <= 0`、非有限值或 stale 时，`rpmRatio = null`，灯效进入安全熄灭/弱化状态，绝不能除零或沿用上一辆车的值。
- UI 控制层可将 ratio 限制在 `0–1.1` 以保留短暂超红线观测；原始 currentEngineRpm / engineMaxRpm 不应被改写。
- 换车后必须立即刷新 engineMaxRpm；禁止使用历史最高 RPM 猜红线作为正常路径。只有真实字段缺失时，才允许明确标注的 fallback 车型配置。

Race 分级：

1. **低转速 `< 75%`**：灯光不显示，顶部区域保持纯黑。
2. **高转区 `75%–90%`**：灯块从中间向两侧逐级点亮，主色为黄。
3. **接近红线 `90%–97%`**：颜色由黄/橙向红过渡，亮度和局部 bloom 增强。
4. **换挡提示 `>= 97%`**：整条灯带进入快速红色闪光，明确提示换挡；闪烁频率需独立于 UDP 包率，避免数据抖动改变节奏。

灯块点亮数量根据 `rpmRatio` 连续映射，不要求每个 UDP 包都触发 DOM 重建；使用 CSS class/变量或 Canvas/SVG 状态更新。转速在 0.75 / 0.90 / 0.97 阈值附近必须加入少量 hysteresis（例如 1–2% 回差，具体值真机调校），避免黄/红/闪烁状态来回抽搐。

### 7.3 DRIVE 页动态摘要与瞬时提示

DRIVE 页不应持续塞满遥测卡片，而采用“轻量常驻 + 条件浮现”的策略。

**Race DRIVE**
- 实时 Delta 为主视觉；尚未实现可靠空间匹配 Delta 时，临时退化为 CURRENT 当前圈时间，不能伪造 Delta。
- Throttle / Brake 使用极细双条，位于中央偏下，不和左右大表争夺视觉。
- Wheelspin / Lockup / Peak G / Rewind 等提示采用短时 overlay，建议 1–2 秒淡入淡出；同类高频事件需去抖，避免持续闪屏。
- Delta、圈速、排名的颜色只表达性能状态，不覆盖刹车红、警告红等语义色。

**Free Roam DRIVE**
- Power 为轻量常驻动力摘要。
- Boost 只有在单位已验证且值满足“有效正压/明显增压”条件时出现；低负荷、接近零或负压时淡出/隐藏。
- 可显示当前 Session/本次驾驶 Top Speed，但不把 0–100/100–200 等完整测试面板常驻；这些后续可作为瞬时结果提示。
- MAP 已承担导航与位置，不在 DRIVE 重复放大地图。

### 7.4 Free Roam 顶框漫反射溢出光

Free Roam 不显示 Race 的实体 Shift Light 灯块。顶部正中灯条收起后，转而使用“仪表盘顶部边框漫反射溢出光”表达高转状态，保持更克制的漫游视觉。

同样按归一化转速分级：

1. **低转 `< 75%`**：无可见溢出光，顶部边框保持原始暗色。
2. **`75%–90%`**：从顶部中央出现柔和黄色漫反射，向左右边框自然衰减。
3. **`90%–97%`**：漫反射由黄/橙平滑过渡到红色，扩散范围与亮度增加，但不出现实体灯块。
4. **`>= 97%`**：顶部边框出现明显红色脉冲/闪光，仍保持“溢出光”形态，不变成 Race 灯条。

Free Roam 的 glow 应通过伪元素、渐变、filter/blur 或等价低成本方案实现，避免每包创建阴影节点。闪光不得覆盖速度/RPM文字的可读性。`prefers-reduced-motion` 下取消持续闪烁，改为稳定的高亮红色漫反射。

### 7.5 Race / Free Roam 模式切换

切模式顺序保持服务端权威：

提交请求并标记 pending → 服务端完成 Session 状态过渡 → 校验 HTTP 状态与响应版本 → 更新 `data-drive-mode` → 同步主题、Shift Light 形态、录制控件与 camera 策略。

视觉上：

- **Free Roam → Race**：蓝色主题属性平滑过渡到红色；顶部漫反射光淡出；Race 实体灯条从中间向左右“拉卷轴”展开，然后立即按当前 `rpmRatio` 呈现对应亮度。
- **Race → Free Roam**：Race 灯条从两侧向中央平滑收拢/淡出；随后顶部边框漫反射接管，并按当前 `rpmRatio` 直接进入无光/黄/红/红闪状态。
- 页面当前分页保持不变，不因模式切换强制跳回 DRIVE；MAP marker、实时仪表、Session 与 SSE 在动画期间持续更新。
- 主题相关 `color`、`border-color`、`background-color`、`stroke` 等属性使用约 360–420 ms 过渡；模式切换器位移约 280 ms。禁止 `transition: all`。
- 请求失败保持原模式与原灯效；请求超时解除 pending 后读取服务端权威状态，不能擅自假定切换成功或失败。
- 多页面同时打开时，以服务端模式版本为准同步；本地动画只是表现层，不是状态源。

地图 marker 在模式/分页动画中不得中断更新；切到 MAP 页时只恢复可见渲染与 camera 表现，不重新创建地图。控制区预留 Rec 状态位置，避免模式变化导致仪表固定信息带横向挤动。

## 七-A、四页最终显示清单与验收

### DRIVE
- 固定层：速度、RPM、挡位、Fuel、水温、当前圈速、Best、排名、PI、车型、驱动形式、顶部灯效。
- Race 中央：Delta（或临时 CURRENT）、Throttle/Brake 极简双条、瞬时 Wheelspin/Lockup/Peak G/Rewind。
- Free Roam 中央：Power、条件浮现 Boost、Top Speed。
- 验收：正常巡航时视觉必须保持克制；没有有效 Boost 时不留一个突兀的空 Boost 表；瞬时提示不会连续抖动。

### MAP
- Race：当前圈轨迹 + Session 赛道范围 + 车辆 marker/yaw + 自动记录状态。
- Free Roam：follow、手动拖图暂停、恢复 follow、轨迹开关、Rec/Stop、瞬移断段。
- 验收：切页不重建 Leaflet；隐藏 MAP 时仍持续消费位置状态；返回 MAP 后 marker 与轨迹连续。

### DYN
- G-Ball、当前/峰值 G。
- 四轮胎温 + Grip 摘要；Slip/悬挂详情。
- Throttle/Brake/Clutch/Handbrake/Steer。
- Power/Torque/Boost。
- Pitch/Roll + 小字号 Yaw。
- 验收：四轮 FL/FR/RL/RR 不错位；Grip/Wheelspin/Lockup 明确标为派生判断；数值缺失时显示 — 而不是 0。

### RPY
- Session 列表、圈数、Last/Best、时长。
- Replay 地图、播放/暂停、时间轴、拖动定位、倍率。
- JSON/Compact/Export 与历史记录。
- 后续增强：Current vs Best、Ghost、Brake/Apex/Throttle 点、Session Summary。
- 验收：回放 store 不覆盖实时 store；拖时间轴只改变 Replay 视图；退出 Replay 后实时仪表无需重新连接。

## 八、性能与验收记录

服务端完整接收和记录；SSE慢客户端设缓冲上限，关闭慢连接并允许重连，不阻塞UDP。浏览器保留最新值，仪表用rAF刷新；rpmRatio、Grip/Lockup/Wheelspin 等轻量派生值可在 store/selector 层计算并缓存，避免每个 DOM 组件重复计算；地图marker初始20Hz、bounds每250–500ms按需更新。全量回放轨迹只预处理一次，拖滑条只移动车标。

持续记录使用追加日志/分块队列、限量内存和原子完成文件；JSON导出兼容旧结构，避免无限数组与同步大JSON。存档列表读metadata；退出时排空队列，异常退出保留未完成日志供恢复。超过队列容量必须报告，不静默丢包。

实测记录包率、解析错误、接收→UI延迟、事件循环延迟、内存、轨迹点数和保存耗时。至少比较相同输入下地图开关前后：目标仪表延迟p95新增不超过50ms，长测热身后内存无持续线性增长；性能目标待当前机器测量后调整。横向切页与 Shift Light/glow 动画开启后也必须重复同一测试，确认不会使实时速度/RPM明显掉帧。合成通过与真实驾驶通过分别记录，不能互相替代。

## 九、并行实施边界

P0可并行做parser/Session回归审计与UI字段核对；P1接口确定后，地图纯计算模块可与Session可靠性独立开发。共享src/index.js和模式控制器由主执行者集成，避免同时编辑同一区域。每阶段更新CHANGELOG和PROGRESS，记录真实通过、待验证和缺陷，不能把“规划完成”当“功能完成”。
