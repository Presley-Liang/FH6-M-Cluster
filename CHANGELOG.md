# 更新日志

## 2026-09-10 · P11 视觉氛围升级

- 新增暗舱环境光、低强度扫描纹理、局部玻璃和金属层次。
- 精修主表三层色带、银色边框、指针焦点光与燃油/胎温辅助表材质。
- 主表数值跟随由指数插值升级为带阻尼弹簧；页面、拨片和点火阶段增加错峰材质过渡。

## 2026-09-10 · Race 退出状态机

- 自动模式退出新增比赛上下文清空与开放世界运动双重确认，消除暂停、Rewind、冲线瞬间误切主题的问题。

## 2026-09-10 · Windows 打包修复

- 修正 esbuild 打包脚本的 Windows 路径解析，确保 `src/index.js` 和 `dist/index.cjs` 使用项目绝对路径。
- 修复 SEA 流程缺少目标 exe 准备文件的问题。
- 产出可转发的 `FH6-Telemetry-Windows.zip` 资源包及简短中文教程。
- 修复单文件运行时 `import.meta.url` 无效导致的赛道目录加载错误，增加调试启动入口。
- 增加 `启动仪表.bat`，自动处理已有实例和端口冲突。

## 2026-09-10 · 游戏活动驱动自动模式

- 启用 EventDetector 的确认结果驱动有效 Race / Free Roam 模式，进赛与退赛自动发出模式状态，前端继续使用同一动画协调器。
- 增加 `autoDriveMode` 和 `modeSource` 状态，自动切换与手动 API 共用安全 Session 收口和地图清理逻辑。

## 2026-09-10 · DYN页面隔离修复

- 将stale降亮限定为激活的DYN页面，并为非激活DYN显式保持opacity 0，消除车辆模型跨页面残留。

## 2026-09-10 · 模式切换黑场与拨片对齐

- 主题换色延后150ms并关闭切换期环境光，解决旧仪表尚未完全消失就出现目标颜色的问题。
- 顶部双位模式拨片改为画布绝对居中，不再受左右品牌和连接状态宽度影响。

## 2026-09-10 · 最高胎温辅助表

- 右侧无数据水温表替换为四轮最高胎温，新增有效数值、动态弧线、针轴指针及分级热警示。

## 2026-09-10 · 燃油指针刻度校准

- 燃油针由固定零角旋转改为按E/½/F实际几何端点分段映射，确保0%、50%、75%和100%位置与弧表刻度一致。

## 2026-09-10 · 模式身份启动画面

- 新增独立模式身份层，模式切换中央熄灭后显示Race或Free Roam系统名称，表框构建时降亮，扫表回交时收束退出。
- 底部托盘新增模式状态层，切换期间以菱形脉冲和系统状态替代实时行，外壳始终保留。
- 燃油指针改用SVG viewBox内的固定针轴与CSS角度变量，消除跨画布漂移。

## 2026-09-10 · 模式切换红线残留修复

- 将RPM独立高转红线纳入非live阶段隐藏规则，修复模式切换时右侧轮廓单独残留；底部信息托盘继续常亮。

## 2026-09-10 · 仪表视觉整合重构

- 重构主表活动色带为低亮内衬加细亮进度边，并按Race/Free Roam建立独立灯光材质；RPM红线保持固定警示色。
- 重构顶部模式选择器为固定双位拨片，新增滑动背板、赛旗和道路符号。
- 新增燃油弧轨、比例填充和真实指针，0–1有效值显示百分比，异常值闭锁；新增无数据水温暗轨和停驻指针。
- 底部信息区改为低矮切角托盘；模式切换时中央页面熄灭、底部托盘常亮。

## 2026-09-10 · 双表构建动画与主题灯光

- 表盘底材自下而上展开，刻度与数字按轨迹位置延迟点亮，内外灯带与银边一并描绘；扫表等待构建完成。
- 分层主题灯光覆盖表缘、针尖、侧面环境光与底部托盘，保留语义告警色及模式切换中屏常亮。
- UI定向测试6/6通过；新合成预览端口7441，尚未完成动态视觉终验。

## 2026-09-10 · DYN轿跑俯视模型

- 用圆弧车头车尾、独立轮胎、后视镜、引擎盖、双车窗与前后灯组替换尖角几何车壳；保留四轮数据绑定。

## 2026-09-10 · 模式切换中屏常亮

- 区分模式切换和车辆唤醒的中屏显隐行为；双表框增加沿路径的渐进描绘。

## 2026-09-10 · 连续扫表和分层开关机

- 启动按中屏及底部、双表边框、连续扫表顺序显现，撤销阶梯量程目标。
- 关机按指针、边框、中屏及底部反向淡出，无关机扫表；保留真实数字更新。

## 2026-09-10 · 三秒扫表视觉试调

- 将油车式仪表点火从约1.6秒扩展到3秒，延长上扫、顶点停顿和回落阶段，便于对比真实机械惯性感。
- 没有改变器遥测数值、Session、地图或Shift Light门控。

## 2026-09-10 · P10 Race事件反馈HUD

- 点火量程动画从瞬时冲满改为12%→34%→62%→86%→100%的渐进上扫，并在顶点短暂停顿后回落，增强机械油车仪表感。
- 增加纯Race反馈控制器，识别确认开赛、严格完成圈、双字段佐证New Best、名次变化和明确Rewind。
- 中央新增不改变布局的瞬态赛事反馈层，支持强调色、成功绿和警示琥珀，并提供`aria-live`状态播报。
- 模式、stale、Session及timeline break全部作为比较边界，避免恢复或跨上下文误报。
- 动画协调器集中负责反馈显示、替换和自动收起；reduced-motion保留信息但取消位移。
- 新增3组Race反馈边界测试，全量131/131通过。

## 2026-09-09 · P10 Shift Light与车辆动态反馈

- 增加带回差的Shift Light纯状态机和11段顶部灯条；黄、橙、红灯随真实发动机转速比例渐进点亮，Race以外及无效状态安全熄灭。
- 车辆首次锁定或确认换车触发统一仪表wake；BOOST确认状态变化获得一次性横向锁定入场。
- DYN高频图形增加短时线性transform过渡，胎温与危险Slip增加受控局部光效，不引入DOM重建或大面积模糊。
- 新增Shift阈值、回差、失效门控与稳定灯条测试，全量128/128通过。

## 2026-09-09 · P10模式总线与点火动画第一段

- 用工业科幻中央模式总线替换顶部普通Race/Free Roam文字按钮，保留原稳定DOM ID与服务端模式接口。
- 新增`UIAnimationCoordinator`，实现归零、暗场、满扫、回交实时值的可取消视觉序列；reduced-motion下直接切换最终状态。
- `clusterBindings`新增纯显示层量程覆盖接口，原始遥测、地图和记录链路在动画期间持续更新。
- 模式请求改为最终意图泵：快速反向选择不丢失，确认态不做乐观漂移；补充pending、失败与无障碍状态。
- 新增P10模式总线和动画协调器契约测试，全量127/127通过。

## 2026-09-09 · P9-V DYN单屏车辆状态舱

- 用车辆空间布局替换DYN滚动参数墙：四轮数据贴合FL/FR/RL/RR物理位置，中央为代码绘制的车辆俯视模型和G-force光点。
- 新增四轮悬挂行程短条、combined Slip摘要、PWR/TRQ/BST紧凑动力条，以及中心零点双向转向指示。
- 油门、刹车、离合、手刹收敛为2×2单屏输入区；所有高频图形绑定统一更新`transform`，不触发布局重排。
- 增加720p高度压缩规则，保证四轮、四输入和原固定圈速托盘同时可见；Race红/Free Roam蓝主题继续复用现有变量。
- Slip危险阈值改为调用方可配置，默认不臆测协议阈值；新增P9-V DOM与绑定契约测试，全量126/126通过。

## 2026-09-09 · MAP说明行精简

- 按用户反馈移除地图下方`RACE FULL TRACK · FREE ROAM FOLLOW / OPTIONAL TRACE`说明，不改变地图尺寸、路线状态、Delta或底部圈速托盘。

## 2026-09-09 · P9动态车辆/RPM/BOOST第一段

- 新增跨服务端与浏览器复用的车辆身份控制器，以帧数和时间双门槛确认换车，修复单帧`carOrdinal`异常立即断开Session的问题。
- 新增RPM量程控制器：友好上限、动态主刻度、独立表盘比例和真实红线区；换车候选期间清空旧量程，避免高转车数据泄漏到低转车。
- 新增按车辆身份隔离的BOOST状态机，带能力学习、峰值成熟度、比例阈值、回差与防抖；不把未确认的Boost单位标成psi/bar。
- 固定RPM表新增`BOOST + 单状态词`模块和动态红线，所有DRIVE/MAP/DYN/RPY页面常驻；完整状态横向动画仍按计划留P10统一实现。
- 新增9项车辆/RPM/BOOST测试，并更新Session换车集成用例；全量125/125通过。

## 2026-09-09 · P8 实时路线/Ghost/Delta接入

- 新增有界实时路线识别器并接入SessionRuntime；通过SSE发布fail-closed的`activeRoute`状态和稳定SQLite route id。
- Leaflet适配器新增单一Ghost虚线层与独立归一化outline SVG层；Race Session/模式切换自动清理，不重建地图、不伪造世界坐标。
- MAP页新增紧凑路线名与Delta浮层；DRIVE副标题通过绑定层setter显示同一Delta状态，避免与20Hz仪表刷新争抢DOM。
- 新增前端请求竞态隔离、同车Best到路线Best回退、stale/无参考/Free Roam清理；增强请求失败不影响原遥测订阅。
- 新增实时识别、地图叠层、Runtime契约和UI控制器测试；全量由105项增至116项并全部通过。

## 2026-09-09 · P8 Outline / Best / Ghost / Delta

- 新增路线outline生成器，输出可直接用于SVG/Canvas的有界归一化轮廓，并缓存到唯一匹配路线。
- 新增SQLite路线Best/同车Best稳定查询；目录幂等更新改为保留已生成outline。
- 新增Ghost生成器及`/route-best`、`/ghost`接口，从JSON事实源按需读取最佳圈，不复制原始packet进SQLite。
- 新增实时Delta状态机，提供插值计时、关系分类、stale及异常时间线闭锁。
- Session最终归档同步生成routeOutline；ArchiveIndex在Session/圈事务提交后再分别保存匹配和轮廓，避免嵌套事务。
- 新增19项Outline、Best/Ghost、Delta测试；全量由86项增至105项并全部通过。

## 2026-09-09 · DYN单屏车辆状态舱规划

- 将DYN无滚动重构插入为P9-V，位于车辆/RPM/BOOST状态稳定后、动画系统之前。
- 规划上半部车辆俯视模型和四轮邻近温度/Slip/悬挂摘要，下半部四项驾驶输入柱及独立双向转向条。
- 明确只精简主视图，不删除parser、SSE、Session或JSON中的完整工程数据；视觉动画统一留P10协调。

## 2026-09-09 · P8 路线指纹与匹配第一轮

- 新增完成圈路线指纹提取：按距离签名抽样、Rewind裁剪、teleport污染拒绝以及有效圈闭锁。
- 新增基于LapScope实测阈值的77路线匹配器，返回可解释的matched/ambiguous/unknown及四项阈值诊断。
- Session最终归档生成lapFingerprints/routeFingerprint；ArchiveIndexCoordinator随后写入圈几何与route_matches，匹配不进入UDP热路径。
- 修复SQLite Session/圈事务与匹配事务嵌套，改为基础索引提交后独立保存匹配结果。
- 增加11项P8纯函数与端到端测试；总测试数增至86项。

## 2026-09-09 · P7 SQLite与路线目录接入

- 新增严格验证的FH6路线目录加载器，内置77条LapScope路线数据、稳定ID与MIT来源说明。
- 新增SQLite路线索引v1，包含routes、sessions、laps、route_matches及事务migration、WAL、外键和幂等回填控制。
- 新增可降级ArchiveIndexCoordinator：目录一次性入库，完成归档串行索引，历史完成Session启动后reconcile；所有数据库错误与记录致命错误分离。
- SessionStore只在最终JSON和metadata原子成功后通知SQLite；shutdown等待索引队列排空。原始packet热路径和JSONL/JSON事实源保持不变。
- 新增`/routes`、`/route?id=`及`/debug.routeIndex`诊断；数据库驱动不可用时服务仍可启动并正常接收/记录遥测。
- 新增10项catalog/SQLite/协调器测试，全量从65项增至75项并全部通过。

## 2026-09-09 · LapScope参考导入、P5/P6第一轮

- 将`LapScope-main`整理至`references/LapScope/`，排除GitHub配置、Python缓存/虚拟环境等非参考文件，保留MIT许可证、测试与77条路线catalog。
- 新增独立EventDetector影子层，使用排名、圈时推进、圈数变化等组合证据与进出防抖；现阶段不改变手动Race/Free Roam权威状态。
- 新增有界track buffer：按距离采样、断点隔离、当前圈重置、Session累计bounds，以及模式/Session隔离。
- 新增地图camera controller：Free Roam跟车、用户拖动暂停、FOLLOW恢复；Race按累计bounds节流显示完整赛道。
- Leaflet页接入Race红色当前圈轨迹、Free Roam蓝色可选轨迹与地图内Rec/Stop，地图失败仍与实时仪表订阅隔离。
- 按截图复核将MAP最终收敛为中央34%×48%安全区并下移：比初版略大，但避开左右仪表内侧刻度并恢复圈速托盘；移除界面XYZ及HEADING数值，内部positionX/positionZ/yaw保留作绘图计算。
- 自动化回归65/65通过；浏览器以合成324-byte UDP验证瓦片及车辆落点，尚未代替FH6真机验证。

## 2026-09-09 · P4后新增需求排期整合

- 审查Race SQLite路线识别、BOOST状态、AUTO/动态RPM/点火以及全局微动画四份新增设计输入。
- 保留P0–P4历史结论，将后续重新编排为P5 Event/AUTO、P6地图行为、P7路线数据、P8识别增强、P9车辆/RPM/BOOST、P10动画、P11长测、P12交付。
- 明确AUTO不可只用`isRaceOn`，Route数据库不可进入浏览器地图层，动画只能接管display state，Boost单位和各阈值必须经真机确认。
- 补充FH6设置接入说明：同机填写`127.0.0.1`与UDP端口`20440`，HTTP端口3000不属于游戏数据输出。

## 2026-09-09 · P4 Leaflet离线地图基础

- 在现有MAP页内接入本地Leaflet 1.9.4，保留BMW仪表壳和原遥测页面；无CDN运行。
- 新增独立地图标定与Leaflet适配层：CRS.Simple Y向下坐标、fh6-tel两点标定、单例地图、实时positionX/positionZ位置及yaw朝向标记。
- 新增本地vendor和地图瓦片HTTP路由，严格使用项目既有`{z}/{y}/{x}.jpg`目录；瓦片维持单份，未复制约53MB资源。
- 地图更新经独立telemetry subscriber隔离，地图失败不影响原速度、RPM、Session与SSE显示。
- 新增标定、航向、适配器及静态资源回归；总计50/50通过。浏览器确认Leaflet资源、瓦片及MAP切页加载。
- 记录两个交付风险：SEA/EXE静态资源尚未验证；MapGenie/FH6瓦片未发现明确再分发许可，公开发行前必须解决。

## 2026-09-09 · 科技字体与中屏边界修正

- 引入本地Oxanium可变字体，保留SIL OFL许可证；数字使用等宽数码特性，新增TTF正确Content-Type及HTTP验证。
- 中屏统一安全区：左右35%/30%，顶部26%，高度44%；标题避开顶端260/8刻度。
- MAP改为弹性高度布局与等比canvas，无多余纵向滚动条；底部托盘不透明，左右框线提前收口，取消线条穿透/相交。
- 浏览器验证1920×1080与1280×720：字体已加载、MAP无溢出，中屏/托盘间隔约35px/14px。
- 模型分工建议：5.6 Sol作为后续实现与回归主力；GPT-6按需用于视觉审核或复杂疑难，不自动切换当前任务模型。

## 2026-09-09 · P3接入及新增P3-V视觉重构

- 新增纯字段selector、稳定四页控制器与rAF仪表绑定，保留后端parser/Session/SSE；缺失显示—，Fuel/Boost标raw，磨损/水温明确不提供。
- 挡位参考本地实现修正为0=R、11=N；原始字段不改写。换车刷新最大RPM，stale禁用转速比例。
- 用户否决抽象版后，插入P3-V并暂停地图阶段；采用本轮六张图片重新设计，蓝色漫游与红色Race有不同光带厚度/材质。
- 首轮增加银白双层轮廓、折面暗底、点阵纹理、主次刻度与累计亮带，弱化中央M装饰，保留十三类字段的分区落点。
- 普通指针75ms时间常数平滑、详情约20Hz；完整模式点火序列仍在P7，未冒充已完成。
- 原UI模板与CSS仍保留为功能兼容来源，由新壳替换页面主体；不能把历史CSS哈希通过当成新外观通过。
- 本轮44/44自动化通过；浏览器确认红蓝形态及切页固定SVG边界不变。P3-V尚待继续视觉细化与用户验收。
- 按用户要求提供手动验收预览，显著标记合成数据；小表读数与底部托盘再次整理，地图阶段保持暂停。

## 2026-09-09 · v4 P1 / P2 实施

- 拆出原UI模板、浏览器最新快照store、HTTP/SSE服务和Session runtime/store/export，parser及原CSS保持不变。
- 将Session判定移至广播/记录之前，首帧拥有正确ID；Stop和模式切换立即关闭，短手动记录不再被400包阈值丢弃。
- 使用墙钟宽限期处理暂停/断流；回溯保留原始包并标记分段，回放/Compact导出使用派生有效时间线，撤销未来圈速。
- 记录写入受限队列与增量jsonl日志；完成JSON流式生成、metadata索引、重启唯一ID、旧JSON兼容和中断恢复。
- 保存失败保留日志/待重试数据，通过状态API和原UI提示可见；新增POST /recording-retry。
- SSE慢客户端仅保留最新待发状态/遥测；模式命令串行，浏览器同步服务端状态。
- 补充点火式模式切换设计；不提前实施P3宝马UI、P4地图或P7动画。
- 最终自动化34/34通过；含12个并发模式请求与部分写入失败回滚。细节见docs/P1_P2_IMPLEMENTATION.md；真实驾驶/视觉/SEA打包尚未验收。

## 2026-09-09 · v4 P0启动

- 采纳v4宝马固定壳和中央四页；新增科幻红蓝配色、连续动画接管与帧时间验收规范。
- 增加合成parser/Session检查及实际HTTP模式API、UDP→SSE链路测试。
- 增加源码hash、JSON字段、DOM功能hook清单生成器和P0验证报告。
- 水温缺失和回放灯效数据源冲突在补充规范中明确处理。
- 真实包、历史Session及浏览器视觉仍待验证；运行代码未改。

## 2026-09-08 · 规划 v2 审查

- 新增全功能整合总规划，明确全部遥测字段与现有UI卡片的对应位置。
- 前置Session可靠性，区分Node服务端、SSE、浏览器store及Leaflet职责。
- 补充回溯、短手动记录、断流Stop、多页面模式同步、写盘容量和异常恢复条件。
- 明确缺失磨损字段、Fuel/挡位单位验证、未知赛道bounds限制及合成/真实验证区别。
- 旧规划标记为历史参考，统一按INTEGRATION_MASTER_PLAN执行；未修改运行代码。

## 2026-09-08 · 功能与 UI 整合路线

- 增加 Race 红色、Free Roam 蓝色的模式主题设计。
- 规划基于 `data-drive-mode` 和 CSS 变量的平滑切换机制。
- 明确地图淡化、模式滑块、失败回滚和 reduced-motion 行为。
- 将实现拆为基线、主题、分层、地图、Race、Free Roam、Session、稳定性和视觉九个阶段。
- 本次只更新规划，没有修改现有运行代码或 UI。

## 2026-09-08 · 下载包整理与规划

- 以 `viunow/fh6-telemetry` 源码建立工作项目，未导入 `dist` 构建产物。
- 将 `TheBanHammer/fh6-tel` 和 `potchin/fh6-web` 整理到 `references/`。
- 去重两套地图瓦片，仅保留 `reference-assets/maptiles/` 一份。
- 记录上游许可证、下载包无 commit 元数据和地图瓦片授权风险。
- 完成遥测、Session、地图和 UI 分层规划；未修改现有功能与 UI。
## 2026-09-10 · Environment-light transition timing

- Replaced the instantly recolored dashboard ambience with independent Race-red and Free-Roam-blue light layers.
- Synchronized the old-theme fade-out with the mode-change blackout, then introduced the new ambience over 1.8 seconds during gauge construction.
- Preserved the existing gauge-frame, needle-sweep, and center-screen animation timing.
## 2026-09-10 · Directional gear-change motion

- Added a 360ms mechanical gear transition: upshifts rise into place and downshifts settle downward.
- Prevented animation replay on the first telemetry frame, unchanged gears, and unavailable values.
- Added reduced-motion handling and timer cleanup without delaying telemetry updates.
## 2026-09-10 · Local vehicle model lookup

- Added the user-provided FH6 carOrdinal catalog as a local display-only lookup.
- Replaced the bottom-row raw vehicle ID with brand/year/model text and a safe `MODEL UNKNOWN` fallback.
- Applied a restrained script-italic treatment to the model label while keeping PI and drivetrain values intact.
## 2026-09-10 · Fix embedded vehicle lookup

- Injected the vehicle lookup function into the standalone HTML preview so the render loop no longer throws a reference error.
- Restored independent PI, model, and drivetrain updates.
## 2026-09-10 · Preserve vehicle identity across zeroed packets

- Vehicle model, PI class/score, and drivetrain now use the confirmed vehicle snapshot instead of transient zeroed FH6 frames.
- Live dynamic telemetry remains sourced from the current packet.
## 2026-09-10 · Embed vehicle catalog payload

- Embedded the full ordinal-to-model catalog alongside its lookup function in the standalone dashboard HTML.
- Added regression coverage for catalog presence, a known MINI mapping, and generated script syntax.
## 2026-09-10 · Results-settle exit and neutral-gear filtering

- Race mode can now exit after a confirmed finish/results transition without requiring subsequent open-world movement.
- Added a results grace window so the finish presentation completes before switching to Free Roam.
- Added transmission-agnostic 180ms neutral confirmation; sustained neutral remains visible for manual driving.
## 2026-09-10 · Reliable automatic Race exit

- Added a second automatic-exit path for FH6 transitions that jump directly from Race packets to fully cleared context.
- Sustained cleared context now exits Race without requiring movement or an explicit finish frame; returning race context cancels the timer.
## 2026-09-11 · Switch to Free Roam on open-world readiness

- Replaced the fixed post-race timeout with a real telemetry readiness gate.
- Results and leaderboard screens remain in Race while FH6 emits zeroed vehicle packets.
- Free Roam begins only after valid vehicle identity, engine, and world-position telemetry returns.
# Unreleased

- Corrected IsRaceOn semantics using the bundled LapScope documentation: active Free Roam also uses 1. Restored Race exit for these frames and stopped counting the first restored lap value after zero frames as an advancing lap. Added recognition evidence to /status for real-game validation.

- Fixed post-race automatic Free Roam recovery by treating the sequence `confirmed Race -> zeroed results frames -> valid non-race vehicle frames` as an explicit boundary, without relying on FH6 to clear stale lap clocks.
- Fixed the desktop shortcut launch path and added a workspace launcher that starts the current source build, waits for readiness, records startup errors, and then opens the dashboard.
- Fixed automatic Race-to-Free Roam switching getting permanently stuck when the detector had already settled on Free Roam but the applied dashboard mode missed or later diverged from that event.
- Preserved initial Race mode through neutral frames while the first Race-entry debounce is still being confirmed.
