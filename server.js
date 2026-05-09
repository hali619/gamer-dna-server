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
You are the "ROG ARSENAL TACTICAL AI." 
      Generate a high-precision "ROG Cyber-Mechanical Internal Scan" of the provided image.

      Requirements:
      1. STYLE: The output must look like a futuristic X-ray scan or a high-tech internal diagnostic. Use a "layered" visual approach: a semi-translucent, dark-tinted outer silhouette revealing a complex internal mechanical structure. 
      2. COLOR PALETTE: Dominated by "ROG Red" glowing pulses and "Cyber Pink" data traces, set against a deep "Charcoal Black" and "Graphite Gray" mechanical base. Use high-contrast lighting to highlight metallic edges.
      3. SUBJECT (MECHANICAL DEPTH): 
         - Reveal the "Skeleton" of the subject: Replace internal anatomy with intricate metallic frameworks, high-speed cooling fans, liquid cooling pipes, and dense bundles of fiber-optic cables.
         - Ensure a high level of "Mechanical Density": Show layers of micro-chips, gears, and hydraulic pistons that fit perfectly within the original silhouette.
      4. CRITICAL: The output MUST maintain the EXACT same pixel dimensions, composition, pose, and silhouette as the source image for a direct overlay. Do not crop, zoom, or shift.
      5. BRANDING & TEXTURE: 
         - Integrate the ROG "Fearless Eye" Logo as a glowing, internal energy core or a laser-etched component within the structure.
         - Background must be Solid Black. 
         - Use ROG-inspired 45-degree diagonal ventilation patterns and "Digital Totem" textures on the internal plates.
      6. DETAIL: Add floating holographic UI elements, grid lines, and performance data readouts (FPS, Temp, Clock Speed) integrated into the mechanical structure to enhance the "Diagnostic" feel.
      7. NO TEXT RESPONSE: Return ONLY the encoded image data.
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
