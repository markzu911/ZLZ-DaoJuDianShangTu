import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

  // API routes
  app.post("/api/gemini", async (req, res) => {
    try {
      const { model, contents, config } = req.body;
      
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
      }

      // Using the models.generateContent if getGenerativeModel is not found per lint
      // but let's try the standard getGenerativeModel with correct options first.
      const geminiModel = (genAI as any).getGenerativeModel({ model });
      
      // The client sends the payload in a format slightly different from what getGenerativeModel.generateContent expects directly if we use the top-level ai.models.generateContent in client.
      // But we can just use the genAI instance.
      
      const result = await geminiModel.generateContent({
        contents,
        generationConfig: config
      });

      const response = result.response;
      
      // Return the full response object or just what's needed.
      // To match the client-side expectations, we might need to structure it.
      res.json(response);
    } catch (error) {
      console.error("Gemini API error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "AI generation failed" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
