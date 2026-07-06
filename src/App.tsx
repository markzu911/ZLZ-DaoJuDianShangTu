/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Upload, 
  Sparkles, 
  Image as ImageIcon, 
  Download, 
  History, 
  RotateCcw,
  Type as TypeIcon,
  Palette,
  Maximize,
  ArrowRight,
  Loader2,
  Trash2,
  CheckCircle2,
  Expand,
  X,
  MessageSquare,
  Send,
  Bot,
  User,
  Calendar
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

import { AppStep, AspectRatio, Resolution, GenerationHistory } from "./types";
import { analyzeProductImage, generateEcommerceImage } from "./services/aiService";
import { addTextToImage } from "./lib/imageUtils";
import { saasService, SaasUser, SaasTool } from "./services/saasService";

const STYLES = [
  "特写镜头 (Close-up)",
  "俯拍视角 (Top-down View)",
  "烹饪场景 (Cooking Scene)"
];

const ASPECT_RATIOS: { label: string; value: AspectRatio }[] = [
  { label: "1:1", value: "1:1" },
  { label: "3:4", value: "3:4" },
  { label: "4:3", value: "4:3" },
  { label: "16:9", value: "16:9" },
];

const RESOLUTIONS: { label: string; value: Resolution; desc?: string }[] = [
  { label: "1K 标准", value: "1K", desc: "1024x1024" },
  { label: "2K 高清", value: "2K", desc: "2048x2048" },
  { label: "4K 超清", value: "4K", desc: "4096x4096" },
];

export interface ChatSuggestion {
  id: string;
  label: string;
  variant?: "default" | "outline" | "secondary" | "orange";
  action: () => void;
}

export interface ChatMessage {
  id: string;
  sender: "ai" | "user";
  text?: string;
  image?: string;
  timestamp: number;
  suggestions?: ChatSuggestion[];
  isGenerating?: boolean;
  generatedResult?: string;
}

export default function App() {
  // Global Navigation Module State
  const [activeModule, setActiveModule] = useState<"EDITOR" | "AGENT" | "HISTORY">("EDITOR");

  // Agent States
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const agentFileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // State
  const [step, setStep] = useState<AppStep>("UPLOAD");
  const [activeMainTab, setActiveMainTab] = useState<"SETTINGS" | "RESULT">("SETTINGS");
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [analyzedData, setAnalyzedData] = useState<{ title: string; description: string } | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedStyle, setSelectedStyle] = useState(STYLES[0]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [resolution, setResolution] = useState<Resolution>("1K");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [finalImage, setFinalImage] = useState<string | null>(null);

  const [history, setHistory] = useState<GenerationHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [previewImage, setPreviewImage] = useState<GenerationHistory | null>(null);

  // SaaS States
  const [userId, setUserId] = useState<string | null>(null);
  const [toolId, setToolId] = useState<string | null>(null);
  const [userData, setUserData] = useState<SaasUser | null>(null);
  const [toolData, setToolData] = useState<SaasTool | null>(null);
  const [initContext, setInitContext] = useState<string | null>(null);
  const [initPrompts, setInitPrompts] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // SaaS Initialization
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const data = event.data;
      if (data.type === 'SAAS_INIT') {
        const uId = data.userId === "null" || data.userId === "undefined" ? null : data.userId;
        const tId = data.toolId === "null" || data.toolId === "undefined" ? null : data.toolId;
        
        setUserId(uId);
        setToolId(tId);
        setInitContext(data.context);
        setInitPrompts(data.prompt || []);

        // Use context/prompts for initial UI if needed
        if (data.context && !title) {
          setTitle(data.context);
        }

        if (uId && tId) {
          try {
            const launchData = await saasService.launch(uId, tId);
            if (launchData.success && launchData.data) {
              setUserData(launchData.data.user);
              setToolData(launchData.data.tool);
            }
          } catch (error) {
            console.error("Launch failed", error);
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Auto scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Initial chat population
  useEffect(() => {
    initChat();
  }, []);

  const initChat = () => {
    setChatMessages([
      {
        id: "init-1",
        sender: "ai",
        text: "您好！我是您的AI 刀具实景智能设计师。\n\n我们将在此智能对话空间中，通过点击下方按钮或在输入框中打字，直接生成精美的主图大图！",
        timestamp: Date.now(),
        suggestions: [
          {
            id: "upload-local",
            label: "上传刀具图",
            variant: "blue",
            action: () => {
              agentFileInputRef.current?.click();
            }
          }
        ]
      }
    ]);
  };

  const handleUseDemoImage = async () => {
    setLoading(true);
    setLoadingText("正在载入高质感演示刀具照片...");
    try {
      const demoUrl = "https://images.unsplash.com/photo-1614362942485-367f05ee45b1?auto=format&fit=crop&q=80&w=600";
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const base64 = canvas.toDataURL("image/jpeg", 0.9);
          handleAgentImageLoad(base64);
        }
        setLoading(false);
      };
      img.onerror = () => {
        const dummyBase64 = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'><rect width='100%' height='100%' fill='%23fafafa'/><path d='M100 300 L300 100 L320 120 L120 320 Z' fill='%23cccccc'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='16' fill='%23888888'>演示高质感厨刀</text></svg>";
        handleAgentImageLoad(dummyBase64);
        setLoading(false);
      };
      img.src = demoUrl;
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const handleAgentImageLoad = (base64: string) => {
    setOriginalImage(base64);
    
    const userMsgId = "user-img-" + Date.now();
    setChatMessages(prev => [
      ...prev,
      {
        id: userMsgId,
        sender: "user",
        image: base64,
        text: "已成功上传刀具照片，请帮我分析和推荐生图方案！",
        timestamp: Date.now()
      }
    ]);

    setTimeout(() => {
      setChatMessages(prev => [
        ...prev,
        {
          id: "ai-analyze-prompt-" + Date.now(),
          sender: "ai",
          text: "照片上传成功。\n\n这把厨刀看起来非常有质感。接下来，我将帮您进行 AI 智能产品特征分析，自动为您提取高级的商铺标题和核心卖点，这将被融合印制到您的主图上。\n\n请点击下方按钮开始分析产品特征：",
          timestamp: Date.now(),
          suggestions: [
            {
              id: "start-analysis",
              label: "智能分析刀具特色",
              variant: "orange",
              action: () => {
                triggerAgentAnalysis(base64);
              }
            },
            {
              id: "skip-analysis",
              label: "跳过分析，直接选择生图风格",
              variant: "outline",
              action: () => {
                triggerSkipAnalysis();
              }
            }
          ]
        }
      ]);
    }, 1000);
  };

  const triggerAgentAnalysis = async (img: string) => {
    setChatMessages(prev => [
      ...prev,
      {
        id: "user-anal-" + Date.now(),
        sender: "user",
        text: "开始智能分析刀具特色...",
        timestamp: Date.now()
      }
    ]);

    const aiThinkingId = "ai-think-" + Date.now();
    setChatMessages(prev => [
      ...prev,
      {
        id: aiThinkingId,
        sender: "ai",
        text: "正在深度读取这把刀具的材质、轮廓和设计细节，并自动生成最佳营销文案，请稍候...",
        timestamp: Date.now(),
        isGenerating: true
      }
    ]);

    try {
      const data = await analyzeProductImage(img);
      setAnalyzedData(data);
      setTitle(data.title);
      setDescription(data.description);
      setStep("ANALYZE");

      setChatMessages(prev => {
        const filtered = prev.filter(m => m.id !== aiThinkingId);
        return [
          ...filtered,
          {
            id: "ai-anal-result-" + Date.now(),
            sender: "ai",
            text: `厨刀产品特征分析完成。\n\n我已经为您构思了极具吸引力的电商文案：\n\n商铺标题：\n「 ${data.title} 」\n核心卖点：\n「 ${data.description} 」\n\n下一步，我们需要选择电商背景的主题风格。不同的视觉场景会完美契合不同的营销定位：\n\n1. 特写镜头：极致放大局部细节与钢材纹路，推荐专业高端定位。\n2. 俯拍视角：现代极简摆盘，适合展现高雅、干净的产品艺术感。\n3. 烹饪场景：充满人间烟火气和生活感，极富真实使用体验。\n\n请在下方选择您最喜欢的视觉风格：`,
            timestamp: Date.now(),
            suggestions: STYLES.map((style, idx) => ({
              id: `style-${idx}`,
              label: style,
              variant: idx === 0 ? "orange" : "outline" as any,
              action: () => {
                handleAgentSelectStyle(style);
              }
            }))
          }
        ];
      });
    } catch (err) {
      console.error(err);
      setChatMessages(prev => {
        const filtered = prev.filter(m => m.id !== aiThinkingId);
        return [
          ...filtered,
          {
            id: "ai-anal-err-" + Date.now(),
            sender: "ai",
            text: `文案生成遇到了一点小麻烦，但我已经为您配置了经典备用营销文案：\n\n商铺标题：厨房大师精品主厨刀\n核心卖点：极速锋利，大马士革流线型人体工学手柄\n\n接下来，请选择主图的视觉风格：`,
            timestamp: Date.now(),
            suggestions: STYLES.map((style, idx) => ({
              id: `style-${idx}`,
              label: style,
              variant: idx === 0 ? "orange" : "outline" as any,
              action: () => {
                handleAgentSelectStyle(style);
              }
            }))
          }
        ];
      });
    }
  };

  const triggerSkipAnalysis = () => {
    setTitle("至臻锋芒厨刀");
    setDescription("匠心钢材，持久锋利，舒适手感");
    setStep("ANALYZE");

    setChatMessages(prev => [
      ...prev,
      {
        id: "user-skip-" + Date.now(),
        sender: "user",
        text: "跳过分析，直接选择风格",
        timestamp: Date.now()
      },
      {
        id: "ai-skip-res-" + Date.now(),
        sender: "ai",
        text: "好的。已为您填充经典款营销文案：\n\n商铺标题：至臻锋芒厨刀\n核心卖点：匠心钢材，持久锋利，舒适手感\n\n接下来，请选择您最喜欢的视觉风格以供生成主图：",
        timestamp: Date.now(),
        suggestions: STYLES.map((style, idx) => ({
          id: `style-${idx}`,
          label: style,
          variant: idx === 0 ? "orange" : "outline" as any,
          action: () => {
            handleAgentSelectStyle(style);
          }
        }))
      }
    ]);
  };

  const handleAgentSelectStyle = (style: string) => {
    setSelectedStyle(style);
    
    setChatMessages(prev => [
      ...prev,
      {
        id: "user-style-" + Date.now(),
        sender: "user",
        text: `选择视觉风格：${style}`,
        timestamp: Date.now()
      },
      {
        id: "ai-style-confirm-" + Date.now(),
        sender: "ai",
        text: `已为您锁定 ${style} 风格方案。\n\n我们已经万事俱备：\n产品图：已就绪\n文案内容：已生成\n设计风格：${style}\n\n我们将采用 1:1 标准画幅比例与 1K 分辨率默认参数。您可以一键启动 AI 引擎生成最终的高清主图，或前往侧边栏按需调整画幅与分辨率参数。\n\n请点击下方按钮开始一键生成主图：`,
        timestamp: Date.now(),
        suggestions: [
          {
            id: "one-click-generate",
            label: "一键生成 4K 商业主图",
            variant: "orange",
            action: () => {
              triggerAgentGeneration();
            }
          },
          {
            id: "back-to-editor",
            label: "去编辑器手动微调参数",
            variant: "outline",
            action: () => {
              setActiveModule("EDITOR");
            }
          }
        ]
      }
    ]);
  };

  const triggerAgentGeneration = async () => {
    if (!originalImage) return;

    setChatMessages(prev => [
      ...prev,
      {
        id: "user-gen-" + Date.now(),
        sender: "user",
        text: "开始生成主图，请展现魔法！",
        timestamp: Date.now()
      }
    ]);

    const aiThinkingId = "ai-gen-think-" + Date.now();
    setChatMessages(prev => [
      ...prev,
      {
        id: aiThinkingId,
        sender: "ai",
        text: "正在一键制作您的 4K 电商主图，生成过程大约需要 15-25 秒...\n\n我们将进行：\n1. 验证您的账户积分权益\n2. 智能融合刀具材质与所选背景风格\n3. 生成顶尖光影氛围的广告级图片\n4. 将营销文案精美贴合至安全排版区域\n5. 上传至 SaaS OSS 桶并入库记录\n\n请不要关闭或刷新页面，见证大图的诞生...",
        timestamp: Date.now(),
        isGenerating: true
      }
    ]);

    setLoading(true);
    setLoadingText("正在检查积分状态...");

    try {
      if (userId && toolId) {
        const verifyRes = await saasService.verify(userId, toolId);
        if (!verifyRes.success) {
          alert(verifyRes.message || "积分不足，无法生成");
          setLoading(false);
          setChatMessages(prev => {
            const filtered = prev.filter(m => m.id !== aiThinkingId);
            return [
              ...filtered,
              {
                id: "ai-gen-err-" + Date.now(),
                sender: "ai",
                text: `积分校验失败： ${verifyRes.message || "积分不足，无法生成主图。请充值积分后再试！"}`,
                timestamp: Date.now(),
                suggestions: [
                  {
                    id: "retry-init",
                    label: "重新开始",
                    variant: "outline",
                    action: () => { initChat(); }
                  }
                ]
              }
            ];
          });
          return;
        }
      }

      setLoadingText("AI 正在为您精心构思并生成电商大图...");
      const gImg = await generateEcommerceImage(
        originalImage, 
        selectedStyle, 
        aspectRatio, 
        resolution,
        initContext,
        initPrompts
      );
      setGeneratedImage(gImg);

      setLoadingText("正在为图片添加精美文案...");
      const fImg = await addTextToImage(gImg, title, description, aspectRatio);
      setFinalImage(fImg);

      if (userId && toolId) {
        setLoadingText("正在完成积分扣费并保存图片...");
        try {
          const saveRes = await saasService.uploadImage(fImg, userId, toolId);
          if (saveRes.currentIntegral !== undefined) {
             setUserData(prev => prev ? { ...prev, integral: saveRes.currentIntegral } : null);
          }
          window.parent.postMessage({
            type: 'SAAS_CONSUME_RESULT',
            userId,
            toolId,
            success: true
          }, '*');
        } catch (error) {
          console.error("Save result failed", error);
        }
      }

      const newEntry: GenerationHistory = {
        id: Date.now().toString(),
        originalImage,
        generatedImage: gImg,
        finalImage: fImg,
        title,
        description,
        style: selectedStyle,
        aspectRatio,
        resolution,
        timestamp: Date.now(),
      };
      setHistory(prev => [newEntry, ...prev]);
      setStep("RESULT");
      setActiveMainTab("RESULT");

      setChatMessages(prev => {
        const filtered = prev.filter(m => m.id !== aiThinkingId);
        return [
          ...filtered,
          {
            id: "ai-gen-success-" + Date.now(),
            sender: "ai",
            text: `恭喜您，高精度商业主图已成功生成并保存。\n\n- 所选风格：${selectedStyle}\n- 比例大小：${aspectRatio}\n- 分辨率：${resolution} (已完成4K细节超分)\n- 积分状态：已扣减并同步更新\n\n您可以通过下方预览卡片或操作按钮直接进行下载、预览，或去编辑器继续进行排版精修：`,
            timestamp: Date.now(),
            generatedResult: fImg,
            suggestions: [
              {
                id: "download-result",
                label: "立即下载 4K 大图",
                variant: "orange",
                action: () => {
                  handleDownload(fImg);
                }
              },
              {
                id: "edit-result",
                label: "导入编辑器精修",
                variant: "outline",
                action: () => {
                  setActiveModule("EDITOR");
                  setStep("EDITOR");
                  setActiveMainTab("BG");
                }
              },
              {
                id: "restart-agent",
                label: "再制作一张新的",
                variant: "outline",
                action: () => {
                  reset();
                  initChat();
                }
              }
            ]
          }
        ];
      });

      setLoading(false);

    } catch (err: any) {
      console.error(err);
      setLoading(false);
      setChatMessages(prev => {
        const filtered = prev.filter(m => m.id !== aiThinkingId);
        return [
          ...filtered,
          {
            id: "ai-gen-err-general-" + Date.now(),
            sender: "ai",
            text: `出图引擎出现了一点网络异常：\n\n${err?.message || "AI生成超时，可能是当前并发较高。"}\n\n您可以检查积分并重试。`,
            timestamp: Date.now(),
            suggestions: [
              {
                id: "retry-gen",
                label: "重新尝试生成",
                variant: "orange",
                action: () => { triggerAgentGeneration(); }
              },
              {
                id: "restart-all",
                label: "返回起点",
                variant: "outline",
                action: () => { initChat(); }
              }
            ]
          }
        ];
      });
    }
  };

  const handleSendCustomMessage = async () => {
    if (!chatInput.trim()) return;
    const text = chatInput.trim();
    setChatInput("");

    setChatMessages(prev => [
      ...prev,
      {
        id: "user-msg-" + Date.now(),
        sender: "user",
        text,
        timestamp: Date.now()
      }
    ]);

    const thinkingId = "ai-think-" + Date.now();
    setChatMessages(prev => [
      ...prev,
      {
        id: thinkingId,
        sender: "ai",
        text: "让我思考一下，如何为您解答...",
        timestamp: Date.now(),
        isGenerating: true
      }
    ]);

    try {
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gemini-3.5-flash",
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `你是一个智能的高端厨房刀具电商营销与主图设计专家智能体(KnifeAI)。
你的职责是帮助和引导用户完成刀具的产品分析，并且为他们推荐最适合的电商主图生图方案（特写镜头 Close-up、俯拍视角 Top-down View、烹饪场景 Cooking Scene）。
当前应用中的配置状态：
- 比例(aspectRatio): "${aspectRatio}" (可选值: "1:1", "9:16", "3:2", "2:3", "3:4", "4:3", "16:9")
- 分辨率(resolution): "${resolution}" (可选值: "1K", "2K", "4K")
- 风格(selectedStyle): "${selectedStyle}" (可选值: "特写镜头 (Close-up)", "俯拍视角 (Top-down View)", "烹饪场景 (Cooking Scene)")
- 标题(title): "${title || "未设定"}"
- 卖点描述(description): "${description || "未设定"}"

请阅读用户的消息：“${text}”。
你的职责：
1. 你的回答(reply)应当友好、专业、极简地解答用户，简体中文，不要超过150字。
2. 绝对不能在回答(reply)中包含任何表情符号/Emoji。
3. 绝对不能在回答(reply)中包含 '**'（双星号）或 '*'（星号）粗体标记，必须使用干净、无修饰的极简纯文本。
4. 如果用户在对话中提到了想要调整、设定或修改特定的：
   - 比例（例如：“我需要16:9比例”、“设成9比16”等），请在 aspectRatio 字段返回对应的值，比如 "16:9", "9:16" 等。
   - 画质/分辨率（例如：“1k画质”、“要4k超清”、“高分辨率”等），请在 resolution 字段返回对应的值，比如 "1K", "2K", "4K" 等（英文字母大写）。
   - 风格（例如：“想要俯拍”、“烹饪风格的背景”等），请在 selectedStyle 字段返回对应的标准风格，比如 "俯拍视角 (Top-down View)", "特写镜头 (Close-up)", "烹饪场景 (Cooking Scene)" 之一。
   - 标题（例如：“标题改成至尊名厨”等），请在 title 字段返回新标题。
   - 核心卖点（例如：“卖点写极致锋利”等），请在 description 字段返回新核心卖点。
如果用户没有提及相关的设定，则对应字段留空或返回 null。`
                }
              ]
            }
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                reply: { type: "STRING" },
                aspectRatio: { type: "STRING" },
                resolution: { type: "STRING" },
                selectedStyle: { type: "STRING" },
                title: { type: "STRING" },
                description: { type: "STRING" }
              },
              required: ["reply"]
            }
          }
        })
      });

      if (!response.ok) throw new Error("API failed");
      const result = await response.json();
      const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      
      let parsed: any = {};
      try {
        parsed = JSON.parse(rawText);
      } catch (e) {
        parsed = { reply: rawText };
      }

      let replyText = parsed.reply || "抱歉，我现在网络有些繁忙。您可以直接点击下方的按钮，让我为您一键分析并生图！";
      
      // Clean up replyText just in case
      replyText = replyText.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD00-\uDFFF]/g, '');
      replyText = replyText.replace(/\*\*/g, '').replace(/\*/g, '');

      // Apply dynamic updates
      let updatedParams: string[] = [];
      if (parsed.aspectRatio && ["1:1", "9:16", "3:2", "2:3", "3:4", "4:3", "16:9"].includes(parsed.aspectRatio)) {
        setAspectRatio(parsed.aspectRatio as AspectRatio);
        updatedParams.push(`比例: ${parsed.aspectRatio}`);
      }
      if (parsed.resolution && ["1K", "2K", "4K"].includes(parsed.resolution.toUpperCase())) {
        const resValue = parsed.resolution.toUpperCase() as Resolution;
        setResolution(resValue);
        updatedParams.push(`分辨率: ${resValue}`);
      }
      if (parsed.selectedStyle && STYLES.includes(parsed.selectedStyle)) {
        setSelectedStyle(parsed.selectedStyle);
        updatedParams.push(`风格: ${parsed.selectedStyle}`);
      }
      if (parsed.title) {
        setTitle(parsed.title);
        updatedParams.push(`标题: ${parsed.title}`);
      }
      if (parsed.description) {
        setDescription(parsed.description);
        updatedParams.push(`核心卖点: ${parsed.description}`);
      }

      if (updatedParams.length > 0) {
        replyText += `\n\n系统提示：已为您自动调整参数：${updatedParams.join('，')}。`;
      }

      setChatMessages(prev => {
        const filtered = prev.filter(m => m.id !== thinkingId);
        return [
          ...filtered,
          {
            id: "ai-reply-" + Date.now(),
            sender: "ai",
            text: replyText.trim(),
            timestamp: Date.now(),
            suggestions: [
              {
                id: "one-click-gen-from-chat",
                label: originalImage ? "立即一键生成主图" : "请先上传/选择图片",
                variant: "orange",
                action: () => {
                  if (originalImage) {
                    triggerAgentGeneration();
                  } else {
                    agentFileInputRef.current?.click();
                  }
                }
              }
            ]
          }
        ];
      });

    } catch (err) {
      console.error(err);
      setChatMessages(prev => {
        const filtered = prev.filter(m => m.id !== thinkingId);
        return [
          ...filtered,
          {
            id: "ai-reply-err-" + Date.now(),
            sender: "ai",
            text: "网络有些微延迟，但我随时待命！您可以点击下方按钮继续进行：",
            timestamp: Date.now(),
            suggestions: [
              {
                id: "continue-btn",
                label: originalImage ? "立即一键生成" : "上传厨刀照片",
                variant: "orange",
                action: () => {
                  if (originalImage) {
                    triggerAgentGeneration();
                  } else {
                    agentFileInputRef.current?.click();
                  }
                }
              }
            ]
          }
        ];
      });
    }
    };

  const handleAgentFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxSide = 1600;

          if (width > maxSide || height > maxSide) {
            if (width > height) {
              height = Math.round((height * maxSide) / width);
              width = maxSide;
            } else {
              width = Math.round((width * maxSide) / height);
              height = maxSide;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
            handleAgentImageLoad(compressedBase64);
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  // Handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxSide = 1600;

          if (width > maxSide || height > maxSide) {
            if (width > height) {
              height = Math.round((height * maxSide) / width);
              width = maxSide;
            } else {
              width = Math.round((width * maxSide) / height);
              height = maxSide;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
            setOriginalImage(compressedBase64);
            setStep("UPLOAD");
            setActiveMainTab("SETTINGS");
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const startAnalysis = async () => {
    if (!originalImage) return;
    setLoading(true);
    setLoadingText("正在分析产品特征...");
    try {
      const data = await analyzeProductImage(originalImage);
      setAnalyzedData(data);
      setTitle(data.title);
      setDescription(data.description);
      setStep("ANALYZE");
      setActiveMainTab("SETTINGS");
    } catch (error) {
      console.error(error);
      setTitle("厨房精品");
      setDescription("高品质厨房必备好物");
      setStep("ANALYZE");
    } finally {
      setLoading(false);
    }
  };

  const generateImage = async () => {
    if (!originalImage) return;
    
    setLoading(true);
    setLoadingText("正在检查积分状态...");

    // SaaS Verify
    if (userId && toolId) {
      try {
        const verifyRes = await saasService.verify(userId, toolId);
        if (!verifyRes.success) {
          alert(verifyRes.message || "积分不足，无法生成");
          setLoading(false);
          return;
        }
      } catch (error) {
        console.error("Verify failed", error);
        // Fail open or fail closed? Usually fail closed for credits.
        alert("网络异常，无法验证积分");
        setLoading(false);
        return;
      }
    }

    setActiveMainTab("RESULT"); // Direct switch to result view
    setLoadingText("AI 正在为您精心构思并生成电商大图...");
    try {
      const gImg = await generateEcommerceImage(
        originalImage, 
        selectedStyle, 
        aspectRatio, 
        resolution,
        initContext,
        initPrompts
      );
      setGeneratedImage(gImg);
      setLoadingText("正在为图片添加精美文案...");
      const fImg = await addTextToImage(gImg, title, description, aspectRatio);
      setFinalImage(fImg);

      // SaaS Consume & Persistence
      if (userId && toolId) {
        setLoadingText("正在完成积分扣费并保存图片...");
        try {
          // unified saveResult endpoint performs consume, direct-token, and commit
          const saveRes = await saasService.uploadImage(fImg, userId, toolId);
          
          // Update local integral state
          if (saveRes.currentIntegral !== undefined) {
             setUserData(prev => prev ? { ...prev, integral: saveRes.currentIntegral } : null);
          }

          // Notify parent if needed
          window.parent.postMessage({
            type: 'SAAS_CONSUME_RESULT',
            userId,
            toolId,
            success: true
          }, '*');
        } catch (error) {
          console.error("Save result failed", error);
        }
      }
      
      const newEntry: GenerationHistory = {
        id: Date.now().toString(),
        originalImage,
        generatedImage: gImg,
        finalImage: fImg,
        title,
        description,
        style: selectedStyle,
        aspectRatio,
        resolution,
        timestamp: Date.now(),
      };
      setHistory(prev => [newEntry, ...prev]);
      setStep("RESULT");
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const downloadImage = () => {
    if (!finalImage) return;
    const link = document.createElement("a");
    link.href = finalImage;
    link.download = `kitchen-ai-${Date.now()}.png`;
    link.click();
  };

  const reset = () => {
    setOriginalImage(null);
    setAnalyzedData(null);
    setTitle("");
    setDescription("");
    setGeneratedImage(null);
    setFinalImage(null);
    setStep("UPLOAD");
    setActiveMainTab("SETTINGS");
  };

  const deleteHistoryItem = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const loadFromHistory = (item: GenerationHistory) => {
    setOriginalImage(item.originalImage);
    setTitle(item.title);
    setDescription(item.description);
    setSelectedStyle(item.style);
    setAspectRatio(item.aspectRatio);
    setResolution(item.resolution);
    setGeneratedImage(item.generatedImage);
    setFinalImage(item.finalImage);
    setStep("RESULT");
    setActiveMainTab("RESULT");
  };

  const handleDownload = (imageUrl: string) => {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `kitchen-ai-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col min-h-screen w-full bg-[#f3f4f6] text-zinc-900 font-sans">
      {/* Top Header Navigation Bar */}
      <header className={`h-16 flex items-center justify-between px-6 sticky top-0 z-50 shadow-sm shrink-0 transition-all ${
        activeModule === "AGENT" 
          ? "bg-white border-b border-zinc-200 text-zinc-800" 
          : "bg-zinc-900 border-b border-zinc-800 text-white"
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold shadow-inner ${
            activeModule === "AGENT"
              ? "bg-gradient-to-tr from-blue-500 to-indigo-600 text-white"
              : "bg-gradient-to-tr from-orange-400 to-amber-500 text-white"
          }`}>
            <Sparkles className="w-4.5 h-4.5 text-white fill-white" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tight flex items-center gap-2">
              <span className={activeModule === "AGENT" ? "text-zinc-950" : "text-white"}>KnifeAI</span>
              <span className={`text-xs font-medium hidden sm:inline ${activeModule === "AGENT" ? "text-zinc-500" : "text-zinc-400"}`}>| 刀具电商大图生成系统</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-black ${
                activeModule === "AGENT"
                  ? "bg-blue-100 text-blue-600"
                  : "bg-orange-500/20 text-orange-400"
              }`}>AI AGENT v2.0</span>
            </h1>
          </div>
        </div>

        <div className={`flex items-center gap-1 p-1 rounded-xl border ${
          activeModule === "AGENT"
            ? "bg-zinc-100 border-zinc-200"
            : "bg-zinc-800 border-zinc-700/50"
        }`}>
          <button
            onClick={() => setActiveModule("EDITOR")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeModule === "EDITOR" 
                ? "bg-orange-500 text-white shadow-md" 
                : activeModule === "AGENT"
                  ? "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/50 cursor-pointer"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-700/30 cursor-pointer"
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            手动编辑器
          </button>
          <button
            onClick={() => setActiveModule("AGENT")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeModule === "AGENT" 
                ? "bg-blue-600 text-white shadow-md" 
                : "text-zinc-400 hover:text-white hover:bg-zinc-700/30 cursor-pointer"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 animate-pulse" />
            智能体生成 (新)
          </button>
          <button
            onClick={() => setActiveModule("HISTORY")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeModule === "HISTORY" 
                ? "bg-orange-500 text-white shadow-md" 
                : activeModule === "AGENT"
                  ? "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/50 cursor-pointer"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-700/30 cursor-pointer"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            历史作品库 ({history.length})
          </button>
        </div>

        {userData ? (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${
            activeModule === "AGENT"
              ? "bg-blue-50 border-blue-100"
              : "bg-zinc-800/85 border-zinc-700/40"
          }`}>
            <span className={`w-2 h-2 rounded-full animate-pulse ${activeModule === "AGENT" ? "bg-blue-600" : "bg-orange-500"}`} />
            <span className={`text-xs font-medium ${activeModule === "AGENT" ? "text-zinc-600" : "text-zinc-300"}`}>
              积分: <strong className={`font-bold ${activeModule === "AGENT" ? "text-blue-600" : "text-orange-400"}`}>{userData.integral}</strong>
            </span>
          </div>
        ) : (
          <div className="text-zinc-500 text-xs font-medium">独立模式</div>
        )}
      </header>

      {/* Main Workspace Area */}
      <div className="flex flex-1 flex-col md:flex-row relative overflow-hidden">
        
        {/* ==================== MODULE 1: MANUAL EDITOR ==================== */}
        {activeModule === "EDITOR" && (
          <>
            {/* 1. Left Sidebar: Upload Area */}
            <aside className="w-full md:w-[340px] bg-white border-r border-zinc-200 flex flex-col shrink-0 md:sticky md:top-16 md:h-[calc(100vh-64px)] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center gap-2 mb-8">
                  <div className="bg-zinc-100 text-zinc-500 w-6 h-6 rounded flex items-center justify-center text-xs font-bold">1</div>
                  <h2 className="text-sm font-bold text-zinc-800">刀具上传与分析</h2>
                </div>

                {userData && (
                  <div className="mb-6 p-4 bg-orange-50 rounded-2xl border border-orange-100 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-orange-400 font-bold uppercase tracking-wider">我的积分</p>
                      <p className="text-xl font-black text-orange-600">{userData.integral}</p>
                    </div>
                    {toolData && (
                      <div className="text-right">
                        <p className="text-[10px] text-orange-400 font-bold uppercase tracking-wider">每次消耗</p>
                        <p className="text-lg font-bold text-zinc-600">-{toolData.integral}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label className="text-xs text-zinc-400 font-medium tracking-tight">产品原图</Label>
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-2xl border-2 border-dashed border-zinc-100 bg-zinc-50/50 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-zinc-50 hover:border-orange-200 transition-all group overflow-hidden"
                    >
                      {!originalImage ? (
                        <>
                          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-zinc-300">
                            <Upload className="w-6 h-6" />
                          </div>
                          <div className="text-center">
                            <p className="text-xs font-medium text-zinc-500">点击上传刀具图片</p>
                            <p className="text-[10px] text-zinc-300 mt-1">支持 JPG, PNG, WebP</p>
                          </div>
                        </>
                      ) : (
                        <img src={originalImage} className="w-full h-full object-cover" alt="Original" />
                      )}
                    </div>
                  </div>

                  <Button 
                    onClick={startAnalysis} 
                    disabled={loading || !originalImage}
                    className="w-full h-12 bg-zinc-400 hover:bg-zinc-500 text-white rounded-xl flex gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    第1步 | 智能分析刀具
                  </Button>
                  
                  {originalImage && (
                    <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} className="w-full text-zinc-400 text-[10px] hover:text-zinc-500">
                      更换图片重试
                    </Button>
                  )}
                </div>
              </div>

              <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
              
              {/* Sidebar bottom history roll */}
              <div className="mt-auto border-t border-zinc-100 p-4">
                 <Label className="text-[10px] text-zinc-400 uppercase font-black tracking-widest px-2 mb-3 block">历史记录</Label>
                 <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                   {history.slice(0, 10).map(item => (
                      <div 
                        key={item.id} 
                        className="group relative w-14 h-14 rounded-lg overflow-hidden border border-zinc-100 shrink-0 cursor-pointer hover:border-orange-300 transition-all"
                      >
                        <img src={item.finalImage} className="w-full h-full object-cover" alt="History" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setPreviewImage(item); }}
                            className="p-1 bg-white rounded-full text-zinc-900 hover:bg-orange-50"
                          >
                            <Expand className="w-2.5 h-2.5" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDownload(item.finalImage); }}
                            className="p-1 bg-white rounded-full text-zinc-900 hover:bg-orange-50"
                          >
                            <Download className="w-2.5 h-2.5" />
                          </button>
                        </div>
                        <div onClick={() => loadFromHistory(item)} className="absolute inset-0 z-0" />
                      </div>
                   ))}
                   {history.length === 0 && <p className="text-[10px] text-zinc-300 p-2">暂无历史</p>}
                 </div>
              </div>
            </aside>

            {/* 2. Main Content Area */}
            <main className="flex-1 flex flex-col relative bg-white overflow-y-auto">
              <nav className="h-16 bg-white sticky top-0 z-10 shrink-0 border-b border-zinc-100 flex items-center px-12 gap-8">
                <button 
                  onClick={() => setActiveMainTab("SETTINGS")}
                  className={`h-full border-b-2 flex items-center text-sm font-bold transition-all px-2 ${activeMainTab === "SETTINGS" ? "border-zinc-800 text-zinc-800" : "border-transparent text-zinc-400"}`}
                >
                  第2步 | 参数设置
                </button>
                <button 
                  onClick={() => setActiveMainTab("RESULT")}
                  disabled={!finalImage && !loading}
                  className={`h-full border-b-2 flex items-center text-sm font-bold transition-all px-2 disabled:opacity-30 ${activeMainTab === "RESULT" ? "border-zinc-800 text-zinc-800" : "border-transparent text-zinc-400"}`}
                >
                  第3步 | 生成结果
                </button>
              </nav>

              <div>
                <div className="p-6 md:p-10 space-y-6 max-w-6xl mx-auto w-full">
                  {activeMainTab === "SETTINGS" ? (
                    <div className="space-y-6 animate-in fade-in duration-500">
                      {/* 2.1 Feature Analysis Card */}
                      <Card className="p-6 rounded-[32px] border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white relative overflow-hidden">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="text-orange-400"><Sparkles className="w-6 h-6" /></div>
                            <h3 className="font-bold text-lg text-zinc-800">刀具特征分析 (已设为自动填充简体中文)</h3>
                          </div>
                          <Badge variant="outline" className="bg-orange-50 text-orange-500 border-orange-100 font-bold">
                            智能推荐
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
                          <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-xs text-zinc-400">刀具型号/标题 (支持换行)</Label>
                              <Textarea 
                                value={title} 
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="等待分析..."
                                className="bg-zinc-50/50 border-zinc-100 rounded-xl min-h-[100px] text-sm focus:bg-white resize-none"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs text-zinc-400">核心卖点 (支持换行)</Label>
                              <Textarea 
                                value={description} 
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="等待分析..."
                                className="bg-zinc-50/50 border-zinc-100 rounded-xl min-h-[100px] text-sm focus:bg-white resize-none"
                              />
                            </div>
                          </div>
                          <div className="space-y-2 col-span-full">
                             <Label className="text-xs text-zinc-400 font-bold">整体视觉风格</Label>
                             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                               {STYLES.map(style => (
                                 <button
                                   key={style}
                                   onClick={() => setSelectedStyle(style)}
                                   className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${selectedStyle === style ? "bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-100" : "bg-zinc-50/50 text-zinc-500 border-zinc-100 hover:border-orange-200"}`}
                                 >
                                   {style.includes(" (") ? style.split(" (")[0] : style}
                                 </button>
                               ))}
                             </div>
                          </div>
                        </div>
                      </Card>

                      {/* 2.2 Image Options Card */}
                      <Card className="p-6 rounded-[32px] border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="text-zinc-400"><RotateCcw className="w-5 h-5" /></div>
                          <h3 className="font-bold text-lg text-zinc-800">生图参数设置</h3>
                        </div>

                        <div className="space-y-6">
                          <div className="flex flex-wrap gap-x-12 gap-y-6">
                            <div className="space-y-3">
                              <Label className="text-xs text-zinc-400 font-bold block">画幅比例选择</Label>
                              <div className="flex gap-2">
                                {ASPECT_RATIOS.map(ar => (
                                  <button
                                    key={ar.value}
                                    onClick={() => setAspectRatio(ar.value)}
                                    className={`px-6 py-3 rounded-xl text-sm font-bold transition-all border ${aspectRatio === ar.value ? "bg-zinc-900 text-white border-zinc-900 shadow-lg shadow-zinc-200" : "bg-white text-zinc-400 border-zinc-100 hover:border-zinc-300"}`}
                                  >
                                    {ar.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-3">
                              <Label className="text-xs text-zinc-400 font-bold block">输出分辨率</Label>
                              <div className="flex gap-3">
                                {RESOLUTIONS.map(res => (
                                  <button
                                    key={res.value}
                                    onClick={() => setResolution(res.value)}
                                    className={`px-5 py-3 rounded-xl transition-all border flex flex-col items-center justify-center min-w-[100px] ${resolution === res.value ? "bg-zinc-900 text-white border-zinc-900 shadow-lg shadow-zinc-200" : "bg-white text-zinc-400 border-zinc-100 hover:border-zinc-300"}`}
                                  >
                                    <span className="text-sm font-bold">{res.label}</span>
                                    {res.desc && <span className={`text-[10px] mt-0.5 ${resolution === res.value ? "text-zinc-400" : "text-zinc-300"}`}>{res.desc}</span>}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                          
                          <div className="pt-2">
                             <Button 
                              onClick={generateImage}
                              disabled={loading || !originalImage || !title}
                              className="w-full h-14 bg-zinc-900 hover:bg-zinc-800 text-white rounded-2xl flex gap-3 text-lg font-bold shadow-xl shadow-zinc-200"
                             >
                               {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
                               立即开始生成主图
                             </Button>
                          </div>
                        </div>
                      </Card>
                    </div>
                  ) : (
                    <div className="animate-in slide-in-from-bottom-4 duration-500">
                      {loading ? (
                         <div className="min-h-[500px] flex flex-col items-center justify-center gap-6">
                            <div className="relative">
                              <div className="w-16 h-16 border-4 border-zinc-200 border-t-zinc-800 rounded-full animate-spin"></div>
                            </div>
                            <p className="text-zinc-500 font-bold tracking-widest uppercase text-xs">{loadingText}</p>
                         </div>
                      ) : finalImage ? (
                        <div className="space-y-6">
                          <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                              <CheckCircle2 className="text-green-500 w-5 h-5" /> 生成结果预览
                            </h3>
                            <div className="flex gap-3">
                              <Button variant="outline" onClick={() => setActiveMainTab("SETTINGS")} className="rounded-xl">重新修改</Button>
                              <Button onClick={downloadImage} className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl flex gap-2">
                                <Download className="w-4 h-4" /> 下载 4K 原图
                              </Button>
                            </div>
                          </div>
                          
                          <div className="bg-white p-6 rounded-[40px] shadow-sm border border-zinc-100 flex items-center justify-center min-h-[500px]">
                             <div className="relative group max-w-full">
                               <img src={finalImage} className="max-h-[600px] rounded-2xl shadow-xl object-contain mx-auto" alt="Result" />
                               <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none" />
                             </div>
                          </div>
                        </div>
                      ) : (
                        <div className="min-h-[500px] flex flex-col items-center justify-center text-zinc-300 gap-4">
                          <ImageIcon className="w-16 h-16 opacity-20" />
                          <p className="font-medium">请先完成第2步设置并点击生成</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </main>
          </>
        )}

        {/* ==================== MODULE 2: AI CONVERSATIONAL AGENT ==================== */}
        {activeModule === "AGENT" && (
          <div className="flex-1 flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-[#f1f5f9] w-full p-4 md:p-6 lg:p-8 animate-in fade-in duration-300">
            {/* The beautiful desktop card container mirroring the mockup exactly */}
            <div className="flex-1 flex flex-col h-full w-full max-w-6xl mx-auto bg-white rounded-[24px] border border-zinc-200 shadow-[0_12px_45px_rgba(0,0,0,0.03)] overflow-hidden">
              
              {/* Beautiful Agent Header inside the rounded card */}
              <div className="bg-white border-b border-zinc-150 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 z-20 shrink-0">
                <div className="flex items-center gap-3.5">
                  {/* Blue round icon with robot/ai icon */}
                  <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-md shadow-blue-100 shrink-0">
                    <Bot className="w-5.5 h-5.5 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm md:text-base text-zinc-800 tracking-tight">刀具实景智能设计师</h3>
                      <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-black border border-blue-100">AI 智能体</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5 font-medium">主图风格、产品物理材质与高保真场景搭配顾问</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="px-4 py-1.5 rounded-full text-[11px] font-semibold text-zinc-400 bg-[#f8fafc] border border-zinc-200/60 flex items-center gap-1.5 shadow-sm">
                    刀具图：{originalImage ? <span className="text-blue-600 font-bold">已上传</span> : "未上传"}
                  </span>
                  <span className="px-4 py-1.5 rounded-full text-[11px] font-semibold text-zinc-400 bg-[#f8fafc] border border-zinc-200/60 flex items-center gap-1.5 shadow-sm">
                    背景图：{finalImage ? <span className="text-blue-600 font-bold">已生成</span> : "未生成"}
                  </span>
                </div>
              </div>

              {/* Agent Dialogue Screen inside the card */}
              <div className="flex-1 flex flex-col h-full bg-[#f8fafc] relative min-w-0 overflow-hidden">
                {/* Message scroll wrapper */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
                  {chatMessages.map((msg) => (
                    <div 
                      key={msg.id}
                      className={`flex gap-4 max-w-4xl ${msg.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                    >
                      {/* Role Avatar */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-md ${msg.sender === "user" ? "bg-orange-500 text-white" : "bg-blue-600 text-white"}`}>
                        {msg.sender === "user" ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5 text-white" />}
                      </div>

                      {/* Dialogue Bubble */}
                      <div className="space-y-3 max-w-[85%] md:max-w-[75%]">
                        <div className={`shadow-[0_4px_24px_rgba(0,0,0,0.015)] border ${msg.sender === "user" ? "bg-orange-500 text-white border-orange-600 rounded-[24px] p-5" : "bg-white text-zinc-800 border-zinc-150 rounded-[32px] p-6"}`}>
                          {msg.text && (
                            <div className="text-sm leading-relaxed whitespace-pre-line font-medium markdown-body">
                              {msg.text}
                            </div>
                          )}

                          {/* Image Preview attachment directly shown */}
                          {msg.image && (
                            <div className="mt-3 rounded-xl overflow-hidden border border-black/10 max-w-sm shadow-sm bg-zinc-50 p-1">
                              <img src={msg.image} className="w-full object-cover max-h-56 rounded-lg" alt="Preview attachment" />
                            </div>
                          )}

                          {/* Success design outputs */}
                          {msg.generatedResult && (
                            <div className="mt-4 rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-50 shadow-inner group relative aspect-square max-w-md">
                              <img src={msg.generatedResult} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2">
                                <Button size="sm" onClick={() => handleDownload(msg.generatedResult!)} className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold gap-1.5 shadow-md">
                                  <Download className="w-3.5 h-3.5" />
                                  下载此图
                                </Button>
                                <Button size="sm" variant="secondary" onClick={() => {
                                  const histItem = history.find(h => h.finalImage === msg.generatedResult);
                                  if (histItem) setPreviewImage(histItem);
                                }} className="text-xs font-bold gap-1.5">
                                  <Maximize className="w-3.5 h-3.5" />
                                  全屏大图
                                </Button>
                              </div>
                            </div>
                          )}

                          {msg.isGenerating && (
                            <div className="mt-3 flex items-center gap-2.5 text-xs text-zinc-400">
                              <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                              <span>云端超级引擎正在执行生图任务...</span>
                            </div>
                          )}

                          {/* Conversational action buttons rendered directly inside the dialogue card */}
                          {msg.suggestions && msg.suggestions.length > 0 && (
                            <div className="flex flex-wrap gap-2.5 mt-4 pt-3 border-t border-zinc-100/80">
                              {msg.suggestions.map((sug) => {
                                if (sug.variant === "blue") {
                                  return (
                                    <button
                                      key={sug.id}
                                      onClick={sug.action}
                                      className="bg-blue-50 hover:bg-blue-100/90 text-blue-600 border border-blue-100 px-5 py-2.5 rounded-full text-xs font-bold transition-all duration-300 flex items-center gap-1.5 cursor-pointer shadow-sm"
                                    >
                                      <Upload className="w-3.5 h-3.5" />
                                      {sug.label}
                                    </button>
                                  );
                                }
                                return (
                                  <button
                                    key={sug.id}
                                    onClick={sug.action}
                                    className={`px-4 py-2 rounded-full text-xs font-bold border transition-all duration-300 cursor-pointer ${sug.variant === "orange" ? "bg-orange-500 hover:bg-orange-600 text-white border-orange-500" : "bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-600"}`}
                                  >
                                    {sug.label}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat Command Input Bar with Beautiful Rounded pill matching screenshot */}
                <div className="p-4 md:p-6 bg-white border-t border-zinc-150 shrink-0">
                  <div className="max-w-4xl mx-auto flex gap-3 relative items-center">
                    <input 
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSendCustomMessage(); }}
                      placeholder="你可以点击上方消息里的按钮上传刀具照片，或在此处向我提问..."
                      className="flex-1 h-12 bg-[#f8fafc] border border-zinc-200 rounded-full px-6 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 focus:bg-white transition-all text-zinc-800 font-medium placeholder-zinc-400 shadow-inner"
                    />
                    <button 
                      onClick={handleSendCustomMessage}
                      className="w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center transition-all shadow-lg shadow-blue-100 shrink-0 cursor-pointer"
                    >
                      <Send className="w-4 h-4 text-white fill-white" />
                    </button>
                  </div>
                  <div className="max-w-4xl mx-auto flex items-center flex-wrap gap-x-4 gap-y-1 mt-2.5 text-[10px] text-zinc-400 px-2">
                    <span className="font-bold text-zinc-500">⚡ 快捷调优：</span>
                    <button onClick={() => { if (originalImage) { triggerAgentAnalysis(originalImage); } else { alert("请上传/选择图片后分析！"); } }} className="hover:text-blue-600 font-bold transition-colors cursor-pointer">🔍 重新分析图片</button>
                    <span>|</span>
                    <button onClick={() => { setSelectedStyle("烹饪场景 Cooking Scene"); alert("已设为烹饪场景"); }} className="hover:text-blue-600 font-bold transition-colors cursor-pointer">🍳 设定为烹饪背景</button>
                    <span>|</span>
                    <button onClick={() => { setSelectedStyle("特写镜头 Close-up"); alert("已设为特写镜头"); }} className="hover:text-blue-600 font-bold transition-colors cursor-pointer">🔎 设定为特写镜头</button>
                  </div>
                </div>

                {/* Hidden file selector */}
                <input 
                  type="file" 
                  ref={agentFileInputRef} 
                  onChange={handleAgentFileUpload} 
                  className="hidden" 
                  accept="image/*" 
                />
              </div>

            </div>
          </div>
        )}

        {/* ==================== MODULE 3: HISTORICAL GALLERY ==================== */}
        {activeModule === "HISTORY" && (
          <div className="flex-1 bg-zinc-50 p-6 md:p-10 overflow-y-auto w-full">
            <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-400">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-zinc-800 tracking-tight flex items-center gap-2">
                    <History className="w-5 h-5 text-orange-500" />
                    <span>刀具历史出图作品库</span>
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    在此集中管理、无损保存、对比和下载您曾经完成的 4K 商业刀具主图。
                  </p>
                </div>
                <Button 
                  onClick={() => { if(confirm("确定要永久清空历史生图库吗？这不可恢复。")) { setHistory([]); } }} 
                  variant="outline" 
                  size="sm"
                  disabled={history.length === 0}
                  className="text-xs border-zinc-200 text-zinc-500 hover:text-red-500 hover:bg-red-50/50"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  清空生图库
                </Button>
              </div>

              {history.length === 0 ? (
                <div className="bg-white rounded-3xl p-16 text-center border border-zinc-150 shadow-sm max-w-xl mx-auto space-y-4">
                  <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center mx-auto text-zinc-300">
                    <ImageIcon className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-zinc-700">尚未生成过任何主图</h3>
                    <p className="text-xs text-zinc-400">
                      您的所有 4K 生成记录将被安全缓存在此。快去我们的智能体页面对话生图吧！
                    </p>
                  </div>
                  <div className="flex justify-center gap-3 pt-2">
                    <Button onClick={() => setActiveModule("AGENT")} className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 rounded-xl">
                      进入智能体生成
                    </Button>
                    <Button onClick={() => setActiveModule("EDITOR")} variant="outline" className="text-xs font-bold px-4 rounded-xl">
                      返回手动编辑器
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {history.map((item) => (
                    <Card key={item.id} className="bg-white rounded-2xl overflow-hidden border border-zinc-150 shadow-sm group hover:shadow-md transition-all flex flex-col">
                      <div className="relative aspect-square bg-zinc-100 overflow-hidden">
                        <img src={item.finalImage} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt="Final product" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button 
                            size="sm" 
                            onClick={() => setPreviewImage(item)}
                            className="bg-white text-zinc-900 hover:bg-zinc-100 h-8 px-2.5 text-[10px] font-bold"
                          >
                            <Maximize className="w-3.5 h-3.5 mr-1" />
                            预览
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => handleDownload(item.finalImage)}
                            className="bg-orange-500 hover:bg-orange-600 text-white h-8 px-2.5 text-[10px] font-bold"
                          >
                            <Download className="w-3.5 h-3.5 mr-1" />
                            下载
                          </Button>
                        </div>
                      </div>

                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        <div>
                          <h4 className="text-xs font-bold text-zinc-800 line-clamp-1">{item.title}</h4>
                          <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-2">{item.description}</p>
                        </div>

                        <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-[9px] text-zinc-400">
                          <span className="bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-500 font-semibold">{item.style}</span>
                          <span className="font-mono">{new Date(item.timestamp).toLocaleString()}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <Button 
                            onClick={() => loadFromHistory(item)} 
                            variant="outline" 
                            size="sm" 
                            className="w-full h-8 text-[10px] border-zinc-150 text-zinc-600 hover:bg-zinc-50"
                          >
                            <RotateCcw className="w-2.5 h-2.5 mr-1" />
                            载入编辑
                          </Button>
                          <Button 
                            onClick={() => deleteHistoryItem(item.id)} 
                            variant="ghost" 
                            size="sm" 
                            className="w-full h-8 text-[10px] text-zinc-400 hover:text-red-500 hover:bg-red-50/50"
                          >
                            <Trash2 className="w-2.5 h-2.5 mr-1" />
                            删除
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Global Preview Modal */}
      <AnimatePresence>
        {previewImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-zinc-950/90 backdrop-blur-md flex items-center justify-center p-4 md:p-10"
            onClick={() => setPreviewImage(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-5xl w-full h-full flex flex-col items-center justify-center gap-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="relative group rounded-3xl overflow-hidden shadow-2xl bg-zinc-900 ring-1 ring-white/10">
                <img 
                  src={previewImage.finalImage} 
                  className="max-h-[80vh] w-auto object-contain select-none"
                  alt="Full preview"
                />
              </div>
              
              <div className="flex gap-4 items-center">
                <Button 
                  onClick={() => handleDownload(previewImage.finalImage)}
                  className="bg-white text-zinc-950 hover:bg-zinc-200 h-12 px-8 rounded-2xl font-bold flex gap-2 shadow-xl"
                >
                  <Download className="w-5 h-5" />
                  立即下载 4K 无损大图
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setPreviewImage(null)}
                  className="border-white/20 text-white hover:bg-white/10 h-12 px-6 rounded-2xl"
                >
                  关闭预览
                </Button>
              </div>

              <button 
                onClick={() => setPreviewImage(null)}
                className="absolute top-0 -right-12 md:right-0 p-2 text-white/50 hover:text-white transition-colors"
              >
                <X className="w-8 h-8" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
