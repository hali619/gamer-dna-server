const express = require('express');
const cors    = require('cors');
const { v4: uuidv4 } = require('uuid');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;
const store = new Map();

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.static('public'));


// ════════════════════════════════════════
// Gemini 機械臉生成（直接呼叫 REST API，不依賴 SDK 版本）
// ════════════════════════════════════════

async function generateCyberFace(base64Image) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY 環境變數未設定');

  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

  const prompt = `You are an advanced cybernetic diagnostic AI.
Transform this photo into a high-tech cybernetic X-ray scan illustration.
Style: futuristic blueprint with glowing cyan and orange lines on solid black background.
Show robotic skeleton, cybernetic implants, circuitry beneath the skin.
Maintain the same pose and silhouette as the original photo.
Add technical annotation labels and grid overlay.
Output image only, no text explanation.`;

  // 依序嘗試可用的 model
  const models = [
    'gemini-2.0-flash-exp',
    'gemini-2.0-flash-preview-image-generation',
    'gemini-2.5-flash-preview-05-20',
  ];

  let lastError = null;

  for (const model of models) {
    try {
      console.log(`[CYBER-SCAN] 嘗試 model: ${model}`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const body = {
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: 'image/jpeg', data: cleanBase64 } },
          ]
        }],
        generationConfig: {
          responseModalities: ['IMAGE', 'TEXT'],
        }
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data?.error?.message || JSON.stringify(data);
        console.warn(`[CYBER-SCAN] ${model} 失敗: ${msg}`);
        lastError = new Error(msg);
        continue;
      }

      const parts = data?.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inline_data?.data) {
          const mime = part.inline_data.mime_type || 'image/png';
          console.log(`[CYBER-SCAN] 成功！model=${model} mime=${mime}`);
          return `data:${mime};base64,${part.inline_data.data}`;
        }
      }

      const textPart = parts.find(p => p.text);
      console.warn(`[CYBER-SCAN] ${model} 只回傳文字: ${textPart?.text?.slice(0,100)}`);
      lastError = new Error('模型只回傳文字，未生成圖片');

    } catch (err) {
      console.warn(`[CYBER-SCAN] ${model} 例外: ${err.message}`);
      lastError = err;
    }
  }

  throw lastError || new Error('所有 Gemini model 均失敗');
}


// ════════════════════════════════════════
// API Routes
// ════════════════════════════════════════

// ── POST /api/cyber-scan ──
// 接收用戶原始照片 → Gemini 生成機械臉 → 回傳
app.post('/api/cyber-scan', async (req, res) => {
  const { photo } = req.body;
  if (!photo) return res.status(400).json({ error: '缺少照片資料' });

  console.log('[CYBER-SCAN] 開始處理...');
  try {
    const cyberPhoto = await generateCyberFace(photo);
    console.log('[CYBER-SCAN] 生成成功');
    res.json({ cyberPhoto });
  } catch (err) {
    console.error('[CYBER-SCAN] 失敗:', err.message);
    res.status(500).json({ error: err.message });
  }
});


// ── POST /api/save ──
// 儲存完整結果（含機械臉）→ 回傳分享 URL
app.post('/api/save', (req, res) => {
  const { photo, type, typeName, tags, desc, scores } = req.body;
  if (!type || !typeName) return res.status(400).json({ error: '缺少基因類型資料' });

  const id = uuidv4().split('-')[0];
  const expireAt = Date.now() + 1000 * 60 * 60 * 24 * 3; // 3天

  store.set(id, { id, photo: photo || null, type, typeName, tags: tags || [], desc: desc || '', scores: scores || {}, createdAt: Date.now(), expireAt });

  const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
  const url = `${baseUrl}/result/${id}`;
  console.log(`[SAVE] id=${id} type=${type} hasPhoto=${!!photo}`);
  res.json({ id, url });
});


// ── GET /api/result/:id ──
app.get('/api/result/:id', (req, res) => {
  const data = store.get(req.params.id);
  if (!data) return res.status(404).json({ error: '找不到此結果，可能已過期' });
  if (Date.now() > data.expireAt) { store.delete(req.params.id); return res.status(410).json({ error: '此結果已過期' }); }
  res.json(data);
});


// ── GET /result/:id → 分享頁 ──
app.get('/result/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'result.html'));
});


// ── GET /health ──
app.get('/health', (req, res) => res.json({ status: 'ok', count: store.size }));


// 定期清理
setInterval(() => {
  const now = Date.now();
  for (const [id, data] of store.entries()) {
    if (now > data.expireAt) store.delete(id);
  }
}, 1000 * 60 * 60);


app.listen(PORT, () => {
  console.log(`✅ Gamer DNA Server running on port ${PORT}`);
});
