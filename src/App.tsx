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
  X
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

const RESOLUTIONS: { label: string; value: Resolution }[] = [
  { label: "1K", value: "1K" },
  { label: "2K", value: "2K" },
  { label: "4K", value: "4K" },
];

export default function App() {
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
    <div className="flex flex-col md:flex-row min-h-screen w-full bg-[#f3f4f6] text-zinc-900 font-sans">
      {/* 1. Left Sidebar: Upload Area */}
      <aside className="w-full md:w-[340px] bg-white border-r border-zinc-200 flex flex-col shrink-0 md:sticky md:top-0 md:h-screen overflow-y-auto">
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
                      <p className="text-[10px] text-zinc-300 mt-1">支持常见图片格式（如 JPG, PNG, WebP），最大支持 20MB（通过前端压缩上传）</p>
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
        
        {/* Simple History at bottom of sidebar or keep it in a floating modal? 
            Let's put it at the bottom to maintain the screenshot's clean look. */}
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
      <main className="flex-1 flex flex-col relative bg-white">
        {/* Navigation Tabs */}
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
                  <div className="flex items-center gap-3 mb-4">
                    <div className="text-orange-400"><Sparkles className="w-6 h-6" /></div>
                    <h3 className="font-bold text-lg text-zinc-800">刀具特征分析 (可自由修改)</h3>
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
                        <div className="flex gap-2">
                          {RESOLUTIONS.map(res => (
                            <button
                              key={res.value}
                              onClick={() => setResolution(res.value)}
                              className={`px-6 py-3 rounded-xl text-sm font-bold transition-all border ${resolution === res.value ? "bg-zinc-900 text-white border-zinc-900 shadow-lg shadow-zinc-200" : "bg-white text-zinc-400 border-zinc-100 hover:border-zinc-300"}`}
                            >
                              {res.label}
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

        {/* Simple History at bottom of sidebar or keep it in a floating modal? 
            Let's put it at the bottom to maintain the screenshot's clean look. */}

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
      </main>
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
