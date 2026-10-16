# CoordCalc — coordcalc.com

免费的中英双语测绘 / 坐标计算器站点。英文 34 个页面（工具 + 教程）、中文 35 个页面，
全部为纯静态 HTML，无框架、无构建步骤、无外部 CDN 依赖，所有计算在浏览器本地完成。

仓库根目录**就是部署产物本身**，可以直接当作 Cloudflare Pages 的静态资源目录。

```
/                    英文首页
/<tool>.html         英文工具页与教程页（33 个）
/zh/<tool>.html      中文对应页面（35 个）
/404.html            英文自定义 404（Cloudflare 会按目录就近查找，/zh/404.html 同理）
/assets/             article.css、consent.js、track.js、图标、OG 图、webmanifest
/robots.txt          屏蔽 /assets/consent.js 与 /assets/track.js，声明 sitemap 位置
/sitemap.xml         67 条 URL
/_headers            Cloudflare Pages 响应头（安全头）
/_redirects          Cloudflare Pages 跳转规则
```

> `_headers` 和 `_redirects` 是 Cloudflare 的约定文件，不会被当成静态资源对外提供。

---

## 部署到 Cloudflare Pages

1. 登录 Cloudflare → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**。
2. 授权并选择仓库 `tumu123/coordcalc.com`，分支 `main`。
3. 构建设置：
   - **Framework preset**：`None`
   - **Build command**：留空
   - **Build output directory**：`/`
4. **Save and Deploy**。首次部署约 1 分钟，完成后会拿到一个
   `https://<项目名>.pages.dev` 地址，可以先在这里验收。
5. 之后每次 `git push` 到 `main`，Pages 会自动重新部署。

### 自定义域名

在 Pages 项目的 **Custom domains** 里依次添加 `coordcalc.com` 和 `www.coordcalc.com`
（域名需已托管在同一个 Cloudflare 账号下，添加时 Cloudflare 会自动写入 DNS 记录）。

`www` → 主域的跳转**不能写在 `_redirects` 里**（Cloudflare Pages 不支持域名级规则，
写了会被静默忽略）。请到域名所在区域用 Redirect Rule 做：

> Cloudflare → `coordcalc.com` → **Rules** → **Redirect Rules** → Create rule
> - When incoming requests match：`Hostname equals www.coordcalc.com`
> - Then：Dynamic redirect → `https://coordcalc.com/${http.request.uri.path}`，状态码 `301`

---

## ⚠️ 上线前需要决定的一件事：`.html` 地址会被跳转

Cloudflare（Pages 与 Workers 静态资源行为一致）会**把 `.html` 地址重定向到无扩展名地址**，
官方文档原话是 “Pages will also redirect HTML pages to their extension-less counterparts:
for instance, `/contact.html` will be redirected to `/contact`”。

而本站目前所有的 canonical、hreflang、`og:url`、`sitemap.xml` 和站内链接**都写成 `.html` 形式**，
两者是冲突的。当前的实际效果是：

| 请求 | 结果 |
|---|---|
| `GET /dms-converter.html` | 307 → `/dms-converter` |
| `GET /dms-converter` | 200，返回 `dms-converter.html` 的内容 |
| `GET /index.html` | 跳转到 `/` |
| `GET /zh/index.html` | 跳转到 `/zh/` |

也就是说站点能正常访问，但每个 `.html` 链接多一跳，且 canonical 指向的是一个会跳转的地址。
搜索引擎一般能自己收敛（canonical、sitemap、hreflang 三者一致，都指向 `.html`），
但这属于“本可以避免的信号噪音”，上 Search Console 后大概率会看到
「Sitemap 包含重定向网址」之类的提示。

**三种处理方式，我建议选 B：**

**A. 保持现状** — 什么都不用改，站点可用，只是多一跳 + 上述提示。适合“先上线看看”。

**B. 把无扩展名地址作为规范形式（推荐）** — 文件仍叫 `x.html`（Cloudflare 会为
`/x` 提供它，返回 200），但站内链接与 canonical / hreflang / `og:url` / sitemap
统一改成 `https://coordcalc.com/x`。这样链接、canonical、实际服务的地址三者完全一致，
没有任何跳转。代价是要改 69 个页面里的内链和全部回归测试。

**C. 不用 Pages，改用 Workers 静态资源 + `html_handling: "none"`** — 能保住 `.html` 形式，
但该模式只做精确匹配，`/` 和 `/zh/` 都不再自动指向 `index.html`，需要再补代理规则，
配置更绕、更容易踩坑。除非你有别的理由必须用 Workers，否则不建议。

### 上线后如何验证

```bash
curl -sI https://coordcalc.com/dms-converter.html | head -1   # 看是否 307
curl -sI https://coordcalc.com/dms-converter      | head -1   # 应为 200
curl -sI https://coordcalc.com/                   | head -1   # 应为 200
```

---

## 上线后的检查清单

- [ ] **Search Console**：添加 `coordcalc.com` 资源（DNS 验证），提交 `https://coordcalc.com/sitemap.xml`。
- [ ] **统计**：`assets/track.js` 里的 `provider` 与 `id` 目前是空的（默认不发送任何数据）。
      推荐 Cloudflare Web Analytics（免费、无 cookie，与现有的同意横幅最契合），
      填好后同意横幅会自动放行。
- [ ] **HSTS**：Cloudflare → SSL/TLS → Edge Certificates → 打开 HSTS。不要写在 `_headers` 里，
      以免影响账号下其他子域。
- [ ] **`www` 跳转**：按上文 Redirect Rule 配好，并确认 `https://www.coordcalc.com/x` → `https://coordcalc.com/x`。
- [ ] **确认 `.html` 地址策略**：按上一节决定是 A 还是 B。

---

## 本地预览

站点是纯静态的，用任意静态服务器起在仓库根目录即可：

```bash
python -m http.server 8080
# 或 npx serve .
```

注意：用 `file://` 直接打开会被浏览器的同源策略挡住一部分能力（`fetch`、部分剪贴板 API），
请用上面的方式起本地服务。`/404.html` 依赖 `<base href="/">`，只有在服务器根目录访问时行为才正确。

---

## 维护说明

- 仓库里放的是**成品页面**，生成与校验脚本保留在本地工作区（`.workbuddy/scratch/`），
  没有纳入仓库（脚本里写死了本机绝对路径）。
- 中文页面由 `build_zh_*.py` 依据对应的英文页面生成，**不要直接手改**中文页——
  改完英文页后重新生成，否则下次重建会被覆盖。唯一例外是英文 `404.html`：
  它是中文 404 页的源文件，改动后需同步重建 `zh/404.html`。
- 品牌名与域名的批量替换脚本是 `rebrand.py`；若要换域名，改 `PAIRS` 后跑一次即可。
