import express from "express";
import axios from "axios";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import sharp from "sharp";

dotenv.config();

const app = express();
app.use(express.json({ limit: '20mb' }));

// CORS and Privacy Headers
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Content-Security-Policy", "frame-ancestors *");

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
});

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const proxyRequest = async (req: express.Request, res: express.Response, targetPath: string) => {
  const targetUrl = `http://aibigtree.com${targetPath}`;
  try {
    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: req.body,
      headers: { 'Content-Type': 'application/json' }
    });
    res.status(response.status).json(response.data);
  } catch (error: any) {
    console.error(`Proxy error for ${targetPath}:`, error.message);
    res.status(error.response?.status || 500).json(error.response?.data || { error: "代理转发失败" });
  }
};

// Tool routes
app.post("/api/tool/launch", (req, res) => proxyRequest(req, res, "/api/tool/launch"));
app.post("/api/tool/verify", (req, res) => proxyRequest(req, res, "/api/tool/verify"));
app.post("/api/tool/consume", (req, res) => proxyRequest(req, res, "/api/tool/consume"));
app.post("/api/upload/save-result", (req, res) => proxyRequest(req, res, "/api/upload/save-result"));
app.post("/api/upload/direct-token", (req, res) => proxyRequest(req, res, "/api/upload/direct-token"));
app.post("/api/upload/commit", (req, res) => proxyRequest(req, res, "/api/upload/commit"));
app.get("/api/upload/image", (req, res) => proxyRequest(req, res, "/api/upload/image"));
app.delete("/api/upload/image", (req, res) => proxyRequest(req, res, "/api/upload/image"));

// Dedicated Generation Endpoint (V4 3-Step BEST PRACTICE: Tool Backend Handles Integration)
app.post("/api/generate-knife", async (req, res) => {
  const { 
    userId, 
    toolId, 
    title, 
    description, 
    originalImage, 
    stylePrompt, 
    aspectRatio, 
    resolution,
    idempotencyKey 
  } = req.body;

  try {
    // 1. Verify integral via SaaS
    const verifyRes = await axios.post("http://aibigtree.com/api/tool/verify", { userId, toolId });
    if (!verifyRes.data.success) {
      return res.status(403).json(verifyRes.data);
    }

    // 2. Generate Image via Gemini
    const geminiResponse = await (genAI as any).models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: originalImage.split(",")[1] || originalImage } },
            { text: stylePrompt }
          ]
        }
      ],
      config: {
        imageConfig: { aspectRatio, imageSize: resolution }
      }
    });

    let base64Image = "";
    for (const part of geminiResponse.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        base64Image = part.inlineData.data;
        break;
      }
    }

    if (!base64Image) {
      throw new Error("AI did not return image data");
    }

    // 3. Process image server-side (Add Text Overlay)
    const imageBuffer = Buffer.from(base64Image, 'base64');
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width || 1024;
    const height = metadata.height || 1024;

    const titleFontSize = Math.floor(width * 0.065);
    const descFontSize = Math.floor(width * 0.028);
    const padding = width * 0.05;

    // Split text into lines
    const titleLines = title.split("\n").map((l: string) => l.trim()).filter((l: string) => l !== "");
    const descLines = description.split("\n").map((l: string) => l.trim()).filter((l: string) => l !== "");

    // Create SVG overlay
    let svgOverlay = `<svg width="${width}" height="${height}">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
          <feOffset dx="2" dy="2" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.5" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <style>
        .title { fill: white; font-family: sans-serif; font-weight: bold; font-size: ${titleFontSize}px; filter: url(#shadow); }
        .desc { fill: white; font-family: sans-serif; font-size: ${descFontSize}px; filter: url(#shadow); opacity: 0.9; }
      </style>`;

    let y = padding + titleFontSize;
    titleLines.forEach((line: string) => {
      svgOverlay += `<text x="${padding}" y="${y}" class="title">${line}</text>`;
      y += titleFontSize * 1.2;
    });

    y += descFontSize * 0.5;
    descLines.forEach((line: string) => {
      svgOverlay += `<text x="${padding}" y="${y}" class="desc">${line}</text>`;
      y += descFontSize * 1.4;
    });
    svgOverlay += `</svg>`;

    const finalImageBuffer = await sharp(imageBuffer)
      .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
      .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    const finalBase64 = `data:image/jpeg;base64,${finalImageBuffer.toString('base64')}`;

    // 4. Consume integral
    await axios.post("http://aibigtree.com/api/tool/consume", { userId, toolId });

    // 5. Save Result to SaaS using the standard 3-step OSS upload flow
    const tokenRes = await axios.post("http://aibigtree.com/api/upload/direct-token", {
      userId,
      toolId,
      source: "result",
      mimeType: "image/jpeg",
      fileName: "result.jpeg",
      fileSize: finalImageBuffer.byteLength
    });

    if (!tokenRes.data.success) {
      throw new Error(tokenRes.data.error || "获取上传地址失败");
    }

    const { uploadUrl, method, headers, objectKey } = tokenRes.data;

    // 6. PUT to OSS
    const uploadRes = await fetch(uploadUrl, {
      method: method || 'PUT',
      headers,
      body: finalImageBuffer
    });

    if (!uploadRes.ok) {
      throw new Error(`OSS 上传失败: ${uploadRes.status}`);
    }

    // 7. Commit
    const commitRes = await axios.post("http://aibigtree.com/api/upload/commit", {
      userId,
      toolId,
      source: "result",
      objectKey: objectKey,
      fileSize: finalImageBuffer.byteLength
    });

    if (!commitRes.data.success || !commitRes.data.savedToRecords) {
      throw new Error(commitRes.data.error || "图片入库失败");
    }

    // 8. Return response to user (SaaS URL + generated image for display)
    res.json({
      success: true,
      imageUrl: finalBase64,
      saasRecord: commitRes.data
    });

  } catch (error: any) {
    const errorMessage = error.response?.data?.message || (error.response?.status === 413 ? "图片数据太大，已被服务器拒绝 (413)" : error.message);
    console.error("Unified generation error:", errorMessage, error.response?.data);
    res.status(error.response?.status || 500).json({ 
      success: false, 
      error: errorMessage
    });
  }
});

// Gemini API route (Legacy fallback)
app.post("/api/gemini", async (req, res) => {
  try {
    const { model, contents, config } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
    }

    const result = await (genAI as any).models.generateContent({
      model,
      contents,
      config
    });

    res.json(result);
  } catch (error: any) {
    console.error("Gemini API error:", error);
    res.status(500).json({ error: error instanceof Error ? `[Proxy Debug] ${error.message}` : "AI generation failed" });
  }
});

export default app;
