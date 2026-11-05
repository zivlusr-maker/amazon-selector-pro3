# Ziv 亚马逊爆品选品工作台

一套面向亚马逊选品决策的七步 AI 工作台，采用深黑冷色界面，并通过 Vercel Serverless Function 安全调用 Gemini。API Key 只保存在 Vercel 服务端，不会发送到浏览器。

线上地址：<https://amazon-selector-pro3.vercel.app>

## 核心功能

1. Google Trends 趋势与季节性分析
2. 市场容量、ABA 品牌和商机探测器分析
3. 竞品格局与产品属性拆解
4. 用户画像与需求金字塔
5. 差异化机会与关键词供需比
6. 全成本财务测算
7. Go / No-Go 决策与行动建议

支持上传趋势、商机探测器、ABA、Listing、评论、BSR 等截图，AI 会优先使用上传的真实数据。

## 技术结构

- 静态前端：HTML、CSS、原生 JavaScript
- AI 接口：`/api/analyze`
- 服务端模型：Gemini
- 部署平台：Vercel

```
amazon-selector-pro3/
├── api/
│   └── analyze.js      # Vercel Serverless Function
├── css/
│   └── style.css       # 深黑冷色主题
├── js/
│   └── app.js          # 七步分析逻辑
├── index.html
└── README.md
```

## 部署

1. 在 Vercel 导入本仓库。
2. 在项目的 Production 环境变量中添加 `GeminiKey`。
3. 重新部署 Production。
4. 打开部署地址即可使用，页面内无需再填写 Key。

不要把真实 API Key 写入代码、提交到 GitHub，或放进以 `NEXT_PUBLIC_`、`VITE_` 等开头的公开环境变量。

## 本地预览

静态页面可以用任意本地 HTTP Server 预览；AI 分析接口需要通过 Vercel 本地开发环境或已部署站点调用。

## License

MIT
