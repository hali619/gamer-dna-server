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
// Gemini 機械臉生成
// ════════════════════════════════════════
const { GoogleGenAI } = require('@google/genai');

async function generateCyberFace(base64Image) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY 環境變數未設定');

  const ai = new GoogleGenAI({ apiKey });

  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

  const prompt = `
[SYSTEM: OUTPUT IMAGE ONLY. NO TEXT.]
      You are the "ROG ARSENAL TACTICAL AI," an elite combat system diagnostic intelligence.
      Generate an aggressive, "ROG Tactical Armor Internal Scan" version of the provided image.

      Requirements:
      1. STYLE: The output must look like a fusion of an armored exosuit schematic and a powerful cybernetic war-machine blueprint. Use the signature ROG color palette: deep "ROG Red" for active systems, accented with "Cyber Pink" for data lines, set against a dark "Armored Black" background. Emphasize asymmetric, sharp, and aggressive lines inspired by ROG’s iconic design language (45-degree slashes).
      2. SUBJECT: If the subject is a person, replace all flesh with reinforced mechanical exoskeletons, powerful hydraulic servos, and intricate armor plating. Show heavy cybernetic augmentations. If it's an object, reveal its dense internal core, power conduits, and complex armored shell, transforming it into a piece of high-performance ROG-branded gear.
      3. CRITICAL: The output MUST maintain the EXACT same pixel dimensions, composition, pose, and silhouette as the source image. This is for a direct overlay comparison. Do not crop, zoom, or shift the subject.
      4. BACKGROUND: Solid deep "Armored Black."
      5. DETAIL & BRANDING:
         - Integrate the stylized ROG "Fearless Eye" Logo directly onto the subject’s armor or core.
         - **Ensure the stylized 'ROG' letters (Republic of Gamers) are visible and integrated into the structure, perhaps as part of the armored chest plating, on a major joint, or a prominent section of the internal hardware, in the iconic ROG angular font.**
         - Replace standard technical annotations with stylized ROG "Digital Totem" text and encryption patterns.
         - Add glowing data readouts that look like "Battle-Ready" performance diagnostics.
      6. NO TEXT RESPONSE: Do not provide any textual description, confirmation, or status updates. Return ONLY the encoded image data.
    `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { text: prompt },
        { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
      ],
    },
  });

  if (response.candidates && response.candidates.length > 0) {
    const parts = response.candidates[0].content.parts;
    for (const part of parts) {
      if (part.inlineData && part.inlineData.data) {
        const mime = part.inlineData.mimeType || 'image/png';
        console.log(`[CYBER-SCAN] 成功！mime=${mime}`);
        return `data:${mime};base64,${part.inlineData.data}`;
      }
    }
    const textPart = parts.find(p => p.text);
    if (textPart) throw new Error(`模型回傳文字: ${textPart.text.substring(0, 100)}`);
  }
  throw new Error('Gemini 未回傳圖片');
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
