# Gamer DNA Lab — 後端伺服器

## 部署到 Zeabur

### 步驟 1：上傳到 GitHub
1. 在 GitHub 建立新 repo（名稱例如 `gamer-dna-server`）
2. 把這個資料夾的所有檔案上傳進去

### 步驟 2：在 Zeabur 部署
1. 登入 https://zeabur.com
2. 點「New Project」→「Deploy from GitHub」
3. 選擇你的 repo
4. Zeabur 會自動偵測 Node.js 並部署
5. 部署完成後你會得到一個網址，例如：
   `https://gamer-dna-server.zeabur.app`

### 步驟 3：設定環境變數
在 Zeabur 控制台 → Variables 加入：
```
BASE_URL=https://你的網址.zeabur.app
```

### 步驟 4：更新展場 HTML
在 `gamer_dna_fixed.html` 裡找到：
```javascript
const API_URL = 'http://localhost:3000';
```
改成：
```javascript
const API_URL = 'https://你的網址.zeabur.app';
```

---

## API 說明

### POST /api/save
儲存結果，回傳分享 URL

Request body:
```json
{
  "photo": "data:image/jpeg;base64,...",
  "type": "tactical",
  "typeName": "戰術指揮者",
  "tags": ["#策略", "#掌控", "#全局意識"],
  "desc": "你天生具備...",
  "scores": {
    "tactical": 32,
    "speedy": 18,
    "burst": 15,
    "sniper": 22,
    "builder": 10,
    "futurist": 12
  }
}
```

Response:
```json
{
  "id": "a3f9c2b1",
  "url": "https://你的網址.zeabur.app/result/a3f9c2b1"
}
```

### GET /api/result/:id
取得結果資料（result.html 用這個）

### GET /result/:id
分享頁面（用戶掃 QR Code 打開的就是這個）

---

## 注意事項
- 結果資料保存 7 天後自動刪除
- 照片以 base64 存在記憶體，重啟伺服器會清空
- 如需永久保存，之後可以接 Supabase 或 Cloudflare R2
