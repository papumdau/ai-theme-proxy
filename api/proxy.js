export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { mode, apiKey, model, prompt, size, aspectRatio, imageBase64, secret } = req.body || {};

    const expectedSecret = process.env.PROXY_SECRET;
    if (expectedSecret) {
      if (secret !== expectedSecret) {
        return res.status(401).json({ error: 'Sai mat khau tram (secret khong khop)' });
      }
    }

    const finalKey = apiKey || (mode === 'gemini' ? process.env.GEMINI_API_KEY : process.env.OPENAI_API_KEY);
    if (!finalKey) return res.status(400).json({ error: 'Thieu apiKey (chua nhap trong tool, va chua dat trong Vercel Environment Variables)' });

    if (mode === 'gemini') {
      const parts = [];
      if (imageBase64) {
        parts.push({ inlineData: { mimeType: 'image/png', data: imageBase64 } });
        parts.push({ text: 'Dua vao anh goc phia tren, thiet ke lai theo mo ta sau, giu dung bo cuc/y tuong cot loi cua anh goc: ' + prompt });
      } else {
        parts.push({ text: prompt });
      }
      const geminiModel = model || 'gemini-3.1-flash-image';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${encodeURIComponent(finalKey)}`;
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { imageConfig: { aspectRatio } } }),
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    if (mode === 'openai') {
      if (imageBase64) {
        const bytes = Buffer.from(imageBase64, 'base64');
        const blob = new Blob([bytes], { type: 'image/png' });
        const form = new FormData();
        form.append('model', model || 'gpt-image-2');
        form.append('prompt', prompt);
        form.append('size', size || '1024x1024');
        form.append('n', '1');
        form.append('image', blob, 'reference.png');
        const r = await fetch('https://api.openai.com/v1/images/edits', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + finalKey },
          body: form,
        });
        const data = await r.json();
        return res.status(r.status).json(data);
      } else {
        const r = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + finalKey },
          body: JSON.stringify({ model: model || 'gpt-image-2', prompt, size: size || '1024x1024', n: 1 }),
        });
        const data = await r.json();
        return res.status(r.status).json(data);
      }
    }

    return res.status(400).json({ error: 'mode khong hop le (can gemini hoac openai)' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
