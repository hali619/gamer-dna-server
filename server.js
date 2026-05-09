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
      Generate a high-precision "ROG Cyber-Mechanical Internal Scan" with a focus on "Translucent Biometrics."

      Requirements:
      1. STYLE: Futuristic X-ray diagnostic scan. Use a "layered" visual approach with a semi-translucent silhouette.
      2. COLOR PALETTE: Signature "ROG Red" pulses and "Cyber Pink" data traces on a "Charcoal Black" base.
      3. SUBJECT (FACE & BIOMETRICS): 
         - **CRITICAL: The face must remain recognizable. Treat the skin as a "Semi-translucent Flexible PCB."**
         - **Overlay delicate, hair-thin micro-circuitry and glowing golden/red data pathways over the facial contours without obscuring features.**
         - **Eyes should be depicted as glowing optical sensors or "Aura Sync" RGB lenses, but maintaining the original gaze and expression.**
      4. SUBJECT (BODY/MECHANICAL): 
         - Beneath the translucent surface, reveal an intricate framework of metallic bones, cooling pipes, and fiber-optic cables.
         - Show high-speed cooling fans or heatsink fins integrated into the torso or limbs.
      5. CRITICAL: Maintain EXACT pixel dimensions, composition, pose, and silhouette. NO cropping or shifting.
      6. BRANDING: 
         - Integrate the ROG "Fearless Eye" Logo as a glowing internal energy core (e.g., in the chest or a major component).
         - Background: Solid Black.
         - Incorporate ROG's 45-degree diagonal slash patterns into the mechanical plates.
      7. DETAIL: Add floating "Battle-Ready" holographic UI elements and diagnostic data (Temp, System Load, Neural Link status).
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
