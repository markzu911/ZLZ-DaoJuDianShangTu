
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
    // 1. Consume credits
    const consumeRes = await this.consume(userId, toolId);
    if (!consumeRes.success) {
      throw new Error(consumeRes.message || "积分扣除失败");
    }

    // 2. Convert base64 to Blob
    const res = await fetch(base64);
    const blob = await res.blob();
    const fileSize = blob.size;
    const mimeType = blob.type || "image/jpeg";

    // 3. Get direct token
    const tokenRes = await this.getDirectToken({
      userId,
      toolId,
      source: "result",
      mimeType,
      fileName: "result.jpg",
      fileSize
    });

    if (!tokenRes.success) {
      throw new Error(tokenRes.message || "获取上传地址失败");
    }

    // 4. PUT to OSS (Directly from browser to avoid proxy 413)
    const uploadRes = await fetch(tokenRes.uploadUrl, {
      method: "PUT",
      headers: {
        ...tokenRes.headers,
        "Content-Type": mimeType
      },
      body: blob
    });

    if (!uploadRes.ok) {
      throw new Error(`OSS 上传失败: ${uploadRes.status}`);
    }

    // 5. Commit
    const commitRes = await this.commitUpload({
      userId,
      toolId,
      source: "result",
      objectKey: tokenRes.objectKey,
      fileSize
    });

    if (!commitRes.success || !commitRes.savedToRecords) {
      throw new Error(commitRes.message || "图片入库失败");
    }

    return {
      image: commitRes.image,
      currentIntegral: consumeRes.data?.currentIntegral
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
