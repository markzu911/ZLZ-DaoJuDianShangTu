import { AspectRatio, Resolution } from "../types";

async function callGeminiProxy(payload: any) {
  const response = await fetch("/api/gemini", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("Gemini Proxy Error Details:", errorData);
    throw new Error(errorData.error || "AI generation failed");
  }

  const result = await response.json();
  console.log("Gemini Proxy Success Result:", result);
  return result;
}

export async function generateKnifeImageServerSide(params: {
  userId: string | null;
  toolId: string | null;
  title: string;
  description: string;
  originalImage: string;
  stylePrompt: string;
  aspectRatio: string;
  resolution: string;
  idempotencyKey: string;
}) {
  const response = await fetch("/api/generate-knife", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || errorData.message || "生成失败");
  }

  return response.json();
}

export async function analyzeProductImage(base64Image: string) {
  const model = "gemini-3-flash-preview"; 
  
  const payload = {
    model,
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image.split(",")[1] || base64Image,
            },
          },
          {
            text: "You are an e-commerce marketing expert specializing in high-end kitchen knives (e.g., Damascas, Chef knives, Santoku). Analyze this knife and provide a professional, catchy title and a clear, short product description (max 15 words) highlighting its edge, material, or ergonomic handle in Chinese. Return the result in JSON format with keys 'title' and 'description'.",
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
    },
  };

  try {
    const response = await callGeminiProxy(payload);
    // The server returns the response which has .text() method or text property depending on how we handle it.
    // In our server.ts, we return res.json(response). The response object from genAI has a text() function,
    // but when serialized as JSON, it often includes the candidates.
    
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse AI response", e);
    return { title: "厨房精品", description: "高品质厨房必备好物" };
  }
}

export async function generateEcommerceImage(
  base64Image: string,
  style: string,
  aspectRatio: AspectRatio,
  resolution: Resolution,
  extraContext?: string | null,
  extraPrompts?: string[]
) {
  const model = "gemini-3.1-flash-image-preview";
  
  let stylePrompt = "";
  const saasContext = extraContext ? `Context from SaaS: ${extraContext}. ` : "";
  const saasPrompts = extraPrompts && extraPrompts.length > 0 ? `Additional Keywords: ${extraPrompts.join(", ")}. ` : "";

  const identityInstruction = `CRITICAL: The generated image MUST preserve the EXACT physical features of the provided knife. This includes its shape, blade color/metal texture, handle design (material, color, curvature), and any visible text, logos, or engravings on the blade. ${saasContext}${saasPrompts}DO NOT simplify or replace it with a generic knife. COMPOSITION: Ensure the main subject (hand, knife, food) is positioned in the center, right, or bottom of the frame, leaving the top-left corner as a clean, clear area for brand text. Do not place any complex or bright details in the top-left portion.`;
  
  if (style.includes("特写镜头")) {
    stylePrompt = `${identityInstruction}
    A high-end, realistic close-up professional photography of a hand using this specific kitchen knife to cut fresh ingredients (like vegetables or meat) on a premium wooden or stone cutting board. 
    Scene: Indoor kitchen. 
    Mood: Focused, precise, commercial.
    Composition: Near-view, low angle, slightly upward perspective.
    Fore-ground: Fresh ingredients clearly visible with sharp textures and natural colors.
    Mid-ground: The provided knife as the hero, smooth blade with realistic reflections, showing the specific details exactly as in the photo. A healthy adult hand is gripping the handle professionally, while the other hand holds the ingredient.
    Background: Blurred dark or black background, suggesting a high-end dark kitchen space, emphasizing the subject.
    Lighting: Warm, soft, focused light coming from the top-right. Strong contrast between the bright subject and deep dark background.
    Detail: High clarity, sharp edge details, realistic skin texture on the hand.`;
  } else if (style.includes("俯拍视角")) {
    stylePrompt = `${identityInstruction}
    A high-end top-down still life photography featuring this kitchen knife combined with fresh ingredients. 
    Theme: Ingredients and kitchenware. Style: Modern minimalist, clean, exquisite, calm with a touch of life.
    Composition: Horizontal landscape, mid-view, top-down perspective from slightly above.
    Layout:
    Foreground: Scattered fresh items like herbs, garlic, or sliced ingredients on the surface, with clear textures.
    Mid-ground (Focus): This kitchen knife placed diagonally, handle pointing top-right, blade pointing bottom-left. Next to it are artfully arranged ingredients or slices, decorated with small herbs.
    Background: Solid dark gray background.
    Subject Details: The knife has smooth metallic/stainless steel texture with noticeable reflections on the blade. Handle shows detailed material and color exactly as in the photo. Ingredients show fresh natural textures. 
    Base: A deep brown wooden cutting board or similar surface, smooth with rounded edges.
    Lighting & Color: Soft light from the top-left creating natural shadows. Overall cool tone, with the warm colors of ingredients and wood providing contrast. Main palette: Dark gray, silver white, fresh ingredient colors (pink/red), and deep brown wood.
    Constraint: High clarity with slight film grain for realism. Keep the solid dark gray background to highlight the subjects. DO NOT include any text, letters, or words in the image background.`;
  } else {
    // Cooking Scene
    stylePrompt = `${identityInstruction}
    A professional advertisement photography of a cooking scene featuring this kitchen knife. 
    Style: Modern, clean, realistic. Mood: Positive, professional, full of life.
    Composition: Vertical portrait orientation, mid-range view, slightly top-down observer perspective with moderate depth.
    Layout:
    Foreground: Blurry accessories like long peppers or decorative ingredients at the very bottom, framing the shot.
    Mid-ground (Focus): The main ingredients lying on a high-quality wooden cutting board with rounded edges. Fresh slices and garnishes like cherry tomatoes and herbs are artfully placed, showing vibrant colors and plump textures.
    Human Interaction: A left hand is stabilize the ingredient, while a right hand holds the provided knife, cutting precisely into the food. The posture is natural and professional.
    Knife Details: The knife is clearly characterized with its specific blade pattern (like Damascus), metallic reflections, and any identifiable brand markers must be preserved.
    Background:
    Left: A blurred window suggesting indoor setting with greenery outside.
    Right: Soft cream-colored curtains with gentle folds, illuminated by warm light.
    Background Right: Blurred clean white kitchen cabinets and countertops.
    Lighting & Color: Plentiful soft light from the left window. Warm overall color palette emphasizing freshness.
    Constraint: High clarity, no noise, realistic interaction between hand, knife, and juicy ingredients.`;
  }

  const payload = {
    model,
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image.split(",")[1] || base64Image,
            },
          },
          {
            text: stylePrompt,
          },
        ],
      },
    ],
    config: {
      imageConfig: {
        aspectRatio: aspectRatio as any,
        imageSize: resolution as any,
      },
    },
  };

  const response = await callGeminiProxy(payload);

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  
  throw new Error("No image data returned from AI");
}

