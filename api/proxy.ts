import express from "express";
import axios from "axios";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));

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
app.post("/api/upload/image", (req, res) => proxyRequest(req, res, "/api/upload/image"));

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
