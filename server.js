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
// Gemini 機械臉生成（Node fetch，無需 SDK）
// ════════════════════════════════════════

// ── 六種類型對應的生成風格 Prompt ──
const BASE_PROMPT = `Transform this photo into a cinematic ROG esports pro-player illustration.
Output image only, no text.

Style: High-end 2.5D digital illustration, cinematic character render, premium esports promotional art.
Likeness: Maintain the subject's facial structure but refine features to be sharp and aesthetic.
Grooming: Stylish modern hairstyle with subtle ROG Red highlights, flawless skin, studio lighting.
Apparel: ROG Tactical Pro-Jacket with carbon-fiber textures, glowing Aura Sync red piping, ROG Fearless Eye logo as glowing chest patch.
Color palette: ROG Red, Midnight Black, Titanium Gray. Cinematic rim-lighting.
Pose: Maintain the EXACT same pose and composition as the source photo.
Background: Deep black with subtle digital grid particles.`;

const TYPE_STYLE = {
  tactical: `TYPE: TACTICAL COMMANDER.
Expression: Cold, calculating, commanding authority.
HUD: Holographic TACTICAL MATRIX with minimap grid and strategic waypoints floating around subject.
Jacket detail: Shoulder epaulettes with rank insignia, comms earpiece glowing red.
Rim light: Cold blue-white from above.
Background: Faint crosshair and chess-piece motifs in particles.`,

  speedy: `TYPE: SPEED HUNTER.
Expression: Hyper-focused, adrenaline rush, slight forward lean.
HUD: Holographic VELOCITY SCANNER with speed vectors and 144Hz FPS counter.
Jacket detail: Aerodynamic panels, motion-stripe accents, ventilation mesh glowing cyan.
Rim light: Electric cyan from the side with motion-blur streaks.
Background: Speed lines and spark trails in particles.`,

  burst: `TYPE: BURST BREAKER.
Expression: Fierce and explosive, jaw set, moment before impact.
HUD: Holographic POWER SURGE with energy bars at CRITICAL percent and damage multiplier.
Jacket detail: Heavy armor plating on shoulders, glowing red power conduits on arms.
Rim light: Intense red-orange from below.
Background: Shattered fragments and energy burst ripples in particles.`,

  sniper: `TYPE: PRECISION SNIPER.
Expression: Eerily calm, one eye narrowed, absolute stillness.
HUD: Holographic OPTICAL TARGETING with precision crosshair and heartbeat stabilizer.
Jacket detail: Lightweight tactical coat, ghillie-texture collar, optical sensor badge.
Rim light: Ice-blue single-side, deep shadow on the other side.
Background: Laser dot particles and rifle-scope ring motif.`,

  builder: `TYPE: CREATIVE BUILDER.
Expression: Confident smirk, head slightly tilted.
HUD: Holographic SYNTHESIS ENGINE with modular build-tree nodes and circuit map around hands.
Jacket detail: Modular panel attachments, purple and green wiring accents.
Rim light: Purple-green dual-side.
Background: Hexagonal nodes and blueprint line fragments assembling.`,

  futurist: `TYPE: FUTURE CONTROLLER.
Expression: Serene and visionary, eyes glowing faintly with digital teal.
HUD: Holographic AI CORE SYNC 99% with neural network visualization and data streams.
Jacket detail: Nano-material jacket with embedded LED matrix panels.
Rim light: Pure white and holographic teal, ethereal.
Background: Binary code streams and neural node connections.`,
};


async function generateCyberFace(base64Image, type = 'tactical') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY 環境變數未設定');

  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

  const prompt = BASE_PROMPT + (TYPE_STYLE[type] || TYPE_STYLE.tactical);
  console.log(`[CYBER-SCAN] type=${type}`);

  const MODEL = 'gemini-2.5-flash-image';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{
      parts: [
        { inline_data: { mime_type: 'image/jpeg', data: cleanBase64 } },
        { text: prompt },
      ]
    }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    }
  };

  console.log(`[CYBER-SCAN] 呼叫 ${MODEL}...`);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    const msg = data?.error?.message || JSON.stringify(data).slice(0, 200);
    throw new Error(`Gemini API 錯誤: ${msg}`);
  }

  const parts = data?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inline_data?.data) {
      const mime = part.inline_data.mime_type || 'image/png';
      console.log(`[CYBER-SCAN] 成功！mime=${mime}`);
      return `data:${mime};base64,${part.inline_data.data}`;
    }
  }

  const textPart = parts.find(p => p.text);
  if (textPart) throw new Error(`模型只回傳文字: ${textPart.text.slice(0, 100)}`);
  throw new Error('Gemini 未回傳圖片');
}

// ════════════════════════════════════════
// API Routes
// ════════════════════════════════════════

// ── POST /api/cyber-scan ──
// 接收用戶原始照片 → Gemini 生成機械臉 → 回傳
app.post('/api/cyber-scan', async (req, res) => {
  const { photo, type } = req.body;
  if (!photo) return res.status(400).json({ error: '缺少照片資料' });

  console.log('[CYBER-SCAN] 開始處理... type=' + (type||'tactical'));
  try {
    const cyberPhoto = await generateCyberFace(photo, type);
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
