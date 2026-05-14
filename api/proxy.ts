import express from "express";
import axios from "axios";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
      data: req.method !== 'GET' ? req.body : undefined,
      params: req.method === 'GET' ? req.query : undefined,
      headers: { 'Content-Type': 'application/json' }
    });
    res.status(response.status).json(response.data);
  } catch (error: any) {
    console.error(`Proxy error for ${req.method} ${targetPath}:`, error.response?.data || error.message);
    res.status(error.response?.status || 500).json(error.response?.data || { error: "代理转发失败", details: error.message });
  }
};

// Tool & Credit routes
app.post("/api/tool/launch", (req, res) => proxyRequest(req, res, "/api/tool/launch"));
app.post("/api/tool/verify", (req, res) => proxyRequest(req, res, "/api/tool/verify"));
app.post("/api/tool/consume", (req, res) => proxyRequest(req, res, "/api/tool/consume"));

// Image Upload & Management routes
app.post("/api/upload/direct-token", (req, res) => proxyRequest(req, res, "/api/upload/direct-token"));
app.post("/api/upload/commit", (req, res) => proxyRequest(req, res, "/api/upload/commit"));
app.get("/api/upload/image", (req, res) => proxyRequest(req, res, "/api/upload/image"));
app.delete("/api/upload/image", (req, res) => proxyRequest(req, res, "/api/upload/image"));

// Consolidated Save Result endpoint (Keep as fallback or for small images, but we will prefer individual steps)
app.post("/api/save-result", async (req, res) => {
  const { userId, toolId, base64 } = req.body;

  if (!userId || !toolId || !base64) {
    return res.status(400).json({ success: false, message: "Missing userId, toolId, or base64" });
  }

  try {
    const targetBaseUrl = "http://aibigtree.com";
    const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;
    const buffer = Buffer.from(base64Data, 'base64');
    const fileSize = buffer.length;

    // 1. Consume credits
    console.log(`[SaveResult] Consuming credits for user ${userId}, tool ${toolId}`);
    const consumeRes = await axios.post(`${targetBaseUrl}/api/tool/consume`, { userId, toolId });
    if (!consumeRes.data.success) {
      throw new Error(consumeRes.data.message || "Consume failed");
    }

    // 2. Get direct upload token
    console.log(`[SaveResult] Getting direct token`);
    const tokenRes = await axios.post(`${targetBaseUrl}/api/upload/direct-token`, {
      userId,
      toolId,
      source: "result",
      mimeType: "image/png",
      fileName: "result.png",
      fileSize
    });
    if (!tokenRes.data.success) {
      throw new Error(tokenRes.data.message || "Failed to get upload token");
    }

    const { uploadUrl, objectKey, headers } = tokenRes.data;

    // 3. PUT image to OSS (direct backend upload)
    console.log(`[SaveResult] Uploading to OSS: ${objectKey}`);
    await axios.put(uploadUrl, buffer, {
      headers: {
        ...headers,
        "Content-Type": "image/png"
      }
    });

    // 4. Commit upload
    console.log(`[SaveResult] Committing upload: ${objectKey}`);
    const commitRes = await axios.post(`${targetBaseUrl}/api/upload/commit`, {
      userId,
      toolId,
      source: "result",
      objectKey,
      fileSize
    });

    if (!commitRes.data.success || !commitRes.data.savedToRecords) {
      throw new Error(commitRes.data.message || "Commit to database failed");
    }

    console.log(`[SaveResult] Success: recordId=${commitRes.data.recordId}`);
    res.json({
      success: true,
      data: commitRes.data.image,
      currentIntegral: consumeRes.data.data?.currentIntegral
    });

  } catch (error: any) {
    console.error("[SaveResult] Error:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: error.response?.data?.message || error.message || "保存失败"
    });
  }
});

// Image Management routes
app.get("/api/upload/image", (req, res) => proxyRequest(req, res, "/api/upload/image"));
app.delete("/api/upload/image", (req, res) => proxyRequest(req, res, "/api/upload/image"));

// Gemini API route
app.post("/api/gemini", async (req, res) => {
  try {
    const { model, contents, config } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
    }

    // Use ai.models.generateContent as per the @google/genai SDK pattern
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
