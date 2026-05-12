import { AspectRatio } from "../types";

export async function addTextToImage(
  imageSrc: string,
  title: string,
  description: string,
  aspectRatio: AspectRatio
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject("Failed to get canvas context");

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const padding = canvas.width * 0.05;
      const titleFontSize = Math.floor(canvas.width * 0.065);
      const descFontSize = Math.floor(canvas.width * 0.028);
      
      const titleLines = title.split("\n").map(l => l.trim()).filter(l => l !== "");
      const descLines = description.split("\n").map(l => l.trim()).filter(l => l !== "");

      let startX = padding;
      let startY = padding + titleFontSize;
      ctx.textAlign = "left";

      // 1. Title
      ctx.fillStyle = "white";
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 15;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      ctx.font = `900 ${titleFontSize}px "Inter", sans-serif`;
      
      titleLines.forEach((line, index) => {
        ctx.fillText(line, startX, startY + (index * titleFontSize * 1.2));
      });

      let currentY = startY + (titleLines.length * titleFontSize * 1.2);

      // 2. Decorative Line
      const lineY = currentY - (titleFontSize * 0.5);
      const lineWidth = canvas.width * 0.08;
      ctx.strokeStyle = "#f97316"; // Orange accent
      ctx.lineWidth = Math.max(2, canvas.width * 0.005);
      ctx.shadowBlur = 5;
      ctx.beginPath();
      ctx.moveTo(startX, lineY);
      ctx.lineTo(startX + lineWidth, lineY);
      ctx.stroke();

      // 3. Description
      ctx.font = `500 ${descFontSize}px "Inter", sans-serif`;
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.shadowBlur = 8;
      
      const descStartTop = lineY + (descFontSize * 2);
      descLines.forEach((line, index) => {
        ctx.fillText(line, startX, descStartTop + (index * descFontSize * 1.5));
      });

      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = imageSrc;
  });
}
