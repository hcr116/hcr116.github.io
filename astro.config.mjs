import { defineConfig } from 'astro/config';

// 部署到 GitHub Pages 时用你的用户名地址；
// 以后换成自己的域名（如 https://huang.com），改下面这一行即可。
export default defineConfig({
  site: 'https://hcr116.github.io',
  build: {
    format: 'directory',
  },
});
