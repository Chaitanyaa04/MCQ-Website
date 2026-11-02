STUDYSPACE - SETUP (old ITT conversion skipped; sample questions included in data/)
1. Upload this whole folder to a new GitHub repo.
2. Cloudflare dashboard > Workers & Pages > Create > Pages > Connect to Git > pick the repo. Build command: none. Output directory: /
3. Cloudflare > Storage & Databases > D1 > Create "studyspace" > Console > paste schema.sql > Execute.
4. Pages project > Settings > Bindings > Add D1 > variable name DB > pick studyspace.
5. Pages project > Settings > Variables and Secrets > add secrets PEPPER and ADMIN_KEY (long random text each, e.g. 40+ characters).
6. Deployments > Retry/redeploy so the settings apply. Open your .pages.dev address. Admin: /admin.html
