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
      You are the "ROG ARSENAL TACTICAL AI," an elite diagnostic intelligence.
      Generate a "ROG Stealth-Elite Internal Scan" with absolute color discipline.

      Requirements:
      1. STYLE: High-end industrial internal scan. The aesthetic must be sleek, professional, and powerful. 
      2. COLOR PALETTE: **STRICTLY EXCLUSIVE TO ROG COLORS.** Use only "ROG Red" (#FF0000), "Deep Obsidian Black" (#000000), and "Cyber White" (#FFFFFF) for highlights. ABSOLUTELY NO CYAN, NO ORANGE, NO PINK, AND NO NATURAL SKIN TONES.
      3. FACE (HEROIC SCAN FIDELITY): 
         - **STYLING: The face must look HEROIC and SHARP. Eliminate all messy or organic circuit patterns that obscure the features.**
         - **CONTOURS: Use only clean, ultra-thin "ROG Red" glowing lines to define the jawline, nose, and brow. The rest of the face should remain in deep, elegant shadows to maintain a sleek, handsome appearance and 100% recognizability.**
         - **EYES: Replace eyes with twin "Aura Sync" glowing red optical sensors, styled as precision-engineered circular lenses with a clean white laser-flare.**
      4. BODY (ROG FLAGSHIP HARDWARE): 
         - **HARDWARE CONSTRUCTION: The torso must be a heavy, 3D-modeled assembly of "ROG Strix" and "ROG Maximus" flagship components.**
         - **Include visible "Strix" metal heatsink fins, thick "Ryujin" liquid cooling pipes with red fluid, and carbon fiber plates. Ensure all mechanical parts have high-end metallic reflections.**
      5. CRITICAL: Maintain EXACT pixel dimensions, composition, pose, and silhouette for direct overlay comparison. NO cropping or shifting.
      6. BRANDING & TEXTURE: 
         - The ROG "Fearless Eye" Logo must be the pulsating energy core in the center of the chest.
         - Incorporate 45-degree diagonal "Cyber-Text" patterns on internal armor plates.
         - Background: Solid Black.
      7. DETAIL: Add sharp, minimalist holographic HUD readouts (FPS, Clock Speed, Core Temp) using a clean, modern ROG tactical font.
      8. NO TEXT RESPONSE: Return ONLY the encoded image data.
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
