# AI-Memory Framework

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/hczxy05/ai-memory-framework?style=social)](https://github.com/hczxy05/ai-memory-framework)
[![GitHub issues](https://img.shields.io/github/issues/hczxy05/ai-memory-framework)](https://github.com/hczxy05/ai-memory-framework/issues)

**[English](README.md)** | 中文

双库 AI 记忆架构：**Git Markdown 权威记忆** + **可选经验记忆**。

> AI-Memory 管理"现在什么是真的"；经验记忆帮助回忆"过去发生过什么"。先确认当下，再参考历史。

## 30 秒上手

```bash
git clone https://github.com/hczxy05/ai-memory-framework.git ~/ai-memory
```

1. 在 `personal/universal-memory.md` 填写稳定的用户信息和偏好。
2. 在 `project/projects.md` 添加项目路径；按需调整 `rules/conventions.md`。
3. 让你的 Agent 每次任务先读 `~/ai-memory/AGENTS.md`。

这时 Git Markdown 记忆已经可以独立工作；TDAI 经验记忆是可选增强。

## 为什么需要它

AI 助手容易在会话之间丢失上下文，也容易把旧对话误当成当前事实。本框架把两类信息明确分开：

- **权威记忆**：已确认的规则、事实、状态、架构和决策；人类可读、Git 可追踪。
- **经验记忆**：对话、尝试、提取的经验和画像；用于历史参考，可能过时或错误。

两个存储协同，但不等权。

## 架构

```text
当前用户指令
    ↓
治理记忆：AGENTS.md · memory-policy.md · conventions.md
    ↓
权威记忆：用户信息 · 项目状态 · 架构 · 决策 · 问题 · 经验
    ↓
经验记忆（可选）：对话 · 尝试 · 场景 · 画像
```

**优先级**：当前指令 > 治理 > 权威 > 经验 > 原始历史

## 仓库结构

```text
ai-memory-framework/
├── AGENTS.md                    # 每次任务加载的行为摘要
├── rules/                       # Agent 行为与治理规则
│   ├── authority.md             # 信息来源优先级与操作授权
│   ├── memory-policy.md         # 完整权威规范
│   ├── memory-promotion.md      # 记忆晋升流程
│   ├── conventions.md           # 稳定协作约定
│   └── changelog.md
├── personal/
│   └── universal-memory.md      # 用户信息模板
├── project/
│   └── projects.md              # 项目索引模板
├── templates/
│   ├── project-template.md
│   ├── task-template.md
│   └── report-template.md
├── integrations/
│   ├── openclaw-tdai-local/
│   └── codex-tdai-local/
├── workspace-example/           # OpenClaw 工作区示例
│   ├── AGENTS.md
│   ├── IDENTITY.md
│   ├── SOUL.md
│   ├── USER.md
│   ├── TOOLS.md
│   ├── MEMORY.md
│   └── memory-manual.md         # 一页快速参考
└── examples/tdai/               # 提供方生成内容示例
    ├── persona.md
    ├── .metadata/experience_contract.json
    └── scene_blocks/example-scene.md
```

## 工作方式

### 建立上下文

```text
加载 AGENTS.md
  → 读取任务所需的最小权威记忆
  → 必要时进行一轮经验检索（1 个搜索工具，最多 3 条）
  → 展示每条相关内容及来源、日期、范围和冲突说明
  → 由用户决定是否继续下一轮
  → 区分已确认、历史证据、推断和未知
```

### 更新记忆

```text
候选内容 → 验证 → 提议具体内容和目标文件 → 用户授权 → 写入权威记忆
```

经验记忆不能直接修改治理或权威文件。

## 配置经验记忆（可选）

- [OpenClaw + 本地 TDAI](integrations/openclaw-tdai-local/README.md)
- [Codex + 本地 TDAI](integrations/codex-tdai-local/README.md)

没有可用的经验记忆提供方时，继续使用 Git Markdown 即可。

## 配置 Agent 工作区

将下面的引导规则放进工作区 `AGENTS.md`：

```markdown
先读 <ai-memory-path>/AGENTS.md，并遵循其中的加载、经验检索和写入规则。
```

OpenClaw 用户可以复制 `workspace-example/`，再填写其中的身份、用户和工具信息。`USER.md` 与 `MEMORY.md` 只是工作区上下文；稳定事实仍以 AI-Memory 中负责该信息的文件为准。

## 核心原则

| 原则 | 含义 |
|---|---|
| 小上下文 | 只加载任务需要的内容 |
| 分层权威 | 历史证据不能覆盖当前事实 |
| 受控写入 | 长期记忆必须已确认、稳定、可复用且经用户授权 |
| 诚实不确定 | 明确区分事实、推断和未知 |
| 人类控制 | 高风险、破坏性或外部操作先确认 |

## 添加项目

1. 使用 `templates/project-template.md` 在项目仓库中创建 `STATUS.md` 或组合式 `PROJECT.md`。
2. 大型项目按需增加 `ARCHITECTURE.md`、`DECISIONS.md`、`BUGS.md`、`LESSONS.md`。
3. 在 `project/projects.md` 中登记项目路径。

## 兼容平台

- **OpenClaw** — 可接入本地 TDAI。
- **Codex** — 可通过本地 MCP 适配器访问经验记忆。
- **其他 AI 助手** — 只要能读取 Markdown，即可使用权威记忆层。

## 安全

本项目是一套记忆治理规范及本地 MCP 适配器。适配器通过代码限制 SQLite 检索作用域、文件读取范围与字节数，并由宿主控制是否开放写入。可选的 [Promotion Gate](integrations/promotion-gate/README.md) 校验绑定具体候选的签名审批，并原子追加到权威项目文档；事实审查和操作系统权限隔离仍由宿主负责。

- 不在记忆中存储密码、API Key、Token 或私钥。
- 不把运行时数据库、原始对话或完整工具配置提交到本仓库。
- 部署、破坏性操作、财务行为和物理控制必须先获得明确授权。

## License

[MIT](LICENSE)

## Credits

Built through iterative human-AI collaboration across real engineering workflows.

## 验证证据

[2026-10-16 完整测试报告](test-results/2026-10-16-comprehensive/README.md) 包含合成测试原始数据、失败记录、费用和复现脚本，并明确关键词检索、原生插件共享存储及模型治理提示的限制。

## 后续验证证据

[项目隔离、自由回答与 72 小时完整报告](test-results/2026-10-16-followup/README.md)：两组均完成实际 72 小时观察及真实 L0/L1 检查点。冻结的 24 场景两组成绩相同，未证明准确率提升；报告保留完整运行日志、重启时内存压力和源码换行格式的哈希差异。
