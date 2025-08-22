# loginSSO API 实现总结

## 新增功能

为 LibreChat 添加了一个新的登录 API 接口 `/loginSSO`，该接口允许在cancer probot注册登陆的用户跳转登录到LibreChat中。

## 实现的文件

### 1. 新增控制器
- **文件**: `api/server/controllers/auth/loginSSOController.js`
- **功能**: 处理 SSO 登录逻辑，验证邮箱并生成认证令牌

### 2. 修改的路由文件
- **文件**: `api/server/routes/auth.js`
- **修改**: 添加了新的 GET 路由 `/loginSSO`


### 请求格式
```
GET /api/auth/loginSSO?payload=XXXX(AES加密信息)

payload中包含如下信息
{
email: 'xxx', ts: xxx
}
```
### 主要功能
1. **邮箱验证**: 验证邮箱是否存在于数据库中,如果不在数据库中则在mongdb中创建新用户并登录
2. **无密码登录**: 不需要密码验证
3. **请求检查**: 检查请求是否过期，防止一个pyload被多次请求(ts检查)
4. **双因素认证支持**: 如果启用 2FA，返回临时令牌
5. **安全过滤**: 响应中不包含敏感信息
6. **日志记录**: 记录所有登录尝试

### 响应格式
```json
{
  "token": "JWT_TOKEN_HERE",
  "user": {
    "_id": "user_id",
    "id": "user_id",
    "name": "用户名",
    "email": "user@example.com",
    "role": "ADMIN",
    // ... 其他用户信息
  }
}
```

### 前端处理流程
1. **保存认证信息**: 将 `token` 和 `user` 信息保存到 localStorage
2. **页面跳转**: 登录成功后自动跳转到 `/c/new`（新对话页面）
3. **用户体验**: 与标准登录流程保持一致

## 安全考虑

1. **适用场景**: 仅适用于受信任的环境（内部系统、开发环境等）
2. **建议措施**: 
   - 在生产环境中添加 IP 白名单
   - 使用 API 密钥进行额外验证
   - 定期监控登录日志
3. **邮箱唯一性**: 确保邮箱地址的唯一性和有效性

## 部署方法

### 1. 启动 docker-compose-others.yml
```bash
docker compose -f docker-compose-others.yml up
```
会启动mongodb数据库等服务

### 2. 以开发者模式启动前后端服务器
```bash
# 安装依赖
npm ci
# 启动前端服务
npm run front:dev
# 启动后端服务
npm run backend:dev
```
### 3. 以生产方式启动前后端服务器
```bash
# 安装依赖
npm ci
# 启动前端服务
npm run frontend
# 启动后端服务
npm run backend

Visit http://localhost:3080/
```
下次再启动Librechat的时候只需要使用 npm run backend 命令

## 错误处理

API 包含完整的错误处理机制：
- 400: 邮箱参数缺失，请求过期等情况
- 403: 账户过期
- 500: 服务器错误

## 兼容性

- 与现有的认证系统完全兼容
- 支持双因素认证
- 使用相同的 JWT 令牌格式
- 遵循现有的中间件链（日志、限流、封禁检查等）


## 后续改进建议

1. 添加 IP 白名单功能
2. 添加登录频率限制
3. 增加更详细的审计日志
4. 支持批量用户验证 