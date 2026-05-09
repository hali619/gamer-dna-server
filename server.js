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
// ROG 電競風格定義
// ════════════════════════════════════════

const BASE_PROMPT = `[SYSTEM: OUTPUT IMAGE ONLY. NO TEXT.]
You are the "ROG ELITE TEAM STYLIST." Generate a high-end "ROG Esports Pro-Player" illustration of the subject.

Requirements:
1. STYLE: High-end 2.5D digital illustration, cinematic character render, premium esports promotional art.
2. LIKENESS: Maintain 100% facial structure of the subject in the photo. Refine features to be sharp, polished, and aesthetic (Heroic/Pro-player look).
3. APPAREL: Dress the subject in a heavy "ROG Tactical Pro-Jacket" with carbon-fiber textures, glowing Aura Sync red piping, and the ROG logo as a glowing patch.
4. COLOR: Strictly use ROG Brand Colors: ROG Red (#FF0000), Midnight Black (#000000), and Titanium Gray.
5. CRITICAL: Maintain the EXACT same pose and silhouette as the source photo for direct overlay.
6. BACKGROUND: Solid deep black with subtle digital grid or ROG "Cyber-dust" particles.`;

const TYPE_STYLE = {
  tactical: `TYPE: TACTICAL COMMANDER. Expression: Cold and commanding. HUD: Holographic tactical matrix and minimap. Rim light: Cold white.`,
  speedy:   `TYPE: SPEED HUNTER. Expression: Hyper-focused. HUD: Velocity scanner and FPS counter. Effects: Motion-blur light streaks. Rim light: Electric cyan.`,
  burst:    `TYPE: BURST BREAKER. Expression: Fierce. HUD: Power surge energy bars. Detail: Heavy armor plates. Rim light: Intense orange-red from below.`,
  sniper:   `TYPE: PRECISION SNIPER. Expression: Calm and steady. HUD: Optical targeting crosshair. Detail: Tactical hood/collar. Rim light: Ice-blue.`,
  builder:  `TYPE: CREATIVE BUILDER. Expression: Confident smirk. HUD: Synthesis engine nodes and circuit maps. Detail: Modular gear. Rim light: Purple-green accents.`,
  futurist: `TYPE: FUTURE CONTROLLER. Expression: Visionary, glowing eyes. HUD: AI Core Sync neural network. Detail: LED matrix jacket. Rim light: Teal/White.`,
};

// ════════════════════════════════════════
// Gemini API 呼叫函數
// ════════════════════════════════════════

async function generateCyberFace(base64Image, type = 'tactical') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY 未設定');

  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
  const prompt = BASE_PROMPT + '\n\n' + (TYPE_STYLE[type] || TYPE_STYLE.tactical);

  const MODEL = 'gemini-2.5-flash-image';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: 'image/jpeg', data: cleanBase64 } },
      ]
    }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      temperature: 0.8,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH',        threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',  threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT',  threshold: 'BLOCK_NONE' },
    ]
  };

  console.log(`[ROG-GEN] 生成類型: ${type}`);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Gemini API 錯誤: ${data.error?.message || JSON.stringify(data).slice(0, 200)}`);
  }

  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts || [];

  console.log(`[ROG-GEN] finishReason=${candidate?.finishReason} parts=[${parts.map(p => p.inline_data ? 'IMAGE' : 'TEXT').join(',')}]`);

  const imagePart = parts.find(p => p.inline_data?.data);
  if (imagePart) {
    const mime = imagePart.inline_data.mime_type || 'image/png';
    console.log(`[ROG-GEN] 成功！mime=${mime}`);
    return `data:${mime};base64,${imagePart.inline_data.data}`;
  }

  if (candidate?.finishReason === 'SAFETY') {
    throw new Error('內容被安全過濾器攔截，請換一張照片。');
  }

  const textPart = parts.find(p => p.text);
  if (textPart) throw new Error(`模型只回傳文字: ${textPart.text.slice(0, 100)}`);
  throw new Error(`未回傳圖片 finishReason=${candidate?.finishReason}`);
}

// ════════════════════════════════════════
// API 路由
// ════════════════════════════════════════

app.post('/api/cyber-scan', async (req, res) => {
  const { photo, type } = req.body;
  if (!photo) return res.status(400).json({ error: '缺少照片資料' });

  const finalType = TYPE_STYLE[type] ? type : 'tactical';

  try {
    const cyberPhoto = await generateCyberFace(photo, finalType);
    res.json({ cyberPhoto });
  } catch (err) {
    console.error('[SERVER ERROR]:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/save', (req, res) => {
  const { photo, type, typeName, tags, desc, scores } = req.body;
  const id = uuidv4().split('-')[0];
  const expireAt = Date.now() + 1000 * 60 * 60 * 24 * 3;

  store.set(id, { id, photo, type, typeName, tags, desc, scores, createdAt: Date.now(), expireAt });

  const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
  console.log(`[SAVE] id=${id} type=${type} hasPhoto=${!!photo}`);
  res.json({ id, url: `${baseUrl}/result/${id}` });
});

app.get('/api/result/:id', (req, res) => {
  const data = store.get(req.params.id);
  if (!data) return res.status(404).json({ error: '找不到結果' });
  res.json(data);
});

app.get('/result/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'result.html'));
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', count: store.size });
});

// 每小時清理過期資料
setInterval(() => {
  const now = Date.now();
  for (const [id, data] of store.entries()) {
    if (now > data.expireAt) store.delete(id);
  }
}, 3600000);

app.listen(PORT, () => {
  console.log(`✅ ROG Gamer DNA Server running on port ${PORT}`);
});
