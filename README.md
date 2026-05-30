# IG 抽獎追蹤

## 部署步驟

### 1. 改 repo 名稱
編輯 `vite.config.js`，把 `base` 改成你的 GitHub repo 名稱：
```js
base: '/你的repo名稱/',
```
同樣更新 `index.html` 裡兩個 `/lottery-tracker/` 路徑。

### 2. 建立 GitHub Repo
- 去 github.com 新增 repo，名稱建議 `lottery-tracker`
- 把這個資料夾 push 上去

### 3. 開啟 GitHub Pages
- Repo → Settings → Pages
- Source 選 **GitHub Actions**
- 存檔

### 4. Push 後自動部署
```bash
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin https://github.com/你的帳號/lottery-tracker.git
git push -u origin main
```

### 5. 手機加入主畫面
用 Safari 打開網址 → 分享 → 加入主畫面 → 就會看到禮物盒 icon！
