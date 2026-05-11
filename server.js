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

[SYSTEM: OUTPUT IMAGE ONLY. NO TEXT.]
      You are the "ROG ELITE TEAM STYLIST." Generate a high-end "ROG Esports Pro-Player" illustration of the subject.

      Core Visual Specs:
      1. **THEME:** Power Overload, Energy Surge, Heavy Industrial. The entire collection embodies the "Burst Breaker" energy and weight.
      2. **FACE (RECOGNIZABLE & WHITE JADE TONE):** - **STRICTLY 100% RECOGNIZABLE HUMAN FACE WITH HEALTHY SKIN TONE.** - **MATERIAL:** NO realistic skin texture. Render the face with a "Polished White Jade" or "Polished Ivory Porcelain" surface. This achieves a "Ceramic-smooth," flawless, and non-porous look while providing a healthy, fair complexion.
         - **LIKENESS:** The subject's exact contours and features are preserved (looks like the person in the photo), but refined to be aesthetic (Heroic/Pro-player look). It should look solid, clean, and radiant.
      3. **APPAREL (BURST ARMOR):** Dress the subject in "Heavy ROG Battle-Chassis." Integrate visible Strix GPU fins, Ryujin braided liquid-cooling tubes with internal red glow, and reinforced carbon-fiber plating. This is heavy armor.
      4. **EFFECTS:** Scatter glowing "Melted Metal" sparks and subtle "Energy Ripples" around the silhouette.
      5. **CRITICAL:** Maintain EXACT same pose and composition for direct overlay.
      6. **COLOR:** Strictly ROG Red (#FF0000), Obsidian Black (#000000), and Titanium Gray.

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
