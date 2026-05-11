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

// ════════════════════════════════════════
// ROG「爆發重裝 + 藝術人臉」視覺定義 (Aesthetic-Balance)
// ════════════════════════════════════════

// 1. BASE_PROMPT: 定義藝術臉孔與 Burst重裝。
const BASE_PROMPT = `[SYSTEM: OUTPUT IMAGE ONLY. NO TEXT.]
You are the "ROG ELITE TEAM STYLIST." Generate a high-end "ROG Esports Pro-Player" illustration of the subject.

Core Visual Specs:
1. **THEME:** Power Overload, Energy Surge, Heavy Industrial. The entire collection embodies the "Burst Breaker" energy and weight.
2. **FACE (ARTISTIC & RECOGNIZABLE):** - **MUST BE 100% RECOGNIZABLE HUMAN FACE.** - **MATERIAL:** NO realistic skin texture. Render the face as a "Polished Black Porcelain" surface, achieving a "Ceramic-smooth" and flawless look. It must look solid, clean, and handsome/beautiful.
   - **LIKENESS:** The subject's exact contours and features are preserved, but in a refined, non-photorealistic finish. Think of a premium digital statue.
3. **APPAREL (BURST ARMOR):** Dress the subject in "Heavy ROG Battle-Chassis." Integrate visible Strix GPU fins, Ryujin braided liquid-cooling tubes with internal red glow, and reinforced carbon-fiber plating. This is heavy armor.
4. **EFFECTS:** Add intense energy particles and subtle "Melted Metal" effects at the edges of the armor plates.
5. **CRITICAL:** Maintain EXACT same pose and composition for direct overlay.
6. **COLOR:** Strictly ROG Red (#FF0000), Obsidian Black (#000000), and Titanium Gray.`;

// 2. TYPE_STYLE: 在「爆發裝甲」下，六種角色的職能演繹。
const TYPE_STYLE = {
  // 戰術指揮：重裝爆發+矩陣資訊
  tactical: `TYPE: TACTICAL COMMANDER.
Expression: Cold, authoritative gaze.
HUD: Massive Holographic "TACTICAL MATRIX" flashing RED with minimap grids.
Rim Light: Pulsating white-hot from above.`,

  // 速度獵手：重裝爆發+速度動態
  speedy: `TYPE: SPEED HUNTER.
Expression: Focused, single-side lighting.
HUD: Holographic "VELOCITY SCANNER" with speed vectors and blurred "240Hz" text.
Visual: Forward motion streaks in Electric Orange.
Rim light: Electric cyan accents.`,

  // 原生爆發：重裝爆發+核心過載 (原本 Burst 風格)
  burst: `TYPE: ORIGINAL BURST-BREAKER.
Expression: Fierce, explosive expression.
HUD: Holographic "POWER SURGE" energy bars at 100% CRITICAL.
Detail: Heatsinks Ventilating Heat (Steam). Internal conduit glow on chest and arms.
Rim Light: Intense Lava-Orange from below.`,

  // 精準狙擊：重裝爆發+靜態鎖定
  sniper: `TYPE: PRECISION SNIPER.
Expression: Eerily calm, one eye in deep shadow.
HUD: A single, intense ROG-RED laser-dot projected onto the eye; precision OPTICAL TARGETING crosshair.
Visual: Extreme high-contrast; vent steam vents from chest armor.
Rim Light: Ice-blue single-side highlight.`,

  // 創造建築師：重裝爆發+模組化拼貼
  builder: `TYPE: CREATIVE BUILDER.
Expression: Confident smirk.
HUD: Holographic "SYNTHESIS ENGINE" build-nodes and modular build-tree.
Visual: ROG components (fans, heatsinks) are seen ASSEMBLING around arms and torso.
Rim Light: Purple-green energy accents.`,

  // 未來控制：重裝爆發+數據全息
  futurist: `TYPE: FUTURE OVERSEER.
Expression: Serene and visionary gaze.
HUD: Holographic "AI CORE SYNC 99%" with neural network visualization and data streams.
Visual: Dissolving into subtle "Cyber-Dust" at the edges.
Rim Light: Ethereal Teal and White halo.`,
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

setInterval(() => {
  const now = Date.now();
  for (const [id, data] of store.entries()) {
    if (now > data.expireAt) store.delete(id);
  }
}, 3600000);

app.listen(PORT, () => {
  console.log(`✅ ROG Gamer DNA Server running on port ${PORT}`);
});
