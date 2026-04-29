# BESIII PhoenixCheck — 项目技术说明

## 目录

1. [各子探测器几何组件](#1-各子探测器几何组件)
2. [REC 文件使用了哪些信息](#2-rec-文件使用了哪些信息)
3. [Truth Track 是如何画的](#3-truth-track-是如何画的)
4. [Truth Track 与 Rec Track 的匹配](#4-truth-track-与-rec-track-的匹配)
5. [动画时间轴的时间来源](#5-动画时间轴的时间来源)
6. [Rec Track 是如何画的](#6-rec-track-是如何画的)
7. [坐标约定](#7-坐标约定)
8. [PID 具体做法（补充）](#8-pid-具体做法补充)

---

## 1. 各子探测器几何组件

几何数据来自 BOSS GDML 文件，由 `scripts/bes3_visualize.sh prepare` 处理后转为 Phoenix 可读的 ROOT JSON 格式。

### MDC（主漂移室）

- **来源 GDML**：`Mdc.gdml` → `Mdc_approx.gdml`（近似处理后）
- **近似内容**：原始 MDC 中含有 `twistedtubs`（扭曲管）实体，这是 GDML 标准中存在但 ROOT TGeoManager 不支持的形状。`approximate_emc_gdml.py`（实际上同一脚本）将其替换为普通圆管（`tube`），忽略了导线的实际螺旋扭角，因此**立体导线层的几何是近似的**。

- **几何组件**（来自 `Mdc_approx.gdml` 的逻辑体结构）：
  - `LogicalMdcInnerFilm0/1`：内壁薄膜（内室壁）
  - `LogicalMdcOutFilm0/1/2`：外壁薄膜（外室壁）
  - `logicalvirtualBoxEndcape / logicalboxEndcape / logicalboxCuEnd`：端盖结构（铜端板）
  - `logicalFixTub`：固定管（内外室之间的支撑结构）
  - `MdcCableLogWest0~10 / MdcCableLogEast0~10`：东西两端馈出电缆
  - `logicalMdcSegment1~N`：导线单元段（N 约 ≥ 100 个，每段代表一组导线cell）
  - `logicalMdcStereoLayer0~7`：**内室立体导线层**（层 0–7，共 8 层，交替正负扭角）
  - `logicalMdcAxialLayer8~19`：**外室内侧轴向导线层**（层 8–19，共 12 层）
  - `logicalMdcStereoLayer20~35`：**外室立体导线层**（层 20–35，共 16 层）
  - `logicalMdcAxialLayer36~42`：**外室外侧轴向导线层**（层 36–42，共 7 层）

- **分割视图**（由 `split_mdc_gdml_views.py` 生成）：
  - `mdc_inner.gdml`：仅含内室立体层（层 0–7）
  - `mdc_outer.gdml`：含全部外室层
  - `mdc_outer_axial.gdml`：仅外室轴向层
  - `mdc_outer_stereo.gdml`：仅外室立体层

- **总计**：43 层导线，MDC 内径约 59 mm，外径约 810 mm。

### TOF（飞行时间探测器）

- **来源 GDML**：`Tof.gdml`（直接导出，**无近似**）
- **几何组件**：
  - 桶部（Barrel）：88 根闪烁体条，分内外两层（layer 0/1），内层 R ≈ 810 mm，外层 R ≈ 860 mm，轴向长度约 ±1200 mm
  - 端盖（Endcap，±z）：各 48 块扇形闪烁体，R ≈ 760 mm，|z| ≈ 1280 mm

### EMC（电磁量能器）

- **来源 GDML**：`Emc.gdml` → `Emc_approx.gdml`
- **近似内容**：EMC 晶体为 CsI(Tl) 楔形体（`irregBox` — 不规则八顶点盒），ROOT 不支持此形状。`approximate_emc_gdml.py` 将每个 `irregBox` 替换为**等效外包围盒**（`box`），因此**每块晶体的实际楔形截面被替换为长方体**，整体外形仍然正确但晶体形状是近似的。
- **几何组件**：
  - **桶部**（Barrel，part=1）：120 × 44 = 5280 块 CsI 晶体，围绕束轴排列，θ 从约 33° 到 147°
  - **端盖**（Endcap，part=0 和 part=2，−z 和 +z 端）：每端各约 480 + 480 + 576 = 1536 块晶体（分 0–5 theta ring，每环 64/80/96 个晶体）
  - 支撑结构、后端读出盒（RearBox）、光二极管（PD）、前放盒（PreAmpBox）等机械结构均包含在 GDML 中

> **注意**：旧版显示中 EMC 端盖未被渲染，是因为旧版 `geometries.js` 中 EMC 路径指向的 GDML 文件里端盖的近似处理导致 Phoenix 渲染失败。当前版本已统一使用 `emc_approx.root.json`，端盖晶体应随桶部一同显示。

### MUC（μ 子探测器）

- **来源 GDML**：`Muc.gdml`（直接导出，**无近似**）
- **几何组件**：
  - **桶部**（part=1）：8 个方位扇区（seg 0–7），每个扇区 9 个 gap（RPC 气隙层），每 gap 含多条 RPC 条（strip），总计约 9952 条 strip
  - **端盖**（part=0/2，±z）：每端 4 个象限（seg 0–3），各 8 个 gap，每 gap 含扇形 strip 阵列
  - 铁磁轭（ iron yoke），作为 MUC 的磁铁兼吸收体，在 GDML 中是主要体积

- **击中位置**：MUC 击中位置由专门的 `muc_strip_map.json`（通过 `export_muc_strip_map.C` 从 GDML 提取）提供精确的条带中心坐标和朝向，而非近似几何计算。

### CGEM（柱形宝石探测器，替代内室 MDC 的实验组件）

- **来源 GDML**：`Cgem_noHole_noStrip_effDen.gdml`（无孔、无条带版本，仅有效敏感层）
- **几何组件**：3 层同心圆柱形 GEM 探测器，每层有内外铜膜、GEM 箔等薄层，整体在内室 MDC 半径范围内

---

## 2. REC 文件使用了哪些信息

由 `scripts/rec_to_phoenix_event.py` 从 BESIII REC ROOT 文件读取。

### 主树结构

| 分支路径 | 用途 |
|----------|------|
| `TEvtHeader/m_runId` | 事例 run 号 |
| `TEvtHeader/m_eventId` | 事例 event 号 |
| `TRecEvent/m_recMdcTrackCol` | MDC 重建径迹（原始 MDC helix 参数） |
| `TRecEvent/m_recMdcKalTrackCol` | Kalman 滤波径迹（5参数 helix，POCA/lpoint） |
| `TRecEvent/m_recEmcShowerCol` | EMC shower（位置、能量、theta/phi） |
| `TRecEvent/m_recMdcHitCol` | MDC 触发导线列表（layer/wire/adc/tdc/zhit） |
| `TRecEvent/m_recEmcHitCol` | EMC 触发晶体（cellId/energy/time） |
| `TRecEvent/m_recTofTrackCol` | TOF 测量（tofID/status/zrhit/tof/beta） |
| `TRecEvent/m_recMucTrackCol` | MUC 径迹（depth/vecHits） |
| `TDigiEvent/m_mucDigiCol` | MUC 数字化击中（intId/timeChannel，用于时间） |
| `TRecEvent/m_recMdcDedxCol` | dE/dx 测量（m_pid_prob、chi 值，用于 PID） |
| `TEvtRecObject/m_evtRecTrackCol` | 全局 EvtRec 关联（mdcTrackId ↔ kalTrackId 等） |
| `TMcEvent/m_mcParticleCol` | MC 真实粒子（仅 MC 文件中存在） |

### 各子探测器具体字段

**MDC Kal 径迹**：`m_zhelix[5]` 或 `m_lhelix[5]`（5参数 helix）、`m_poca`（最近点）、`m_lpoint`（最远拟合点）、`m_trackId`、`m_chisq/m_ndf/m_nhits`

**EMC shower**：`m_x/y/z`（坐标，cm）、`m_energy`（GeV）、`m_theta/m_phi`、`m_trackId`

**MDC 击中**：`m_mdcid`（编码 layer/wire）、`m_zhit`（cm）、`m_adc`、`m_tdc`（ns）、`m_trkid`

**EMC 击中**：`m_cellId`（编码 part/theta/phi）、`m_energy`、`m_time`

**TOF**：`m_tofID`、`m_status`（判断桶/端盖和是否计数）、`m_zrhit`（cm）、`m_tof`（ns）、`m_beta`

**MUC**：`m_vecHits`（strip intId 列表）、`m_depth`（穿透深度 cm）、`m_trackId`

**dE/dx**：`m_pid_prob[5]`（e/μ/π/K/p 先验概率）、`m_chiE/chiMu/chiPi/chiK/chiP`

---

## 3. Truth Track 是如何画的

Truth track 来自 MC 模拟真实粒子信息（`TMcEvent/m_mcParticleCol`），仅在 MC 文件中存在。

### 筛选条件

- 只绘制**带电粒子**：PDG 码在 `{11, 13, 211, 321, 2212}`（e/μ/π/K/p）及其反粒子
- 跳过初始束流电子（`|pdg| == 11` 且 `mother < 0`）

### 轨迹推导

从 MC 粒子的**初始动量**（`m_xInitialMomentum, m_yInitialMomentum, m_zInitialMomentum`，GeV/c 单位）和**初始位置**（`m_xInitialPosition, m_yInitialPosition, m_zInitialPosition`，cm）以及**最终位置**出发，在 **B = 1 T 均匀磁场**（沿 −z 方向）中做**精确螺旋线传播**：

1. 计算螺旋半径：`r = pt (GeV/c) × 1000 / (0.3 × B[T])`（单位 mm）
2. 计算螺旋圆心：`(xc, yc) = 初始位置 ± 半径 × 方向垂直分量`，符号由电荷决定
3. 逐步积分（步长 10 mm），生成最多 3000 个点的折线
4. 当点超出 MDC 外径（约 810 mm）或轴向范围（±1450 mm）时停止

生成的折线以**浅蓝色**（`0x90caf9`）显示，与红色 REC track 区分。

---

## 4. Truth Track 与 Rec Track 的匹配

匹配在前端 `truth.js` 中完成，**不依赖 REC 文件中的 MC-track-id 关联**，而是纯几何匹配：

### 评分函数

对每条 MC truth track，计算如下综合分数（越小越好）：

```
score = meanDist + 0.2 × dStart + 1.5 × angleDeg
```

- **meanDist**：以固定步长从 reco 折线采样约 24 个点，找到每个点到 MC 折线的最近点距离，取均值（mm）
- **dStart**：两条径迹起点（折线第 0 个点）之间的距离（mm）
- **angleDeg**：两条径迹初始方向（前 5 个点的向量）夹角（度）

取分数最小的 MC truth track 作为匹配结果，在 PID 信息面板中显示 `pdg` 和估算动量。

---

## 5. 动画时间轴的时间来源

时间轴范围 `[minNs, maxNs]` 由 `timeline.js` 中的 `estimateEventTimeRange()` 确定，优先级如下：

### 优先：来自击中的真实时间（ns）

- **MDC 击中**：使用 `tdc`（漂移时间，ns 单位）
- **EMC 击中**：使用 `time`（ns 单位）
- **TOF 击中**：使用 `tof`（飞行时间，ns 单位）
- **MUC 击中**：使用 `timeChannel`（数字化时间道，ns 单位）；若无则用 `depth × 5.0` 作为伪时间

取所有时间值的 `[min, max]` 作为时间轴范围。

### 备用：从径迹长度估算

若击中时间不足（< 2 个有效值），改为从径迹几何估算：

```
dtNs = 折线总弧长(mm) / (β × c_mm_per_ns)
```

其中 `β = p / sqrt(p² + m_π²)`，使用 π 介子质量作为默认假设（`m_π = 0.13957 GeV/c²`），`c = 299.792458 mm/ns`。

每个可绘对象（track/hit/shower）的 `timeStartNs` 字段决定它在时间轴上何时出现：
- **Track**：从事件时间最小值开始，按上述公式线性延伸到 `timeEndNs`（径迹渐渐延伸）
- **MDC 击中**：`timeStartNs = tdc`（精确）
- **EMC 击中**：`timeStartNs = time`（精确）；shower 使用 EMC 击中时间的中间值或事件时间中段估算
- **TOF 击中**：`timeStartNs = tof`
- **MUC 击中**：`timeStartNs = timeChannel`（来自 digi 数据，若缺失则 `depth × 5.0`）

动画速度：`40 ns/s`（实时加速约 `1/40ns × c = ~1e7` 倍）。

---

## 6. Rec Track 是如何画的

### 主路径：Kalman 滤波径迹（stable 模式）

来自 `TRecEvent/m_recMdcKalTrackCol`，选取通过 `TEvtRecObject` 关联的径迹。

使用 **BESIII 5 参数 helix**（`m_zhelix` 或 `m_lhelix`）：

```
helix = [dr, φ₀, κ, dz, tanλ]
```

- `dr`：到 pivot 的横向偏离（cm）
- `φ₀`：pivot 处的方位角（rad）
- `κ = q/pT`：带符号曲率（GeV/c）⁻¹
- `dz`：到 pivot 的纵向偏离（cm）
- `tanλ`：倾斜角（dz/drT = pz/pT）

传播步骤（`build_track_points_from_kal`）：

1. 用 `m_poca`（最近点）和 `m_lpoint`（Kal 最远拟合点）作为起止约束
2. 在候选空间中搜索 φ 端点（±2π 分支、正反向）
3. 按"到 lpoint 的距离 + 反向惩罚 + 分支惩罚"打分，选最优分支
4. 在 `[0, φ_draw]` 范围内等分 90 个点，生成折线

若 Kalman 解析失败，降级到 MDC 原始 helix（`build_track_points_from_mdc_helix`），使用 Runge-Kutta 步进积分（步长 10 mm，均匀 Bz 场）。

最后再降级到基本螺旋参数化（`build_track_points`），不依赖任何 Kal 信息。

### 调试路径：helix5 模式

用 MDC 原始 helix + BesVis 风格的磁场步进积分，显示为**蓝色**，仅在 `--helix-debug` 模式下启用。

### 渲染

- 折线（Three.js `Line`）+ 密集点云（Three.js `Points`）
- 颜色：red `0xff4d4d`（stable），blue `0x42a5f5`（helix5），light-blue `0x90caf9`（MC truth）
- `depthTest: false`，`renderOrder: 999/998`，确保显示在探测器几何之上

---

## 7. 坐标轴约定

### 几何坐标（探测器）

- 由 GDML 文件定义，直接来自 BOSS 几何数据库
- 单位：**mm**
- 坐标系：右手系，**z 轴沿束流方向**（指向北），x 轴水平，y 轴竖直向上
- 中心：对撞点（IP）

### 事件数据坐标（REC 文件）

- BESIII REC 文件中的位置坐标单位为 **cm**（厘米）
- Python 转换脚本中统一乘以 `LENGTH_SCALE = 10.0` 转换为 **mm**，保存到 JSON
- 动量单位：**GeV/c**（不转换）

### 浏览器端缩放

- JSON 中坐标单位为 mm（与几何 mm 一致）
- 但 Phoenix 加载几何后的场景空间尺度取决于几何 JSON，实际缩放因子通过测量几何包围盒自动估算
- 事件渲染时统一乘以 `EVENT_GLOBAL_R_SCALE = 0.1`，即将 mm 坐标压缩到场景空间（约等于 cm 级别的场景坐标）

> **关键约定**：
> - 探测器几何加载后，场景中各体积的坐标单位是 GDML 的原生 mm，但 Phoenix 内部可能存在进一步缩放；
> - 事件数据在传入 Three.js 前乘以 0.1，使得 1 mm（数据）= 0.1 场景单位，近似对齐几何场景坐标；
> - MDC 击中和 EMC 晶体的位置由解码的 wire/cell ID 加几何参数计算，使用与 Python 脚本中完全相同的 mm 坐标后同样乘以 `EVENT_GLOBAL_R_SCALE`。

---

## 8. PID 具体做法（补充）

PID 功能由 `web/pid-tools.js`（算法与格式化）和 `web/pid-interaction.js`（交互）共同完成，入口在 `web/app.js` 中初始化。

### 8.1 参与 PID 的数据来源

- **主输入**：`TRecEvent/m_recMdcDedxCol` 转换后的 dE/dx 结果（`m_pid_prob[5]`、`chiE/chiMu/chiPi/chiK/chiP`）
- **轨迹关联**：通过 `TEvtRecObject/m_evtRecTrackCol` 建立 `mdcTrackId ↔ kalTrackId ↔ dedx` 关联
- **显示对象**：只对前端可拾取的重建 track（红色 stable track）提供 PID 面板

### 8.2 前端选中流程（点击红色重建轨迹）

1. `event-renderer.js` 在构建轨迹时将每条 track 写入 `trackCandidateCache`，并保存 `trackId/mode/pointCount` 等元数据。  
2. `pid-interaction.js` 使用 Three.js raycasting 对 `trackCandidateCache` 做命中测试。  
3. 命中后将轨迹标记为 `selectedTrackId`，同时刷新高亮样式（线宽/颜色/透明度变化），并调用 PID 面板渲染。  
4. 未命中或退出 PID 模式时，清空选中态并隐藏 hover/panel。

### 8.3 PID 概率计算与展示

`pid-tools.js` 的核心逻辑：

- `extractPidPayloadFromTrack(track)`：从轨迹对象提取 PID 原始字段（prob、chi、quality）
- `probMapFromPid(pidPayload)`：构造 `{e, mu, pi, k, p}` 概率字典
- `sumProbMap(probMap)`：做概率和检查（用于质量判断）
- `selectPidForTrack(track)`：给出“最佳粒子假设”（最大概率项）
- `buildPidDisplay(...)`：生成面板展示文本（包含概率、chi、最佳假设）

展示策略：

- 面板优先显示 `m_pid_prob[5]`（e/μ/π/K/p）
- 若概率缺失，则显示 chi 信息和“PID unavailable”
- 数值统一做格式化（`formatPidValue`），避免科学计数法影响可读性

### 8.4 MC 文件下的 truth match 显示

当事件包含 MC truth 轨迹时，PID 面板额外显示“truth match”：

- 调用 `truth.js::computeClosestTruthMatch(recTrack, truthTracks)` 做几何最近匹配
- 匹配分数使用 `meanDist + 0.2*dStart + 1.5*angleDeg`（见第 4 节）
- 显示内容：`pdg`、估算动量、匹配分数
- 该匹配仅用于显示解释，不会反向修改 reco track 或 PID 概率

### 8.5 当前约束与注意事项

- 当前 PID 面板面向 **重建轨迹**；MC truth 轨迹本身不做 PID 拟合
- PID 依赖输入 REC 中的 dE/dx 与关联关系，若上游未写入则前端只能显示几何/运动学信息
- 同一 `trackId` 在 stable/helix5 模式下可能对应不同采样点集，PID 信息以轨迹关联字段为准，不随绘制采样变化

---

## 附录：项目文件结构

```
BESIII_PhoenixCheck/
├── scripts/
│   ├── bes3_visualize.sh          # 统一入口：prepare/serve/view
│   ├── approximate_emc_gdml.py    # 近似GDML（irregBox→box, twistedtubs→tube）
│   ├── split_mdc_gdml_views.py    # 拆分MDC GDML为内/外室视图
│   ├── export_gdml_to_rootjson.C  # ROOT宏：GDML→Phoenix JSON
│   ├── export_muc_strip_map.C     # ROOT宏：从MUC GDML提取条带坐标map
│   ├── rec_to_phoenix_event.py    # REC→Phoenix事件JSON（含选定事例功能）
│   └── package_offline.sh         # 打包离线包
├── data/
│   ├── views/                     # 各子探测器 .root.json 几何文件
│   └── events/                    # 转换后的事件 JSON 文件
└── web/
    ├── index.html                 # 主页面
    ├── geometries.js              # 几何路径配置
    ├── config.js                  # 运行时配置（view/debug开关）
    ├── geometry-config.js         # 探测器组件列表和opacity配置（模块）
    ├── loader.js                  # Phoenix加载、几何初始化（模块）
    ├── event-renderer.js          # Three.js事件绘制（tracks/hits/clusters）（模块）
    ├── timeline.js                # 动画时间轴状态和控制（模块）
    ├── truth.js                   # MC truth匹配算法（模块）
    ├── pid-tools.js               # PID概率解析和显示（模块）
    ├── pid-interaction.js         # 鼠标拾取和PID面板交互（模块）
    ├── app.js                     # 主入口，编排所有模块
    ├── assets/                    # 图标、logo
    └── vendor/                    # 离线Three.js和Phoenix发行包
```
