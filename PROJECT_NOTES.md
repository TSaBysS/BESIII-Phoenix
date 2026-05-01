# BESIII PhoenixCheck — 项目技术说明

本仓库提供：**BOSS GDML → Phoenix 几何**、**REC/MC ROOT → Phoenix 事例 JSON**、以及 **浏览器内事件叠加（径迹 / 击中 / shower / PID / MC truth）** 的一整套工具链。

## 目录

1. [各子探测器几何组件](#1-各子探测器几何组件)
2. [REC 文件使用了哪些信息](#2-rec-文件使用了哪些信息)
3. [Truth Track 是如何画的](#3-truth-track-是如何画的)
4. [Truth Track 与 Rec Track 的匹配](#4-truth-track-与-rec-track-的匹配)
5. [Rec Track 是如何画的](#5-rec-track-是如何画的)
6. [坐标约定](#6-坐标约定)
7. [PID 具体做法（补充）](#7-pid-具体做法补充)
8. [MDC/EMC/TOF/MUC Hit 是如何画的](#8-mdcemctofmuc-hit-是如何画的)

---

## 1. 各子探测器几何组件

几何数据来自 BOSS GDML 文件，由 `scripts/bes3_visualize.sh prepare` 处理后转为 Phoenix 可读的 ROOT JSON 格式。

### MDC（主漂移室）

- **来源 GDML**：`Mdc.gdml` → `Mdc_approx.gdml`（近似处理后）
- **近似内容**：原始 MDC 中含有 `twistedtubs`（扭曲管）实体，这是 GDML 标准中存在但 ROOT TGeoManager 不支持的形状。当前由 `prepare_geometry.py` 的 `approximate` 子命令统一替换为普通圆管（`tube`），忽略了导线的实际螺旋扭角，因此**立体导线层的几何是近似的**。

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

- **分割视图**（由 `prepare_geometry.py split-mdc` 生成）：
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
- **近似内容**：EMC 晶体为 CsI(Tl) 楔形体（`irregBox` — 不规则八顶点盒），ROOT 不支持此形状。当前由 `prepare_geometry.py` 的 `approximate` 子命令将每个 `irregBox` 替换为**等效外包围盒**（`box`），因此**每块晶体的实际楔形截面被替换为长方体**，整体外形仍然正确但晶体形状是近似的。
- **几何组件**：
  - **桶部**（Barrel，part=1）：120 × 44 = 5280 块 CsI 晶体，围绕束轴排列，θ 从约 33° 到 147°
  - **端盖**（Endcap，part=0 和 part=2，−z 和 +z 端）：每端各约 480 + 480 + 576 = 1536 块晶体（分 0–5 theta ring，每环 64/80/96 个晶体）
  - 支撑结构、后端读出盒（RearBox）、光二极管（PD）、前放盒（PreAmpBox）等机械结构均包含在 GDML 中

> **注意**：当前版本使用 `emc_approx.root.json`。端盖几何对象是存在并参与加载的；若视觉上“形状怪异”，主要来自 `irregBox -> box` 的近似替换与渲染观感，而非端盖缺失。

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

由 `scripts/prepare_events.py` 从 BESIII REC ROOT 文件读取。

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

### 筛选条件（`prepare_events.py`）

- 只输出**带电粒子**螺旋线：PDG 在 `{11, 13, 211, 321, 2212}`（e/μ/π/K/p）及其反粒子。
- **跳过束流电子**：`|pdg| == 11` 且 `mother < 0`。
- **跳过带电 π/K 的直接衰变产物**：根据 `m_mother` 解析母粒子 PDG（先整表构建 `trackIndex → pdg`），若**直接母亲**为 **π±（211）或 K±（321）**，则不导出该条 MC truth 折线。
- **跳过 μ 子衰变的带电产物**：若**直接母亲**为 **μ±（13）**（例如 Michel `e±`），则不导出。

说明：MC 表中仍有大量次级粒子；上述过滤用于减少「起点不在顶点、又与 reco 无关」的示意螺旋线。未过滤的中性粒子、光子 truth 等仍按原逻辑处理。

### 轨迹推导

从 MC 粒子的**初始动量**（GeV/c）与**初始位置**（cm→脚本内乘 `LENGTH_SCALE` 转为 mm）出发，用**均匀磁场近似**做螺旋步进（步长 10 mm，最多约 3000 步）。代码中磁场因子写为 **`field = -1.0`（与 BesVis 里 `f_Magnetic` 取 Tesla 的方式不同）**，半径公式形式与 BesVis `BesEvent::ConstructMcTrack` 一致：`radius = (pt×1e9/kv_c×1e3)/|q·field|`（量级供可视化用，**非**精细轨道再现）。

用 `m_x/y/zFinalPosition` 仅作**停止启发式**（接近末点或距离开始回升等），**不**用末点约束螺旋几何形状。

浏览器端（`event-renderer.js`）对 **`mode === "mc"`** 的折线在绘制前再裁一段 **MDC 圆柱包络**（与脚本里跳出螺旋相同的半径/轴向阈值量级），避免腔外折线段与 TOF/MUC 击中混淆；JSON 中的 `pos` 仍为完整折线。

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

## 5. Rec Track 是如何画的

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

若 Kalman 解析失败，**当前实现会直接降级到基础螺旋参数化**（`build_track_points`）。

`build_track_points_from_mdc_helix`（Runge-Kutta/步进积分，步长 10 mm，均匀 Bz 场）函数目前仍保留在 `prepare_events.py`，但未接入主转换路径。

### 渲染

- 折线（Three.js `Line`）+ 密集点云（Three.js `Points`）
- 颜色：red `0xff4d4d`（stable），light-blue `0x90caf9`（MC truth）
- `depthTest: false`，`renderOrder: 999/998`，确保显示在探测器几何之上

---

## 6. 坐标轴约定

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

## 7. PID 具体做法（补充）

PID 功能由 `web/pid-tools.js`（算法与格式化）和 `web/pid-interaction.js`（交互）共同完成，入口在 `web/app.js` 中初始化。

### 7.1 参与 PID 的数据来源

- **主输入**：`TRecEvent/m_recMdcDedxCol` 转换后的 dE/dx 结果（`m_pid_prob[5]`、`chiE/chiMu/chiPi/chiK/chiP`）
- **TOF 约束**：`TRecEvent/m_recTofTrackCol` 的 `beta/sigma`，用于不同粒子假设的 beta 一致性似然
- **EMC 约束**：`TRecEvent/m_recEmcShowerCol` 的 `energy` 与轨迹动量形成 `E/p` 似然
- **轨迹关联**：通过 `TEvtRecObject/m_evtRecTrackCol` 建立 `mdcTrackId ↔ kalTrackId ↔ dedx` 关联
- **显示对象**：只对前端可拾取的重建 track（红色 stable track）提供 PID 面板

### 7.2 前端选中流程（点击红色重建轨迹）

1. `event-renderer.js` 在构建轨迹时将每条 track 写入 `trackCandidateCache`，并保存 `trackId/mode/pointCount` 等元数据。  
2. `pid-interaction.js` 使用 Three.js raycasting 对 `trackCandidateCache` 做命中测试。  
3. 命中后将轨迹标记为 `selectedTrackId`，同时刷新高亮样式（线宽/颜色/透明度变化），并调用 PID 面板渲染。  
4. 未命中或退出 PID 模式时，清空选中态并隐藏 hover/panel。

### 7.3 PID 概率计算与展示

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

### 7.4 MC 文件下的 truth match 显示

当事件包含 MC truth 轨迹时，PID 面板额外显示“truth match”：

- 调用 `truth.js::computeClosestTruthMatch(recTrack, truthTracks)` 做几何最近匹配
- 匹配分数使用 `meanDist + 0.2*dStart + 1.5*angleDeg`（见第 4 节）
- 显示内容：`pdg`、估算动量、匹配分数
- 该匹配仅用于显示解释，不会反向修改 reco track 或 PID 概率

### 7.5 当前约束与注意事项

- 当前 PID 面板面向 **重建轨迹**；MC truth 轨迹本身不做 PID 拟合
- PID 融合 dE/dx + TOF + EMC 信息；若 TOF/EMC 缺失则主要退化为 dE/dx 主导。若 dE/dx 也缺失，前端仅能显示几何/运动学信息
- PID 面板面向重建稳定轨迹（stable），并可附加显示其 MC truth 几何匹配信息。

---

## 8. MDC/EMC/TOF/MUC Hit 是如何画的

这一节说明从 REC 数据到浏览器可视化的完整链路：  
`prepare_events.py` 负责把 ROOT 分支解码为 `Hits` JSON；`event-renderer.js` 负责把这些 `Hits` 转成 Three.js 几何对象并叠加到探测器上。

### 8.1 通用渲染约定

- 事件数据在 JSON 中使用 mm；前端统一乘 `EVENT_GLOBAL_R_SCALE = 0.1` 再放入场景。
- Hit 覆盖层材质统一 `depthTest: false`，保证不被几何遮挡。
- 通过 `renderOrder` 控制层级：MDC/EMC hit 通常在 1000 左右，TOF/MUC 略低（约 995/992）。

### 8.2 MDC hit（REC MdcHit）

#### 数据解码（`prepare_events.py`）

- 来源：`TRecEvent/m_recMdcHitCol`。
- `m_mdcid` 用 `decode_mdcid()` 解码为 `(layer, wire)`。
- 位置由 `mdc_hit_xyz_from_id(layer, wire, zhit)` 计算，其中 `zhit = m_zhit * LENGTH_SCALE`（cm→mm）。
  - 优先使用 `Mdc_approx.gdml` 中解析出的层半径和导线模板。
  - stereo 层按 `z` 位置加入扭角修正（`_stereo_twist_by_layer`），因此同一根导线不同 z 的横向位置会变化。
- 同时计算导线方向 `wireDir`（`mdc_wire_dir`）和导线类型 `wireType`（axial/stereo），并写入 `adc/tdc/driftT/doca/lr` 等原始信息。

#### 前端绘制（`event-renderer.js`）

- 每个 MDC hit 画为沿 `wireDir` 的短发光线段（`Line`）：
  - 颜色固定 BesVis 风格红色 `0xff4d4d`。
  - 线段长度和透明度随 `adc` 归一化值增强，stereo 比 axial 更长更亮。
- stereo 命中额外加一个小圆锥（`ConeGeometry`）表示导线方向感。
- 在线段末端再叠加一个发光球（`SphereGeometry`）做“击中头部”高亮。
- `userData.kind` 分别标记为 `mdc_hit_fire / mdc_hit_cone / mdc_hit_bubble`，便于后续交互或调试筛选。

### 8.3 EMC hit（REC EmcHit）

#### 数据解码（`prepare_events.py`）

- 来源：`TRecEvent/m_recEmcHitCol`。
- `m_cellId` 用 `decode_emcid()` 解码为 `(part, theta, phi)`。
- 对桶部沿用 BesVis 约定：`part == 1` 时执行 `theta = 43 - theta`（环号方向翻转）。
- 输出字段以晶体索引和能量为主：`cellId/part/theta/phi/energy/time`。

#### 前端绘制（`event-renderer.js`）

- 先按 `cellId` 合并同晶体多次击中并累加能量。
- 再按 `(part, theta, phi)` 做几何近似定位：
  - 桶部：按 `120 x 44` 网格投影到 EMC 桶壳半径附近。
  - 端盖：按 ring（0–5）与对应 `nPhi`（64/80/96）投影到 ±z 端盖。
- 每个晶体 hit 画为红色半透明盒子（`BoxGeometry`，`0xff2b2b`），不透明度按 `energy / emax` 缩放。
- 这是“晶体命中覆盖层”，与 EMC shower（球状径向 glow）是两套对象，前者反映晶体触发，后者反映重建簇。

### 8.4 TOF hit（REC TofHit）

#### 数据解码（`prepare_events.py`）

- 来源：`TRecEvent/m_recTofTrackCol`（兼容 `TDstEvent/m_tofTrackCol`）。
- 先用 `m_status` 过滤：只保留 counter（`is_tof_counter`）。
- 通过 `is_tof_barrel(status)` 分桶部/端盖，结合 `m_tofID` 得到 `layer/scin/part`。
- 击中位置使用参数化几何近似：
  - 桶部：`r = 810/860 mm`（内/外层），`z` 来自 `m_zrhit`（并裁剪到 ±1200 mm）。
  - 端盖：`r = 760 mm`，`z = ±1280 mm`。
- 另外写入近似尺寸 `size=[sx,sy,sz]` 供前端直接画体素。

#### 前端绘制（`event-renderer.js`）

- 每个 TOF hit 画一个半透明盒子（`BoxGeometry`），中心在 `pos`，尺寸取 `size` 并乘全局缩放。
- 颜色按部位区分：
  - 桶部（`part=1`）：青色 `0x4dd0e1`
  - 端盖（`part=0/2`）：橙色 `0xffb74d`
- 盒子朝向通过 `lookAt(0,0,z)` 与径向对齐，作为“被击中的闪烁体块”视觉提示。

### 8.5 MUC hit（REC MucHit）

#### 数据解码（`prepare_events.py`）

- 来源：`TRecEvent/m_recMucTrackCol` 的 `m_vecHits`（strip intId 列表），辅以 `TDigiEvent/m_mucDigiCol` 的 `m_timeChannel`。
- `mucID` 由 `decode_mucid()` 解码为 `(part, seg, gap, strip)`。
- 空间信息优先来自 `data/views/muc_strip_map.json`：
  - `_resolve_muc_row()` 先精确 key 匹配 `P{part}S{seg}G{gap}R{strip}`。
  - 若不命中，桶部尝试 seg 折叠映射并做最近 strip 回退。
- 若 strip map 不可用，使用桶部/端盖参数化近似坐标（`posSource = "approx"`）。
- 输出包含完整刚体基向量 `basisX/basisY/basisZ` 与尺寸 `size`，用于前端精确摆放条带体素。

#### 前端绘制（`event-renderer.js`）

- 每个 MUC hit 画绿色薄板盒子（`BoxGeometry`，`0x81c784`，半透明）。
- 若 `basisX/Y/Z` 存在且合法，直接构造旋转矩阵设置姿态；否则回退到 `lookAt(0,0,z)`。
- 在没有加载 MUC 几何对象时，会做一次半径/轴向 clamp，避免条带飞出可视范围。
- `userData.kind = "muc_hit_strip"`，便于后续点击拾取与调试。

### 8.6 与 BesVis 一致性和当前近似

- **MDC**：遵循“wire 几何 + zhit”的命中定位思想，颜色/风格也与 BesVis fired-wire 红色一致；但 stereo 扭角仍是近似模型。
- **EMC**：hit 使用晶体索引驱动的规则化体素覆盖，不是逐块精确楔形晶体布尔体。
- **TOF**：使用桶部/端盖参数化半径和尺寸，强调可读性与稳定显示。
- **MUC**：优先走 `muc_strip_map.json` 的真实条带中心与姿态；缺图时才回退近似参数化。

---

## 附录：项目文件结构

```
BESIII_PhoenixCheck/
├── scripts/
│   ├── bes3_visualize.sh          # prepare / prepare-event / prepare-mixed
│   ├── merge_phoenix_events.py   # 合并多个 Phoenix 事例 JSON（顶层字典合并）
│   ├── prepare_geometry.py       # 几何预处理（approximate + split-mdc）
│   ├── export_geometry.C         # ROOT 宏：GDML→ROOT JSON / MUC strip map
│   ├── prepare_events.py         # REC→Phoenix 事例 JSON（PID、MC truth 过滤等）
│   └── package_offline.sh        # 打包离线包
├── data/
│   ├── views/                    # 各子探测器 .root.json 几何文件
│   └── events/                   # 事例 JSON；默认演示见 event.mixed.json
│       └── ks_mc_pairs.txt       # prepare-mixed 中 KS.rec 的 (runId,eventId) 列表
└── web/
    ├── index.html                # BES3_GEOMETRIES、BES3_DEFAULT_EVENT_URL 等
    ├── app.js                    # 几何加载、默认事例 fetch、事例导航/搜索
    ├── loader.js                 # Phoenix 加载、透明度、相机
    ├── event-renderer.js         # Track/Hit/Shower；MC truth MDC 裁剪显示
    ├── truth.js                  # MC truth 几何匹配
    ├── pid-tools.js / pid-interaction.js
    ├── assets/ / vendor/
    └── ...
```

**`prepare-mixed`**（见 `bes3_visualize.sh`）：对 Knunubar 目录批量 `--rec-dir` 转换，再对 `KS.rec` 用 `--select ks_mc_pairs.txt` 抽取 MC 子集，`merge_phoenix_events.py` 合并为 `data/events/event.mixed.json`。环境变量 `KNUNUBAR_REC_DIR`、`KS_REC_MC`、`KS_MC_PAIRS` 可覆盖默认路径。
