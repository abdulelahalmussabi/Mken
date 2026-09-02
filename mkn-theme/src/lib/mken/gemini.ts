const GEMINI_TEXT_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

const GEMINI_IMAGE_MODELS = [
  "gemini-3.1-flash-image",
  "gemini-2.0-flash-preview-image-generation",
] as const;

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY غير معيّن على الخادم");
  return key;
}

export async function generateGeminiText(promptText: string): Promise<string> {
  const response = await fetch(GEMINI_TEXT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey(),
    },
    body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] }),
  });
  if (!response.ok) throw new Error("فشل طلب Gemini");
  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("تعذّر قراءة رد Gemini");
  return text;
}

export type GeminiInlineImage = { mimeType: string; data: string };

function readInlineImage(data: {
  candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } }>;
}): GeminiInlineImage | null {
  const parts = data.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const mime = part.inlineData?.mimeType || "";
    const raw = part.inlineData?.data || "";
    if (mime.startsWith("image/") && raw.length > 80) return { mimeType: mime, data: raw };
  }
  return null;
}

export async function generateGeminiImage(input: {
  prompt: string;
  logo?: GeminiInlineImage | null;
}): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;

  const parts: Array<Record<string, unknown>> = [{ text: input.prompt }];
  if (input.logo?.data && input.logo.mimeType.startsWith("image/")) {
    parts.unshift({
      inline_data: { mime_type: input.logo.mimeType, data: input.logo.data },
    });
  }

  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: { aspectRatio: "1:1" },
    },
  });

  for (const model of GEMINI_IMAGE_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body,
        }
      );
      if (!response.ok) continue;
      const image = readInlineImage((await response.json()) as Parameters<typeof readInlineImage>[0]);
      if (!image) continue;
      return `data:${image.mimeType};base64,${image.data}`;
    } catch {
      continue;
    }
  }
  return null;
}
