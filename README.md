# AI Collaborative Docs Monorepo

本仓库包含四个子目录：
- `frontend`：Vite + React + TypeScript + Univer 文档编辑器，内置 Socket.IO 协作示例。
- `backend`：Node.js + Express，提供文档 REST API（版本、权限、回滚）。
- `collab-service`：Node.js + Socket.IO，文档协作会话/OT 广播与定期持久化。
- `ai-service`：预留目录（未实现）。

## 前置依赖
- Node.js 18+
- npm
- Docker / Docker Compose（用于 MongoDB 与 Redis）

## 快速启动
1) 启动数据库与缓存  
```bash
docker-compose up -d
```
默认 Mongo 连接串：`mongodb://admin:example@localhost:27017/?authSource=admin`（数据库名 `ai-financial`），Redis 端口 6379。

2) 启动后端 REST API（端口 4000）  
```bash
cd backend
npm install
npm run dev
```
环境变量（可选）：`MONGODB_URI`、`MONGODB_DB`、`JWT_SECRET`。

3) 启动协作服务（端口 5001，Socket.IO）  
```bash
cd collab-service
npm install
npm run dev
```
环境变量（可选）：`MONGODB_URI`、`MONGODB_DB`、`JWT_SECRET`、`COLLAB_ORIGIN`、`PERSIST_INTERVAL_MS`。

4) 启动前端（Vite 开发服务器，默认 5173）  
```bash
cd frontend
npm install
npm run dev
```
前端会尝试用本地存储/环境变量 `VITE_DEMO_TOKEN` 作为 JWT 与后端/协作服务通信。

## API 摘要（backend）
- `GET /health`
- `GET /documents/:id` 获取文档 + 用户角色
- `POST /documents/:id/save` 保存当前文档（缺失则创建并设调用者为 owner）
- `GET /documents/:id/versions` 获取历史版本
- `POST /documents/:id/revert` 回滚到指定版本（body: `versionId`）

权限（RBAC）：`owner > editor > commenter > viewer`；读取需 viewer+，写入/回滚需 editor+。

## 协作服务（collab-service）
- 握手需 `auth.token`（Bearer 不必，Socket.IO auth 字段），默认密钥 `dev-secret` 可用 `JWT_SECRET` 覆盖。
- 事件：
  - client -> server: `join_session` `{ docId }`，`edit_op` `{ docId, baseVersion, ops }`，`cursor_update` `{ docId, cursor }`
  - server -> clients: `session_joined`，`broadcast_op`，`user_cursor`
- 内存维护每文档会话，定期持久化内容与操作日志到 Mongo。

## 开发提示
- 如需跨端口访问，确保前端 API/协作基地址在 `.env`/环境中配置（例如 `VITE_COLLAB_URL`）。
- 默认 JWT 仅作开发用途，上线请更换强随机 `JWT_SECRET` 并接入真实身份与权限下发。***
