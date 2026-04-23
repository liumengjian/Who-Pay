# Who Pay

多人团队活动下的记账与费用均摊参考工具（微信小程序）。活动内可拆为多支团队，按团队汇总支付、计算相对均摊差额，适合聚餐、团建、社团活动等场景。

---

## 技术栈

- 微信小程序原生（`Page` / `wx.request` / 可选 **微信云托管 `callContainer`**）
- [ColorUI](colorui/) 组件与样式
- 后端 API：配套仓库 **Who-Pay-Server**（Node/Koa + MySQL），通过 `service/config.js` 配置地址或云托管参数

---

## 项目结构

```
Who-Pay/
├── app.js / app.json / app.wxss
├── service/
│   ├── config.js          # API 基址、云托管开关、环境 ID、服务名
│   └── request.js         # 统一请求（Bearer Token；可切换 callContainer）
├── utils/
│   ├── cloud.js           # 业务 API 封装
│   └── util.js            # 工具函数
├── colorui/               # ColorUI
├── pages/
│   ├── login/             # 账号注册 / 登录
│   ├── activity/
│   │   ├── index          # 活动大厅 + 我的活动 + 创建活动
│   │   └── detail         # 活动详情：团队、支付、邀请码、创建者编辑活动等
│   ├── payment/
│   │   ├── manage         # 当前活动下「我的」支付记录（增删改）
│   │   └── history        # 历史支付流水（支持按活动筛选，前端筛选）
│   ├── user/
│   │   └── profile        # 我的：资料、历史活动入口、支付流水入口
│   └── history/
│       ├── list           # 已结束活动列表
│       └── detail         # 历史活动详情（只读）
└── images/
```

---

## 功能概览

| 模块 | 说明 |
|------|------|
| 账号 | 注册 / 登录（用户名密码）；本地 `token`、`userInfo` 持久化 |
| 活动大厅 | 浏览进行中活动；搜索；创建者卡片展示活动邀请码；已加入则直达详情 |
| 我的活动 | 进行中活动列表；创建者展示邀请码与金额汇总；参与者展示团队与成员 |
| 活动详情 | 活动/团队 **6 位邀请码**；创建团队 / 加入团队；**仅创建者**可编辑活动信息、结束活动；团队创建者可改团队名、解散团队 |
| 支付 | 在已加入的团队内添加支付；查看成员支付明细；活动维度「我的支付」管理页；**历史支付流水**与按活动筛选 |
| 历史 | 已结束活动列表与只读详情 |

业务规则以后端为准（例如：同一活动内用户通常仅处于一个团队；创建者默认参与活动但需加入团队后方可记账等）。

---

## 配置说明

### `service/config.js`

| 变量 | 含义 |
|------|------|
| `USE_CLOUD_CONTAINER` | `true` 时使用 `wx.cloud.callContainer` 访问云托管服务（需在小程序侧开通云开发并配置环境） |
| `CLOUD_ENV` | 云开发环境 ID |
| `CLOUD_SERVICE` | 云托管服务名（与控制台一致） |
| `API_BASE_URL` | 关闭云托管或未使用 `callContainer` 时的 HTTPS 根地址 |

### 小程序后台

- **request 合法域名**：若不用云托管直连，需将 `API_BASE_URL` 域名加入白名单。
- 使用 **云托管** 时，按微信文档配置云开发与环境；真机调试注意服务是否已发布。

### `project.config.json`

填写你的小程序 **AppID**；本地开发可在开发者工具中勾选「不校验合法域名」。

---

## 本地运行

1. 使用 **微信开发者工具** 打开本项目根目录。
2. 确保后端 **Who-Pay-Server** 已部署且与 `config.js` 一致。
3. 编译预览；首次使用需注册账号并登录。

---

## 接口约定（摘要）

客户端通过 `utils/cloud.js` 调用，统一携带 `Authorization: Bearer <token>`（`admin` 测试账号除外）。

常见路径包括（完整列表以 `cloud.js` 与后端 `routes` 为准）：

- `POST /api/auth/register`、`POST /api/auth/login`
- `GET /api/activity/hall`、`GET /api/activity/list`、`GET /api/activity/:id`、`PUT /api/activity/:id`
- `POST /api/activity/create`、`POST /api/activity/join`、`POST /api/activity/:id/end`
- `POST /api/team/create`、`PUT /api/team/:id`、`POST /api/team/join`、`POST /api/team/:id/dissolve`
- `POST /api/payment/add`、`GET /api/payment/list`、`GET /api/payment/history`、`GET /api/payment/member`
- `PUT /api/user/update`

---

## 开发说明

- 模块使用 **CommonJS**（`require` / `module.exports`）。
- 弹层内 **`input` / `textarea`**：关闭弹窗建议使用 **`wx:if` 卸载节点**，避免 iOS 上原生输入层占位/内容穿透。
- UI 细节见各页 `wxss`；全局与 ColorUI 变量见 `app.wxss`、`colorui/main.wxss`。

---

## 许可证

按项目主仓库约定（若未指定则以内部项目为准）。
