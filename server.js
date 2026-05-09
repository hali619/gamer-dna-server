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
const BASE_PROMPT = `[SYSTEM: OUTPUT IMAGE ONLY. NO TEXT.]
You are the "ROG ELITE TEAM STYLIST."
Generate a professional "ROG Esports Pro-Player" version of the subject with high aesthetic appeal.

Requirements:
1. STYLE: High-end 2.5D Digital Illustration / Cinematic Character Render. The style should be sleek, heroic, and incredibly handsome/beautiful, matching the aesthetic of premium esports promotional art.
2. SUBJECT (PRO-PLAYER LOOK):
   - LIKENESS: Maintain a stylized version of the subject's facial structure to ensure recognizability, but refine the features to be sharp, polished, and aesthetic.
   - GROOMING: Give the subject a stylish, voluminous modern hairstyle with subtle "ROG Red" highlights. The skin should be flawless with professional studio lighting.
   - APPAREL: Dress the subject in a heavy "ROG Tactical Pro-Jacket"—a high-tech team jersey featuring carbon-fiber textures, waterproof zippers, and glowing "Aura Sync" red piping.
3. COLOR PALETTE: Strictly "ROG Red," "Midnight Black," and "Titanium Gray." Use cinematic rim-lighting to define the subject's silhouette.
4. CRITICAL: Maintain the EXACT same pose, composition, and silhouette as the source image.
5. BRANDING: The ROG "Fearless Eye" Logo must be prominently featured as a high-quality embroidery or glowing patch on the tactical jacket. Background: Deep black with subtle digital grid or "Cyber-dust" particles.
6. NO TEXT RESPONSE: Return ONLY the encoded image data.`;

const TYPE_STYLE = {
  tactical: `
TYPE OVERLAY — TACTICAL COMMANDER:
- Expression: Cold, calculating, commanding authority. Eyes scanning the battlefield.
- HUD/UI: Holographic "TACTICAL MATRIX" overlay — minimap grid, strategic waypoints, unit command icons floating around the subject.
- Jacket detail: Shoulder epaulettes with rank insignia, integrated comms earpiece glowing red.
- Rim light: Cold blue-white from above, symbolizing strategic clarity.
- Particle FX: Faint chess-piece and crosshair motifs in the background dust.`,

  speedy: `
TYPE OVERLAY — SPEED HUNTER:
- Expression: Hyper-focused, adrenaline rush, slight forward lean — about to launch.
- HUD/UI: Holographic "VELOCITY SCANNER" — speed vectors, FPS counter (144Hz+), reaction-time arcs streaking past the subject.
- Jacket detail: Aerodynamic panels, motion-stripe accents on sleeves, ventilation mesh glowing cyan.
- Rim light: Electric cyan from the side, with motion-blur streaks trailing behind.
- Particle FX: Speed lines and spark trails, kinetic energy radiating outward.`,

  burst: `
TYPE OVERLAY — BURST BREAKER:
- Expression: Fierce, explosive, jaw set tight — the moment before impact.
- HUD/UI: Holographic "POWER SURGE" readout — energy charge bars at CRITICAL%, damage multiplier, burst countdown timer.
- Jacket detail: Heavy armor plating on shoulders, glowing red power conduits running down the arms.
- Rim light: Intense red-orange from below, as if absorbing energy from the ground.
- Particle FX: Shattered fragments and energy burst ripples exploding outward from the subject.`,

  sniper: `
TYPE OVERLAY — PRECISION SNIPER:
- Expression: Eerily calm, one eye slightly narrowed, absolute stillness.
- HUD/UI: Holographic "OPTICAL TARGETING v3.2" — precision crosshair overlay, wind/distance calculation data, heartbeat flatline stabilizer.
- Jacket detail: Lightweight tactical coat, ghillie-texture collar detail, optical sensor badge on chest.
- Rim light: Ice-blue single-side rim light, cold and surgical, deep shadow on the other side.
- Particle FX: Laser dot particles, subtle rifle-scope ring motif in the background.`,

  builder: `
TYPE OVERLAY — CREATIVE BUILDER:
- Expression: Confident smirk, head slightly tilted — always three steps ahead.
- HUD/UI: Holographic "SYNTHESIS ENGINE" — modular build-tree nodes, circuit connection map, innovation matrix grid floating around hands.
- Jacket detail: Jacket with modular panel attachments, colorful wiring accents (purple/green), interchangeable badge slots.
- Rim light: Purple-green dual-side rim light, creative and dynamic.
- Particle FX: Geometric shapes, hexagonal nodes, and blueprint line fragments assembling in the background.`,

  futurist: `
TYPE OVERLAY — FUTURE CONTROLLER:
- Expression: Serene and visionary, eyes glowing faintly with a digital teal hue — already seeing tomorrow.
- HUD/UI: Holographic "AI CORE SYNC 99%" — neural network visualization, data stream flows, adaptive algorithm patterns radiating from the subject.
- Jacket detail: Smooth nano-material jacket with embedded LED matrix panels, AI-pattern woven into the fabric.
- Rim light: Pure white and holographic teal, ethereal and otherworldly.
- Particle FX: Binary code streams, neural node connections, and soft holographic light particles.`,
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
        { text: prompt },
        { inline_data: { mime_type: 'image/jpeg', data: cleanBase64 } },
      ]
    }],
    generationConfig: {
      responseModalities: ['IMAGE', 'TEXT'],
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
