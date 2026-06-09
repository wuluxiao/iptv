# Cloudflare Worker IPTV 自动更新模板

这套模板使用 `Guovin/iptv-api` 自动采集、筛选、测速并生成播放列表，再用 Cloudflare Worker 提供稳定访问入口。

## 已配置内容

- GitHub Actions 每 6 小时自动更新一次，也支持手动运行。
- 自动下载最新版 `Guovin/iptv-api`，不用长期维护 fork。
- 使用 `config/subscribe.txt` 作为订阅源列表。
- 使用 `config/user_demo.txt` 控制频道菜单。
- 生成结果到 `public/result.m3u` 和 `public/result.txt`。
- Cloudflare Worker 提供 `/m3u`、`/txt`、`/updated`、`/health`。
- Worker 自带 CORS 和边缘缓存。

## 第一次使用

1. 在 GitHub 新建一个仓库，比如 `cloudflare-worker-iptv`。
2. 把这个目录里的全部文件上传到仓库。
3. 修改 `worker/wrangler.toml`：

```toml
GITHUB_USER = "你的GitHub用户名"
GITHUB_REPO = "你的仓库名"
GITHUB_BRANCH = "main"
```

4. 进入 GitHub 仓库的 `Actions`，手动运行 `Update IPTV`。
5. 等运行成功后，确认这两个文件已经被更新：

```text
public/result.m3u
public/result.txt
```

## 部署 Cloudflare Worker

在 GitHub 仓库设置 `Settings -> Secrets and variables -> Actions -> Repository secrets`，添加：

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

然后手动运行 `Deploy Worker`，或修改 `worker/**` 后自动部署。

Cloudflare API Token 建议使用 `Edit Cloudflare Workers` 权限，并限定到你的账号。

## 播放地址

部署成功后，播放器里填：

```text
https://你的Worker域名/m3u
```

备用 TXT 格式：

```text
https://你的Worker域名/txt
```

查看更新时间：

```text
https://你的Worker域名/updated
```

健康检查：

```text
https://你的Worker域名/health
```

## 调整采集源

编辑 `config/subscribe.txt`，一行一个订阅源，支持 `m3u/m3u8/txt`。

当前默认源：

```text
https://iptv-org.github.io/iptv/countries/cn.m3u
https://iptv-org.github.io/iptv/languages/zho.m3u
https://iptv-org.github.io/iptv/index.m3u
https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8
```

## 调整频道

编辑 `config/user_demo.txt`。格式示例：

```text
央视频道,#genre#
CCTV-1
CCTV-13

卫视频道,#genre#
湖南卫视
浙江卫视
```

只写频道名时，程序会从订阅源里自动匹配可用地址。

## 常用配置

编辑 `config/user_config.ini`：

- `urls_limit = 5`：每个频道最多保留 5 条线路。
- `min_resolution = 1280x720`：低于 720p 的源会被过滤。
- `min_speed = 0.3`：低于该速度的源会被过滤。
- `speed_test_limit = 5`：测速并发，太高可能不准，太低会慢。
- `open_supply = True`：结果不足时保留部分可用但未达标的源。

## 注意

Cloudflare Worker 不负责采集和测速，只负责发布生成结果。采集、过滤、测速都由 GitHub Actions 完成，这样比把所有逻辑塞进 Worker 稳定很多。

请只添加你有权使用、公开免费或明确授权的直播源，不要公开分发未经授权的内容。
