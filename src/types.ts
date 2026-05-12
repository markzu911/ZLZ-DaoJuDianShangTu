export type AspectRatio = "1:1" | "3:4" | "4:3" | "16:9";
export type Resolution = "1K" | "2K" | "4K";

export interface GenerationHistory {
  id: string;
  originalImage: string;
  generatedImage: string;
  finalImage: string; // Image with text
  title: string;
  description: string;
  style: string;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  timestamp: number;
}

export type AppStep = 'UPLOAD' | 'ANALYZE' | 'GENERATE' | 'RESULT';
