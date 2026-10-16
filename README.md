# CoordCalc — coordcalc.com

免费的中英双语测绘 / 坐标计算器站点。英文 34 个页面（工具 + 教程）、中文 35 个页面，
全部为纯静态 HTML，无框架、无构建步骤、无外部 CDN 依赖，所有计算在浏览器本地完成。

仓库根目录**就是部署产物本身**，可以直接当作 Cloudflare Pages 的静态资源目录。

```
/                    英文首页
/<name>              英文工具页与教程页（33 个）
/zh/                 中文首页
/zh/<name>           中文对应页面（34 个）
/404                 英文自定义 404（Cloudflare 按目录就近查找；/zh/404 同理）
/assets/             article.css、consent.js、track.js、图标、OG 图、webmanifest
/robots.txt          屏蔽 /assets/consent.js 与 /assets/track.js，声明 sitemap 位置
/sitemap.xml         67 条 URL
/_headers            Cloudflare Pages 响应头（安全头）
/_redirects          Cloudflare Pages 跳转规则
```

> 磁盘上的文件仍然叫 `x.html`（Cloudflare 要求如此），但**对外地址不带扩展名**——
> 详见下面「URL 形式」一节。
>
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

## URL 形式（已定：无扩展名）

Cloudflare Pages 默认使用 `auto-trailing-slash` 的 HTML 处理策略，官方行为是：

| 磁盘上的文件 | 请求 | 响应 |
|---|---|---|
| `dms-converter.html` | `GET /dms-converter` | **200**，直接返回该文件 |
| `dms-converter.html` | `GET /dms-converter.html` | 307 → `/dms-converter` |
| `index.html` | `GET /` | **200** |
| `index.html` | `GET /index.html` | 307 → `/` |
| `zh/index.html` | `GET /zh/` | **200** |
| `zh/index.html` | `GET /zh` | 307 → `/zh/` |

也就是说，**平台认可的规范形式是「不带扩展名」**：普通页 `/x`（无尾斜杠）、
目录首页 `/` 与 `/zh/`（有尾斜杠）。

本仓库已按这个形式统一：站内链接、`<link rel="canonical">`、`hreflang` 三元组、
`og:url`、JSON-LD 的 `url` / `@id`、`sitemap.xml` **全部**写成无扩展名地址。
三者（链接目标 / canonical / 实际服务的地址）完全一致，**没有任何一跳**。

另一条路是反过来把 `.html` 当规范形式（Workers 静态资源 + `html_handling: "none"`），
但那个模式只做精确匹配，`/` 和 `/zh/` 都不再自动指向 `index.html`，需要另补代理规则，
配置更绕，因此不采用。

### 两条守卫规则

`index.html` 位于根目录和 `zh/` 下，它的无扩展名形式会变成 `/index` 和 `/zh/index`——
一个能把首页再提供一遍的地址。站内没有任何链接指向它们，但搜索引擎可能自己推出来，
所以 `_redirects` 里把两者 301 到真正的首页。这两条规则一定生效：Pages 会先执行
`_redirects`，再匹配静态资源（官方原文：“Redirects are always followed, regardless of
whether or not an asset matches the incoming request”）。

### 上线后如何验证

```bash
curl -sI https://coordcalc.com/dms-converter | head -1        # 200（规范形式）
curl -sI https://coordcalc.com/dms-converter.html | head -1   # 307 → /dms-converter
curl -sI https://coordcalc.com/ | head -1                     # 200
curl -sI https://coordcalc.com/zh/ | head -1                  # 200
curl -sI https://coordcalc.com/zh | head -1                   # 307 → /zh/
curl -sI https://coordcalc.com/index | head -1                # 301 → /
curl -sI https://coordcalc.com/sitemap.xml | head -1          # 200，且其中不含带 .html 的 URL
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
- [ ] **确认无多余跳转**：按上一节的 `curl` 清单过一遍，Search Console 的「网页」报告里
      不应出现「已提交的网址含有重定向」。

---

## 本地预览

因为对外地址不带扩展名，**普通的 `python -m http.server` 不再够用**——它不理解
「`/dms-converter` → `dms-converter.html`」的映射，站内每个链接都会 404。
两个可用的方式：

```bash
# 方式一：与线上行为完全一致（推荐）
npx wrangler pages dev .

# 方式二：不起依赖，用本地工作区里的等价实现
python <本地工作区>/.workbuddy/scratch/preview.py --port 8080
```

`preview.py` 复刻了 Pages 的 `auto-trailing-slash` 与就近查找 `404.html` 的行为，
并会读取 `_redirects` 里的静态规则，因此 `/index` → `/` 这类规则也能在本地验证。

用 `file://` 直接打开页面同样不可行：无扩展名链接在本地文件系统上无对应文件。

---

## 维护说明

- 仓库里放的是**成品页面**，生成与校验脚本保留在本地工作区（`.workbuddy/scratch/`），
  没有纳入仓库（脚本里写死了本机绝对路径）。
- 中文页面由 `build_zh_*.py` 依据对应的英文页面生成，**不要直接手改**中文页——
  改完英文页后重新生成，否则下次重建会被覆盖。唯一例外是英文 `404.html`：
  它是中文 404 页的源文件，改动后需同步重建 `zh/404.html`。
- 品牌名与域名的批量替换脚本是 `rebrand.py`；若要换域名，改 `PAIRS` 后跑一次即可。
- 把 `.html` 链接改成无扩展名形式的脚本是 `extensionless.py`（幂等，可重复运行）。
- `preview.py`（本地预览）、`crawl_links.py`（内链全量探活）、`url_matrix.py`
  （逐页校验规范地址与 `.html` 跳转）是本地验证工具，不参与部署。
