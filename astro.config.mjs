import { defineConfig } from 'astro/config';

// 部署到 EdgeOne Pages / Cloudflare Pages / GitHub Pages 时，
// 把 site 改成你的正式域名，有助于生成正确的 canonical 与 sitemap。
export default defineConfig({
  site: 'https://your-site.edgeone.app',
  build: {
    format: 'directory',
  },
});
