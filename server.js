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
// ROG 全系列「爆發破局者」視覺定義 (Avant-Garde Style)
// ════════════════════════════════════════

// 1. BASE_PROMPT: 定義核心視覺底色：重裝、熔岩、不寫實人臉
const BASE_PROMPT = `[SYSTEM: OUTPUT IMAGE ONLY. NO TEXT.]
You are the "ROG AVANT-GARDE ART DIRECTOR."

Generate a high-end, cinematic character render that is an artistic, NON-REALISTIC interpretation of the subject.

Core Visual Identity (Burst Breaker DNA):
1. **THEME:** Power Surge, Explosion Moment, Heavy Industrial. The entire collection must embody the Burst Breaker energy.
2. **FACE (DECONSTRUCTED & ARTISTIC):** - **NO REALISTIC SKIN. DO NOT follow the exact expression of the photo.** - **MATERIAL:** The face should be a deconstructed digital sculpture made of "Tinted Translucent Obsidian Glass."
   - **Likeness:** Maintain the *facade* of the subject's contours but render it using organic, sprawling "ROG Red" micro-circuits that act like "neural blood vessels," defining the facial features (eyes, nose, mouth) through glowing lines. It must look like a high-precision, non-human tactical facade.
   - **Under-lighting:** Dramatic upward-lighting from the chest core, making the face look heroic yet ominous.
3. **BODY (HEAVY HARDWARE):** Constructed from heavy, realistic "ROG Strix" and "Ryujin" components. Visible heatsink fins, liquid cooling pipes with thick red coolant, and carbon fiber armor plates.
4. **EFFECTS:** Scatter particles of "Melted Metal," "Ashes," and glowing "Energy Ripples" around the subject.
5. **CRITICAL:** Maintain EXACT same pose and composition for direct overlay.

COLOR PALETTE: STRICTLY **ROG Red** (#FF0000), **Melted Orange/Lava**, **Deep Void Black** (#000000), and **Titanium Gray**.`;

// 2. TYPE_STYLE: 在「爆發視覺」下，六種角色的職能演繹
const TYPE_STYLE = {
  // 爆發+指揮：資訊爆炸、戰術矩陣過載
  tactical: `ROLE: BURST COMMANDER.
HUD: A massive, complex holographic "TACTICAL MATRIX" that is FLASHING RED with "OVERLOAD" warnings, showing minimap grids.
Visual: The commands are literally exploding from the HUD.
Rim Light: Pulsating red-orange.`,

  // 爆發+速度：電馭粉火花、 FPS過載
  speedy: `ROLE: VOLTAGE SPEED HUNTER.
Expression: Focused, single-side lighting. HUD: "VELOCITY SCANNER" with speed vectors and "1440Hz / OVERCLOCK" counter.
Visual: Forward motion streaks made of electric-orange and ROG-red light, looking like the subject is breaking the sound barrier.
Effects: The speed lines cause digital "glitch" artifacts.`,

  // 核心爆發：原本的 Burst風格，能量全開
  burst: `ROLE: Burst Breaker (ORIGINAL).
HUD: Holographic "POWER SURGE" energy bars at 100% CRITICAL.
Visual: The arms and torso are literally ON FIRE with internal red-orange power conduits. Major parts of the hardware look like they are beginning to MELT.
Rim Light: Intense, blinding lava-orange from below.`,

  // 爆發+精準：雷射鎖定、極限溫控
  sniper: `ROLE: PRECISION BURST-SNIPER.
HUD: A single, thin, intense ROG-RED laser-dot projected onto the deconstructed facade of the eye. Extreme-precision "OPTICAL TARGETING" crosshair.
Visual: Most of the subject is in deep shadow. A single, super-thin beam of red light pierces the darkness. The armor plates around the chest are venting steam, simulating a stable heartbeat.`,

  // 爆發+創造：模組化建築、電路過載
  builder: `ROLE: VOLTAGE BUILDER.
Expression: Slight smirk, confidently integrated. HUD: Holographic "SYNTHESIS ENGINE" with multiple build-nodes.
Visual: Multiple ROG hardware components (fans, heatsinks) are seen ASSEMBLING around the subject, radiating heat.
Detail: The wiring accents (originally purple/green) are now "HEAT-ORANGE" to fit the burst theme.`,

  // 爆發+未來：數位投影、二進位過載
  futurist: `ROLE: FUTURE CONTROLLER.
Expression: Visionary. Faces facade has more "point cloud" texture. HUD: Holographic "AI CORE SYNC 99%" with collapsing neural network visualization.
Visual: The subject is enveloped in an ethereal mist mixed with "Cyber-dust." Data streams (0 and 1) are exploding around the body. The eyes glow with an intense, non-human Teal/Red hybrid light.`,
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
