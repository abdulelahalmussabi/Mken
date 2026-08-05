// Temporary diagnostic — will be deleted after
module.exports = async function handler(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'no key' });
  
  const models = [
    'gemini-2.5-flash', 'gemini-2.5-flash-preview-05-20', 'gemini-2.5-flash-preview',
    'gemini-2.0-flash', 'gemini-2.0-flash-001', 'gemini-2.0-flash-exp',
    'gemini-flash-latest', 'gemini-1.5-flash', 'gemini-1.5-flash-latest',
    'gemini-2.5-pro', 'gemini-2.0-pro', 'gemini-1.5-pro',
    'gemma-3-27b-it', 'gemma-3n-e4b-it'
  ];
  
  const results = [];
  const body = { contents: [{ parts: [{ text: 'قل مرحبا' }] }] };
  
  for (const model of models) {
    try {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      let txt = ''; try { txt = (await r.json()).candidates[0].content.parts[0].text.slice(0,30); } catch(e) {}
      results.push({ model, status: r.status, sample: txt });
    } catch (e) {
      results.push({ model, status: 'ERR', sample: e.message.slice(0,50) });
    }
  }
  return res.status(200).json({ results });
};
