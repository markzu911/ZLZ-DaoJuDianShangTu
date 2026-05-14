
export interface SaasUser {
  id: string;
  name: string;
  enterprise: string;
  integral: number;
}

export interface SaasTool {
  id: string;
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

export interface DirectTokenRequest {
  userId: string;
  toolId: string;
  source: "result";
  mimeType: string;
  fileName?: string;
  fileSize: number;
}

export interface DirectTokenResponse {
  success: boolean;
  uploadUrl: string;
  objectKey: string;
  headers?: Record<string, string>;
  message?: string;
}

export interface CommitRequest {
  userId: string;
  toolId: string;
  source: "result";
  objectKey: string;
  fileSize: number;
}

export interface CommitResponse {
  success: boolean;
  savedToRecords: boolean;
  recordId: string;
  url: string;
  image: {
    recordId: string;
    url: string;
    fileName: string;
    savedToRecords: boolean;
  };
  message?: string;
}

class SaasService {
  private async fetchApi(path: string, body: any, method = "POST") {
    const url = path.startsWith("http") ? path : path;
    const options: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (method !== "GET" && body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const text = await response.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: text.slice(0, 300) };
    }

    if (!response.ok || data.success === false) {
      throw new Error(data.message || data.error || `请求失败: ${response.status}`);
    }
    return data;
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

  async getDirectToken(req: DirectTokenRequest): Promise<DirectTokenResponse> {
    return this.fetchApi("/api/upload/direct-token", req);
  }

  async commitUpload(req: CommitRequest): Promise<CommitResponse> {
    return this.fetchApi("/api/upload/commit", req);
  }

  async uploadImage(base64: string, userId: string, toolId: string): Promise<any> {
    const response = await fetch("/api/save-result", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId, toolId, base64 }),
    });

    const text = await response.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { message: text.slice(0, 500) };
    }

    if (!response.ok || !data.success) {
      throw new Error(data.message || `Failed to save result: ${response.status}`);
    }

    return {
      image: data.data,
      currentIntegral: data.currentIntegral
    };
  }

  async listImages(userId: string, role: number = 1) {
    const params = new URLSearchParams({ userId, role: role.toString() });
    const response = await fetch(`/api/upload/image?${params.toString()}`);
    return response.json();
  }

  async deleteImage(id: string, userId: string, role: number = 1) {
    return this.fetchApi("/api/upload/image", { id, userId, role }, "DELETE");
  }
}

export const saasService = new SaasService();
