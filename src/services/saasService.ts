
export interface SaasUser {
  name: string;
  enterprise: string;
  integral: number;
}

export interface SaasTool {
  name: string;
  integral: number;
}

export interface LaunchResponse {
  success: boolean;
  data?: {
    user: SaasUser;
    tool: SaasTool;
  };
  message?: string;
}

export interface VerifyResponse {
  success: boolean;
  data?: {
    currentIntegral: number;
    requiredIntegral: number;
  };
  message?: string;
}

export interface ConsumeResponse {
  success: boolean;
  data?: {
    currentIntegral: number;
    consumedIntegral: number;
  };
  message?: string;
}

export interface UploadResponse {
  success: boolean;
  url?: string;
  message?: string;
}

class SaasService {
  private baseUrl = ""; // Base URL will be determined by the proxy or absolute path if provided

  setBaseUrl(url: string) {
    this.baseUrl = url.endsWith("/") ? url.slice(0, -1) : url;
  }

  private async fetchApi(path: string, body: any) {
    const response = await fetch(`${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return response.json();
  }

  async launch(userId: string, toolId: string): Promise<LaunchResponse> {
    return this.fetchApi("/api/tool/launch", { userId, toolId });
  }

  async verify(userId: string, toolId: string): Promise<VerifyResponse> {
    return this.fetchApi("/api/tool/verify", { userId, toolId });
  }

  async consume(userId: string, toolId: string): Promise<ConsumeResponse> {
    return this.fetchApi("/api/tool/consume", { userId, toolId });
  }

  async uploadImage(base64: string, userId: string): Promise<UploadResponse> {
    // Note: The spec says images are saved to UserImage table when source="result"
    return this.fetchApi("/api/upload/image", {
      base64,
      userId,
      source: "result"
    });
  }
}

export const saasService = new SaasService();
