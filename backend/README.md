# 后端（FastAPI，跑在 GitHub Codespaces）

把 `functions/api/generate-timeline.js` 的逻辑移植成 FastAPI，调用 OpenAI 兼容的
LLM（DeepSeek / 小米 MiMo），生成结构化 Timeline JSON。

前端（Cloudflare Pages）通过 Codespaces 暴露的公网 URL 调用本服务。

## 在 Codespaces 里运行

1. 在 GitHub 仓库点 **Code → Codespaces → Create codespace on main**。
   `.devcontainer` 会自动装好依赖。

2. 配置 API Key。两种方式任选其一：
   - **Codespaces Secrets（推荐）**：仓库 Settings → Secrets and variables → Codespaces，
     添加 `LLM_API_KEY`、`LLM_BASE_URL`、`LLM_MODEL`。
   - **本地 .env**：`cp backend/.env.example backend/.env` 然后填入 Key。

3. 启动服务：

   ```bash
   cd backend
   # 若用 .env：set -a; source .env; set +a
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```

4. 在 VS Code **PORTS** 面板，把 8000 端口的 **Visibility 改成 Public**，
   复制它的转发地址（形如 `https://<codespace>-8000.app.github.dev`）。

5. 打开部署在 Cloudflare 的前端，在页面顶部「后端地址」输入框粘贴上面的 URL，
   点生成即可走真实 LLM。

## 接口

- `GET  /api/health` —— 返回是否配置了 Key、当前模型。
- `POST /api/generate-timeline` —— 入参/出参与原 Cloudflare Function 完全一致。

## 环境变量

| 变量 | 必填 | 默认 | 说明 |
|---|---|---|---|
| `LLM_API_KEY` / `OPENAI_API_KEY` | 是 | — | LLM API Key |
| `LLM_BASE_URL` / `OPENAI_BASE_URL` | 否 | `https://api.deepseek.com` | OpenAI 兼容 base url |
| `LLM_MODEL` / `OPENAI_MODEL` | 否 | `deepseek-chat` | 模型名 |
| `ALLOWED_ORIGINS` | 否 | `*` | 允许的前端来源，逗号分隔 |

小米 MiMo 的 `base_url` / `model` 以你的订阅后台为准，填到上面变量即可（OpenAI 兼容）。
