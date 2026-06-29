<h1 align="center">
<img src='./src-tauri/icons/128x128.png' width="64" style="vertical-align: middle"> Tesla Camera
</h1>

<p align="center">
特斯拉行车记录仪播放器，支持 Windows、MacOS、Browser(Chrome 86+) 平台
</p>

<p align="center">
<a href="https://github.com/Mario34/tesla-camera/releases" target="_blank">
<img alt="macOS" src="https://img.shields.io/badge/-macOS-gray?style=flat&logo=apple&logoColor=white" />
</a>
<a href="https://github.com/Mario34/tesla-camera/releases" target="_blank">
<img alt="Windows" src="https://img.shields.io/badge/-Windows-blue?style=flat&logo=windows10&logoColor=white" />
</a>
<a href="https://mario34.github.io/tesla-camera" target="_blank">
<img alt="Windows" src="https://img.shields.io/badge/Chrome-86+-green?style=flat&logo=googlechrome&logoColor=white" />
</a>
<a href="https://github.com/Mario34/tesla-camera/releases" target="_blank">
<img alt="Downloads" src="https://img.shields.io/github/downloads/Mario34/tesla-camera/total.svg?style=flat" />
</a>
</p>

<p align="center">
<img width="700" alt="Screen Shot" src="https://github-production-user-asset-6210df.s3.amazonaws.com/42017165/261678774-5f1e61ab-4db2-448b-b687-cc48a45ebfb3.png" />
</p>

<p align="center">
<img width="360" alt="Screen Shot" src='https://github.com/Mario34/tesla-camera/assets/42017165/bfe978ed-c339-4d28-ab10-92d2d75cae05' />
<img width="360" alt="Screen Shot" src='https://github.com/Mario34/tesla-camera/assets/42017165/4e24cd50-9423-4ffa-90f9-411888019061' />
</p>

## 安装

访问 [Github Releases](https://github.com/Mario34/tesla-camera/releases) 下载对应的包，各个平台对应包名称对应关系如下

- Windows: \*_x64-setup.exe、\*_x64_en-US.msi
- MacOS: \*_x64.dmg、\*_x64.app.tar.gz

*网页版由于浏览器限制暂不支持导出带时间戳视频，有导出需求请下载客户端；网页版仅支持 chromium 86+ 版本浏览器*

## 功能

### 视频播放

- 自动兼容 HW3 四路录像与 HW4 六路录像，包括 `left_pillar`、`right_pillar` 两侧 B 柱摄像头。
- 响应式多画面同步播放；点击任意画面即可切换举报取证视角。
- 空格键播放/暂停，字母键快速切换摄像头视角。
- 视频始终在本地读取和处理，不上传到服务器。

### 举报取证

- **截图取证**：截取当前帧并写入拍摄时间、摄像头视角、位置水印（城市 + 经纬度）。
- **视频截取**：通过单条时间轴拖拽起止手柄选取片段，高亮范围直观显示截取区间，导出带时间码的 MP4 举报片段或完整单段视频。
- **位置信息**：基于高德逆地理编码 API 自动解析违章发生地点，支持一键复制。
- **车牌识别**：基于 Tesseract.js（chi_sim+eng）对当前帧中心区域进行 OCR，自动提取车牌号码，结果写入举报信息卡片并支持单独复制。
- **违法描述生成**：内置 8 种常见交通违法行为（占用应急车道、违法占用公交车道、压实线变道、违法停车、闯红灯、逆向行驶、车窗抛物、其他），选择后自动按模板拼接车牌、地点、时间生成完整举报描述，并根据所选类型对应的最低时长要求动态检查合规性（如违法停车 ≥12s、其他违法行为 ≥5s）。
- **举报信息卡片**：截图/导出/识别车牌后自动生成时间、地点、车牌、事件原因、片段时长及合规性检查，支持复制全部。

### 技术栈

| 层 | 技术 |
|---|---|
| 框架 | Tauri v2 + React 19 + TypeScript |
| 构建 | Rsbuild |
| UI | Fluent UI React Components |
| 状态 | Zustand |
| 视频处理 | FFmpeg (sidecar) |
| OCR | Tesseract.js（车牌识别） |
| 地图 | 高德地图 JS API 2.0 |
| 逆地理编码 | 高德 Web API |

## 开发者指南

### 环境准备

1. 安装 [Node.js](https://nodejs.org/) 和 [pnpm](https://pnpm.io/)（>= 11.5.2）
2. 安装 [Rust](https://www.rust-lang.org/tools/install) 开发环境
3. 克隆项目并安装依赖：

```bash
git clone https://github.com/Mario34/tesla-camera.git
cd tesla-camera
pnpm install
```

4. 执行 `init-binaries.sh` 下载解压依赖的外部二进制文件（FFmpeg）

*Windows 下可能不支持部分命令，遇到问题需要手动下载解压*

5. 配置高德地图 App Key（用于位置解析与地图展示，**请勿提交到仓库**）：

```bash
# 开发模式（rsbuild dev）
cp .env.example .env.local
# Tauri 构建模式（--env-mode tauri）
cp .env.example .env.tauri.local
# 然后编辑文件填入自己的 PUBLIC_AMAP_KEY
```

`.env.local` 与 `.env.tauri.local` 已在 `.gitignore` 中忽略。

### 一键启动

```bash
./dev.sh
```

脚本会自动清理前端缓存和 Rust 增量编译缓存，安装依赖后以开发模式启动 Tauri 应用，确保每次启动均为最新代码状态。

### 手动启动

```bash
pnpm app:dev
```

### 常用命令

```bash
pnpm lint          # ESLint 检查
pnpm test          # Vitest 单元测试
pnpm build         # 前端构建
pnpm tauri build --no-bundle  # Tauri 构建（不打包安装程序）
```

### 样本数据

开发模式下可通过 `sample` 查询参数加载由本地 HTTP 服务提供的一组六路样本：

```text
http://localhost:6680/?sample=http://127.0.0.1:6681/2026-06-29_10-04-22
```

### 项目结构

```
tesla-camera/
├── src/
│   ├── app.tsx                    # 应用入口与布局
│   ├── model.ts                   # 数据模型定义
│   ├── tesla-cam.ts               # Tesla 录像解析逻辑
│   ├── components/
│   │   ├── player.tsx             # 多路视频同步播放器
│   │   ├── mini-player.tsx        # 单路视频播放组件
│   │   ├── evidence-tools.tsx     # 举报取证工具（截图/导出/信息卡片）
│   │   ├── range-timeline.tsx     # 单轨道双滑块时间轴组件
│   │   ├── location-map.tsx       # 高德地图嵌入组件
│   │   ├── fs-system.tsx          # Tauri 文件系统访问
│   │   ├── directory-access.tsx   # 浏览器文件系统访问
│   │   └── check-update.tsx       # 应用更新检查
│   └── utils/
│       ├── geocode.ts             # 高德逆地理编码
│       ├── plate-ocr.ts           # 车牌 OCR 识别
│       └── violation-report.ts    # 违法描述模板生成
├── src-tauri/                     # Tauri 后端（Rust）
└── dev.sh                         # 一键启动脚本
```
