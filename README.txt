STUDYSPACE (Cloudflare Worker + static assets)
1. In wrangler.jsonc: set "name" to your Worker's exact name, and paste your D1 database ID (Cloudflare > D1 > studyspace > copy Database ID).
2. Upload everything to your GitHub repo (replace old files). Cloudflare redeploys.
3. Worker > Settings > Variables and Secrets > add secrets PEPPER and ADMIN_KEY (40+ random characters each). Deploy again.
4. Site = your .workers.dev address. Admin = /admin.html
