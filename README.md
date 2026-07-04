# GameBox

<p align="center">
  <b>简体中文</b> ｜ <a href="#-english">English</a>
</p>

---

## 📖 简介

### 什么是 GameBox

GameBox 帮助编码代理（coding agents）构建浏览器端的 3D 游戏原型。

GameBox 提供的是**积木式代码**：一组简洁、自解释的模块，专为代理在实现脆弱的 3D 游戏系统（如坐标系、角色运动、世界结构等）时，进行组合、改写与举一反三而设计。

### 为什么用 GameBox

自然语言对于精确的 3D 行为来说是一个薄弱的接口。提示词和代理的推理必须把空间变换压缩成语言 token，微小的歧义就可能导致方向反转、运动不稳定，或让游戏状态与屏幕上呈现的画面不再一致。

GameBox 通过把脆弱的 3D 与玩法模式转化为语义清晰、可检视的实现，降低了这一难度。代理无需从零推导 3D 行为，而是可以从 GameBox 举一反三，构建空间精确的 3D 游戏。

### 面向有状态的生成式世界

GameBox 关注的是世界的**有状态层**，而非视觉美术。其愿景是：世界渲染模型将日益承担起视觉生成的重担。

在那样的未来里，GameBox 提供结构化的交互状态——当代理与玩家在世界中行动时，这些模型可以据此渲染、更新，并保持世界的一致性。

## 🤖 在代理中使用

GameBox 可以作为本地 skill 使用，这样当任务涉及浏览器端 3D 游戏开发时，编码代理便能自动发现它。

### Codex

1. 将仓库克隆到本地。

2. 在仓库根目录运行以下命令（把 `gamebox` 复制到 skills 目录）：
```bash
mkdir -p ~/.codex/skills/gamebox && cp -R gamebox/. ~/.codex/skills/gamebox/
```
3. 重启 Codex 应用（可选）。

4. 在 Codex 输入框中，键入 `/gamebox` 或 `$gamebox` 来调用该 skill，或在任务匹配 skill 描述时让它自动加载。

### Claude Code

1. 将仓库克隆到本地。

2. 在仓库根目录运行以下命令（把 `gamebox` 复制到 skills 目录）：
```bash
mkdir -p ~/.claude/skills/gamebox && cp -R gamebox/. ~/.claude/skills/gamebox/
```
3. 重启 Claude 应用（可选）。

4. 在 Claude Code 输入框中，键入 `/gamebox` 来调用该 skill，或在任务匹配 skill 描述时让它自动加载。

## 💬 社群

欢迎加入 GameBox 开源社群，扫码进群交流：

<p align="center">
  <img src="assets/community-qr.jpg" alt="GameBox 开源社群" width="320" />
</p>

> 微信群二维码有时效，若已过期，欢迎在 Issues 中留言获取最新入群方式。

<br/>

---

<a name="-english"></a>

<p align="center">
  <a href="#-简介">简体中文</a> ｜ <b>English</b>
</p>

## 📖 Introduction

### What Is GameBox

GameBox helps coding agents build browser-based 3D game prototypes.

GameBox provides **building-block code**: concise and self-explanatory modules designed for agents to compose, adapt, and generalize from while implementing fragile 3D game systems such as coordinate frames, actor motion, and world structure.

### Why Use GameBox

Natural language is a weak interface for precise 3D behavior. Prompts and agent reasoning must compress spatial transformations into language tokens. Small ambiguities can cause inverted directions, unstable motion, or gameplay state that no longer matches what appears on screen.

GameBox reduces that difficulty by turning fragile 3D and gameplay patterns into inspectable implementations with clear semantics. Instead of deriving 3D behavior from scratch, agents can generalize from GameBox to build spatially accurate 3D games.

### For Stateful Generative Worlds

GameBox focuses on the stateful layer of a world rather than visual aesthetics. The vision is that world-rendering models will increasingly lift the burden of visual generation.

In that future, GameBox provides the structured interactive state that those models can render from, update, and keep consistent as agents and players act inside the world.

## 🤖 Use in Agents

GameBox can be used as a local skill so a coding agent can discover it when a task involves browser-based 3D game development.

### Codex

1. Clone the repository locally.

2. Run this command from the repository root (to copy `gamebox` to the skills folder):
```bash
mkdir -p ~/.codex/skills/gamebox && cp -R gamebox/. ~/.codex/skills/gamebox/
```
3. Restart the Codex app (optional).

4. In the Codex chatbox, invoke the skill by typing `/gamebox` or `$gamebox`, or let it load automatically when the task matches the skill description.

### Claude Code

1. Clone the repository locally.

2. Run this command from the repository root (to copy `gamebox` to the skills folder):
```bash
mkdir -p ~/.claude/skills/gamebox && cp -R gamebox/. ~/.claude/skills/gamebox/
```
3. Restart the Claude app (optional).

4. In the Claude Code chatbox, invoke the skill by typing `/gamebox`, or let it load automatically when the task matches the skill description.

## 💬 Community

Join the GameBox open-source community — scan the QR code to enter the group chat:

<p align="center">
  <img src="assets/community-qr.jpg" alt="GameBox open-source community" width="320" />
</p>

> The WeChat group QR code expires periodically. If it no longer works, please leave a note in Issues to get the latest invite.
