const express = require('express');
const cors    = require('cors');
const { v4: uuidv4 } = require('uuid');
const path    = require('path');
const { GoogleGenAI } = require('@google/genai');

const app  = express();
const PORT = process.env.PORT || 3000;
const store = new Map();

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.static('public'));

// ── 每日人數上限 ──
const DAILY_LIMIT = parseInt(process.env.DAILY_LIMIT || '500');
let dailyCount = 0;
let dailyDate  = new Date().toDateString();

// ── 類型統計 ──
const TYPE_KEYS = ['tactical','speedy','burst','sniper','builder','futurist','support'];
let typeStats = {};
TYPE_KEYS.forEach(t => typeStats[t] = 0);
let totalGenerated = 0;

function checkAndCount() {
  const today = new Date().toDateString();
  if (today !== dailyDate) {
    dailyDate  = today;
    dailyCount = 0;
    TYPE_KEYS.forEach(t => typeStats[t] = 0);
    totalGenerated = 0;
    console.log('[QUOTA] 新的一天，計數重置');
  }
  if (dailyCount >= DAILY_LIMIT) return false;
  dailyCount++;
  console.log(`[QUOTA] 今日第 ${dailyCount} / ${DAILY_LIMIT} 人`);
  return true;
}

const BASE_PROMPT = `[SYSTEM: OUTPUT IMAGE ONLY. NO TEXT.]
You are the "ROG ELITE TEAM STYLIST." Generate a high-end "ROG Esports Pro-Player" illustration of the subject.

Requirements:
1. STYLE: High-end 2.5D digital illustration, cinematic character render, premium esports promotional art. NOT photorealistic — use stylized illustration strokes while keeping the subject recognizable.
2. LIKENESS: Capture the subject's key facial features (face shape, eyes, nose, mouth) in a stylized, heroic way. The result should look like a polished anime/game-art version of the person — clearly the same person but elevated and idealized.
3. APPAREL: Dress the subject in a heavy "ROG Tactical Pro-Jacket" with carbon-fiber textures, glowing Aura Sync red piping, and the ROG logo as a glowing patch on the chest.
4. COLOR: Strictly use ROG Brand Colors: ROG Red (#FF0000), Midnight Black (#000000), and Titanium Gray.
5. LIGHTING: Strong orange-red rim light from below — dramatic, cinematic, like a forge or battle glow beneath the subject. This is the signature light for all types.
6. CRITICAL: Maintain the EXACT same pose and silhouette as the source photo for direct overlay.
7. BACKGROUND: Solid deep black with subtle digital grid or ROG "Cyber-dust" particles.`;

const TYPE_STYLE = {
  tactical: `TYPE: TACTICAL COMMANDER. Expression: Cold, focused, commanding — the calm before the storm. HUD: Holographic tactical matrix and minimap grid floating around subject. Secondary light: Cold blue-white fill from above to contrast the orange-red below.`,
  speedy:   `TYPE: SPEED HUNTER. Expression: Hyper-focused, sharp eyes, adrenaline rush — about to launch. HUD: Velocity scanner with speed vectors and 144Hz FPS counter. Effects: Electric cyan motion-blur light streaks trailing behind. Secondary light: Electric cyan accent from the side.`,
  burst:    `TYPE: BURST BREAKER. Expression: Fierce, jaw set, explosive energy barely contained. HUD: Power surge energy bars at CRITICAL percent, damage multiplier readout. Detail: Heavy shoulder armor plates glowing at the edges. The orange-red rim light is most intense for this type — almost volcanic.`,
  sniper:   `TYPE: PRECISION SNIPER. Expression: Eerily calm, one eye slightly narrowed, absolute stillness and patience. HUD: Optical targeting crosshair overlay with wind and distance data. Detail: Tactical collar/hood framing the face. Secondary light: Ice-blue cold fill from one side, deep shadow on the other.`,
  builder:  `TYPE: CREATIVE BUILDER. Expression: Confident smirk, head slightly tilted — always thinking three steps ahead. HUD: Synthesis engine node map and circuit connections floating around the hands. Detail: Modular jacket panels with interchangeable components. Secondary light: Purple-green dual accent.`,
  futurist: `TYPE: FUTURE CONTROLLER. Expression: Serene and visionary, eyes with a faint digital teal glow — seeing what others cannot. HUD: AI Core Sync neural network visualization, data stream flows at 99%. Detail: Nano-material jacket with embedded LED matrix. Secondary light: Holographic teal from above.`,
  support:  `TYPE: SUPPORT GUARDIAN. Expression: Warm, calm, and reassuring — the steady presence that holds the team together. HUD: Team status overlay showing ally HP bars, buff timers, and shield icons surrounding the subject. Detail: ROG jacket with glowing support-module badges, medical cross emblem on the shoulder. Secondary light: Soft warm gold from above, protective and nurturing aura.`,
};

// ════════════════════════════════════════
// Gemini SDK 呼叫
// ════════════════════════════════════════

async function generateCyberFace(base64Image, type = 'tactical') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY 未設定');

  const ai = new GoogleGenAI({ apiKey });
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
  const prompt = BASE_PROMPT + '\n\n' + (TYPE_STYLE[type] || TYPE_STYLE.tactical);

  console.log(`[ROG-GEN] 生成類型: ${type}`);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
        ],
      },
    ],
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
      temperature: 0.8,
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT',       threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ],
    },
  });

  const parts = response.candidates?.[0]?.content?.parts || [];
  const reason = response.candidates?.[0]?.finishReason;
  console.log(`[ROG-GEN] finishReason=${reason} parts=[${parts.map(p => p.inlineData ? 'IMAGE' : 'TEXT').join(',')}]`);

  for (const part of parts) {
    if (part.inlineData?.data) {
      const mime = part.inlineData.mimeType || 'image/png';
      console.log(`[ROG-GEN] 成功！mime=${mime}`);
      return `data:${mime};base64,${part.inlineData.data}`;
    }
  }

  if (reason === 'SAFETY') throw new Error('內容被安全過濾器攔截，請換一張照片。');
  const textPart = parts.find(p => p.text);
  if (textPart) throw new Error(`模型只回傳文字(${reason}): ${textPart.text.slice(0, 150)}`);
  throw new Error(`未回傳圖片 finishReason=${reason}`);
}

// ════════════════════════════════════════
// API 路由
// ════════════════════════════════════════

app.post('/api/cyber-scan', async (req, res) => {
  const { photo, type } = req.body;
  if (!photo) return res.status(400).json({ error: '缺少照片資料' });

  if (!checkAndCount()) {
    return res.status(429).json({ error: 'DAILY_LIMIT_REACHED' });
  }

  const finalType = TYPE_STYLE[type] ? type : 'tactical';
  const MAX_RETRY = 3;
  let lastErr = null;

  for (let i = 0; i < MAX_RETRY; i++) {
    try {
      if (i > 0) {
        console.log(`[ROG-GEN] 重試第 ${i} 次...`);
        await new Promise(r => setTimeout(r, 2000 * i));
      }
      const cyberPhoto = await generateCyberFace(photo, finalType);
      typeStats[finalType] = (typeStats[finalType] || 0) + 1;
      totalGenerated++;
      return res.json({ cyberPhoto });
    } catch (err) {
      lastErr = err;
      const isRetryable = err.message && (err.message.includes('503') || err.message.includes('500') || err.message.includes('INTERNAL') || err.message.includes('UNAVAILABLE'));
      console.error(`[SERVER ERROR] 第${i+1}次: ${err.message}`);
      if (!isRetryable) break;
    }
  }

  dailyCount = Math.max(0, dailyCount - 1);
  console.error('[SERVER ERROR] 最終失敗，退回配額');
  res.status(500).json({ error: lastErr?.message || '生成失敗' });
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

app.get('/api/quota', (req, res) => {
  const today = new Date().toDateString();
  if (today !== dailyDate) { dailyDate = today; dailyCount = 0; }
  const remaining = DAILY_LIMIT - dailyCount;
  res.json({
    limit: DAILY_LIMIT,
    used: dailyCount,
    remaining,
    full: remaining <= 0,
  });
});

app.get('/api/stats', (req, res) => {
  const today = new Date().toDateString();
  if (today !== dailyDate) { dailyDate = today; dailyCount = 0; TYPE_KEYS.forEach(t => typeStats[t] = 0); totalGenerated = 0; }
  res.json({
    total: totalGenerated,
    types: { ...typeStats },
  });
});

app.get('/result/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'result.html'));
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', count: store.size });
});

setInterval(() => {
  const now = Date.now();
  for (const [id, data] of store.entries()) {
    if (now > data.expireAt) store.delete(id);
  }
}, 3600000);

app.listen(PORT, () => {
  console.log(`✅ ROG Gamer DNA Server running on port ${PORT}`);
});
