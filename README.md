# Who Pay - 团队活动费用分摊小程序

## 项目说明

这是一个用于团队活动费用分摊的微信小程序，支持三个固定团队（A、B、C组）的费用均摊计算。

## 项目结构

```
Who-Pay/
├── app.js                 # 小程序入口文件
├── app.json              # 小程序配置文件
├── app.wxss              # 全局样式文件
├── project.config.json   # 项目配置文件
├── sitemap.json         # 站点地图配置
├── pages/               # 页面目录
│   ├── login/           # 登录页
│   ├── activity/        # 活动相关页面
│   │   ├── index.js     # 活动首页
│   │   └── detail.js    # 活动详情页
│   ├── payment/         # 支付记录管理页
│   ├── user/            # 个人中心页
│   └── history/         # 历史活动页面
│       ├── list.js      # 历史活动列表
│       └── detail.js    # 历史活动详情（只读）
├── utils/               # 工具函数目录
│   ├── cloud.js         # API调用封装
│   └── util.js         # 通用工具函数
└── images/              # 图片资源目录
```

## 功能特性

1. **用户系统**
   - 微信手机号快捷登录
   - 个人信息管理（昵称、头像）

2. **活动管理**
   - 创建活动（生成6位邀请码）
   - 通过邀请码加入活动
   - 选择团队加入（A/B/C组，每组最多3人）
   - 活动详情查看
   - 结束活动（仅创建人）

3. **支付记录**
   - 添加支付记录（金额、备注）
   - 编辑/删除自己的支付记录
   - 查看成员支付记录明细
   - 实时计算总花费和团队均摊

4. **历史活动**
   - 查看已结束的活动列表
   - 查看历史活动详情（只读模式）

## 使用前准备

### 1. 配置小程序AppID

在 `project.config.json` 中已配置AppID：`wxc03c44d931b13fa3`

### 2. 准备图片资源

从 [iconfont项目](https://www.iconfont.cn/manage/index?manage_type=myprojects&projectId=5085209) 下载图标：

1. 访问 iconfont 项目页面
2. 选择合适的图标下载（PNG格式，81x81px用于Tab图标，160x160px用于Logo）
3. 将图标重命名并放置到 `images` 目录：
   - `logo.png` - 登录页Logo
   - `default-avatar.png` - 默认头像
   - `home.png` / `home-active.png` - 活动Tab图标
   - `user.png` / `user-active.png` - 我的Tab图标

详细说明请查看 `images/README.md`

### 3. API接口配置

项目已配置API基础域名为：`https://www.pluto0.com`

所有API接口路径：
- `POST /api/login` - 登录
- `POST /api/activity/create` - 创建活动
- `POST /api/activity/join` - 加入活动
- `POST /api/activity/selectTeam` - 选择团队
- `GET /api/activity/{activityId}` - 获取活动详情
- `POST /api/activity/{activityId}/end` - 结束活动
- `GET /api/activity/list?status={status}` - 获取活动列表
- `POST /api/payment/add` - 添加支付记录
- `PUT /api/payment/{paymentId}` - 更新支付记录
- `DELETE /api/payment/{paymentId}` - 删除支付记录
- `GET /api/payment/list?activityId={activityId}` - 获取支付记录列表
- `GET /api/payment/member?activityId={activityId}&userId={userId}` - 获取成员支付记录
- `POST /api/user/update` - 更新用户信息
- `GET /api/user/info` - 获取用户信息
- `POST /api/upload/avatar` - 上传头像

## 在微信开发者工具中运行

### 1. 打开项目

1. 打开微信开发者工具
2. 选择"导入项目"
3. 选择项目目录：`D:\myProject\Who-Pay`
4. AppID已配置：`wxc03c44d931b13fa3`
5. 点击"导入"

### 2. 配置域名白名单

在微信开发者工具中：
1. 点击右上角"详情"
2. 选择"本地设置"
3. 勾选"不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书"
   - 开发阶段可以勾选此项跳过域名校验
   - 正式发布前需要在微信公众平台配置服务器域名

### 3. 配置服务器域名（正式发布前）

在微信公众平台：
1. 登录小程序后台
2. 进入"开发" -> "开发管理" -> "开发设置"
3. 在"服务器域名"中添加：
   - request合法域名：`https://www.pluto0.com`
   - uploadFile合法域名：`https://www.pluto0.com`
   - downloadFile合法域名：`https://www.pluto0.com`

## 项目格式说明

本项目**完全符合微信小程序标准格式**：

✅ **标准目录结构**
- `app.js`、`app.json`、`app.wxss` - 小程序入口文件
- `pages/` - 页面目录，每个页面包含 `.js`、`.json`、`.wxml`、`.wxss` 四个文件
- `utils/` - 工具函数目录
- `images/` - 图片资源目录

✅ **使用CommonJS模块系统**
- 所有 `import` 已改为 `require`
- 所有 `export` 已改为 `module.exports`

✅ **API调用方式**
- 使用 `wx.request` 进行HTTP请求
- 不再依赖云开发环境

## 注意事项

1. **代码格式**：项目已完全符合微信小程序标准格式，可以直接在微信开发者工具中运行
2. **API接口**：确保后端API接口已部署并正常运行
3. **图片资源**：必须准备所有必需的图片文件，否则Tab栏和登录页可能显示异常
4. **域名配置**：开发阶段可以跳过域名校验，正式发布前必须配置服务器域名
5. **金额计算**：保留两位小数，团队均摊 = 总花费 ÷ 3

## 开发说明

- 使用微信小程序原生框架开发
- 使用HTTP API进行后端交互
- 遵循微信小程序设计规范
- 代码使用CommonJS模块系统（require/module.exports）
