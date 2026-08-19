# Vauldy TV

Vauldy TV 是面向电视与机顶盒的 Vauldy 媒体客户端，基于 **Expo SDK 52**、**react-native-tvos** 和 **Expo Router** 构建。目前重点支持 **Android TV**，并保留 tvOS 工程能力。

- 应用版本：`0.1.1`
- Android 包名：`com.knoxmedia.vauldy.tv`
- 默认方向：横屏
- 界面语言：简体中文、English

本仓库也可作为 Vauldy 主项目的 `Vauldy-TV/` Git 子模块使用。

## 功能

### 电视遥控器交互

- 针对 D-pad 的程序化焦点管理
- 左侧导航栏、内容区、返回按钮和音乐栏焦点分区
- 横向货架、纵向列表和多列网格导航
- 焦点高亮与确认操作保持一致
- 遥控器返回键处理和退出应用确认
- 输入框编辑时才显示电视屏幕键盘
- 支持长按方向键连续导航，并避免按键按下/抬起事件造成重复移动
- 详情页返回后恢复此前选中的媒体卡片焦点

### 媒体浏览

- 首页继续观看、媒体库和最近添加货架
- 媒体库与收藏网格
- 电影、电视剧、音乐、图片和文档分类
- 媒体详情、海报、元数据和收藏操作
- 全局媒体搜索，结果以多行网格展示
- 支持中文片名全拼和拼音首字母搜索
- 最近搜索自动去重并保留最新 10 条，可一键清空
- 历史记录按时间分组展示

### 视频播放

- HLS 与直接播放
- 断点续播和播放进度同步
- 遥控器左右键短按前进/后退 30 秒，长按 60 秒
- 播放、暂停、快进、快退和停止控制条
- 视频播放期间保持屏幕常亮，暂停或退出后恢复系统屏保
- 外挂 WebVTT 字幕加载、显示与字幕轨切换
- 根据服务端 `can_play` 权限控制音视频播放

### 电视剧集

- 系列详情、海报背景、季选择和分集列表
- 分集缩略图、时长和“已观看”标识
- 继续播放或从第一集开始播放
- 跨季维护顺序播放会话
- 当前集结束前预加载下一集信息
- 下一集缩略图、标题和倒计时悬浮卡片
- 倒计时期间按 **确认键** 立即播放，按 **返回键** 取消

### 音乐

- 全屏音乐播放器
- 专辑封面、歌曲、歌手和专辑信息
- LRC 同步歌词与自动滚动
- 播放队列、上一首和下一首
- 浏览页面底部浮动音乐控制栏

### 图片与文档

- 全屏图片查看
- PDF 文档阅读
- 阅读进度保存
- PDF.js 离线资源内嵌

## 技术栈

| 模块 | 技术 |
|---|---|
| UI | React 18、React Native TVOS 0.76 |
| 框架 | Expo SDK 52 |
| 路由 | Expo Router 4 |
| 状态 | Zustand 5 |
| 安全存储 | Expo SecureStore |
| 拼音搜索 | pinyin-pro |
| 网络 | Axios |
| 音视频 | expo-av |
| 图片 | expo-image |
| 文档 | pdfjs-dist、react-native-webview |
| TV 配置 | `@react-native-tvos/config-tv` |
| 测试 | Vitest、TypeScript |

## 环境要求

| 工具 | 建议版本 |
|---|---|
| Node.js | 20+ |
| npm | Node.js 随附版本 |
| JDK | 17 |
| Android SDK | 可构建 Android TV 应用的版本 |
| Android Studio | Android TV 模拟器或真机调试 |
| Xcode | tvOS 构建需要 macOS |

> `scripts/with-android-env.ps1` 和 `scripts/build-release-apk.ps1` 当前包含本机 Android SDK、JDK 和 Gradle 路径。其他开发环境使用前需修改这些路径，或自行设置 `ANDROID_HOME`、`ANDROID_SDK_ROOT`、`JAVA_HOME` 和 `GRADLE_USER_HOME`。

## 开发

安装依赖：

```bash
npm install
```

生成 TV 原生工程：

```bash
npm run prebuild:tv
```

该命令设置 `EXPO_TV=1`，并通过 `@react-native-tvos/config-tv` 生成 TV 配置。命令包含 `--clean`，会重新生成原生工程，请先确认原生目录中的手工修改已经保存。

运行 Android TV：

```bash
npm run android
```

运行 Apple TV（macOS）：

```bash
npm run ios
```

启动 Expo 开发服务器：

```bash
npm start
```

## 构建 Android TV APK

默认构建 64 位 ARM 版本：

```bash
npm run apk:release
```

按架构构建：

```bash
npm run apk:release:arm64
npm run apk:release:armv7
```

| 架构 | 适用设备 |
|---|---|
| `arm64-v8a` | 大多数现代 Android TV 与 64 位机顶盒 |
| `armeabi-v7a` | 部分较老的 32 位 ARM 电视和机顶盒 |

APK 输出到：

```text
dist/vauldy-tv-<version>-<arch>-release.apk
```

## 质量检查

类型检查：

```bash
npm run typecheck
```

运行测试：

```bash
npm test
```

## TV 品牌资源

| 资源 | 路径 | 用途 |
|---|---|---|
| 应用图标 | `assets/icon.png` | 通用与 Android TV 启动图标 |
| Adaptive Icon | `assets/adaptive-icon.png` | Android 自适应图标前景 |
| 启动画面 | `assets/splash.png` | TV 全屏启动画面 |
| TV Banner | `assets/tv-banner.png` | Android TV 桌面横幅 |

`app.json` 中配置了 `androidTVIcon` 和 `androidTVBanner`。修改品牌图片后需要重新执行 TV prebuild 并重新安装 APK；Android TV Launcher 可能缓存旧图标，必要时先卸载旧版本。

## 项目结构

```text
app/                         Expo Router 页面
  (main)/                    首页、浏览、收藏、设置
  library/                   媒体库详情
  media/                     媒体详情
  player/                    视频与音乐播放
  series/                    电视剧集详情
  reader/                    文档阅读
  photo/                     图片查看
src/
  api/                       Vauldy API 类型和客户端
  components/focus/          TV 焦点与输入组件
  components/media/          媒体卡片
  components/music/          音乐列表与状态组件
  components/player/         播放器、控制条和下一集提示
  components/series/         系列卡片和分集列表
  hooks/                     TV 按键调度与交互 Hook
  lib/                       播放、媒体、历史和文档工具
  store/                     Zustand 状态
assets/                      图标、启动图和 TV Banner
android/                     Android TV 原生工程
doc/                         需求与设计文档
scripts/                     环境、资源和 APK 构建脚本
```

## 配置服务器

首次启动后，在设置页面输入 Vauldy 服务器地址并登录。Android 配置允许明文 HTTP，生产环境仍建议使用 HTTPS。登录令牌保存在系统安全存储中；从旧版本升级时会自动迁移已有令牌。设置页还支持切换简体中文/English，并可在“关于”页查看版本和运行环境。

## 文档

- [Release Notes](RELEASE_NOTES.md)
- [电视端需求规格书](doc/电视端需求规格书.md)
- [Vauldy Server](https://github.com/knoxmedia/Vauldy)
- [Vauldy Mobile](https://github.com/knoxmedia/Vauldy-ReactNative)
- [Expo TV Guide](https://docs.expo.dev/guides/building-for-tv/)
