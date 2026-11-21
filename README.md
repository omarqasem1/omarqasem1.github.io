# www.omarqasem.com

Omar Qasem's academic homepage. It's plain HTML for GitHub Pages, so there's no build step and nothing to install.

## Files

| File | What it is |
|---|---|
| `index.html` | Home page. Search for `EDIT:` to find what still needs filling in. |
| `publications.html` | Full publication list. Instructions for adding a paper are inside the file. |
| `news.html` | News page, grouped by year. Instructions for adding an item are inside the file. |
| `teaching.html` | Full course list. |
| `style.css` | Shared look for both pages. Colors are in the `:root` block at the top. |
| `CNAME` | Tells GitHub your domain: `www.omarqasem.com`. Leave as is. |
| `images/photo.jpg` | Your portrait (add it). The "OQ" initials show until you do. |
| `cv.pdf` | Your public CV (personal details removed). Replace it with a new file of the same name to update. |

## 1. Publish on GitHub Pages

1. Create a GitHub account if you don't have one.
2. Create a new **public** repository named `USERNAME.github.io`, where USERNAME is your GitHub username.
3. Click **Add file → Upload files**. Upload `index.html`, `publications.html`, `style.css`, `CNAME`, `README.md`, and later `cv.pdf` and the `images` folder. Commit.
4. Open **Settings → Pages**. Under *Build and deployment*, choose **Deploy from a branch**, then branch **main** and folder **/ (root)**. Save.
5. Under **Custom domain**, enter `www.omarqasem.com` and save.

## 2. Point omarqasem.com at GitHub

Log in to the company where you bought the domain, open its **DNS settings**, and add:

| Type | Name / Host | Value |
|---|---|---|
| CNAME | www | USERNAME.github.io |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |

- The **CNAME** record makes `www.omarqasem.com` load your site.
- The four **A** records make plain `omarqasem.com` redirect to `www.omarqasem.com`.
- Delete any existing A or CNAME records on `@` or `www` that point elsewhere, such as the registrar's parking page.

DNS changes can take anywhere from a few minutes to 24 hours. Once GitHub shows the domain as verified, tick **Enforce HTTPS** in Settings → Pages.

## Updating later

Open a file on GitHub, click the pencil icon, edit, and commit. The live site updates within a minute or two.
