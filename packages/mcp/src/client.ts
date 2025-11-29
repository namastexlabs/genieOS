import axios, { AxiosInstance } from 'axios';

export interface DaemonHealthResponse {
  status: string;
  servers: string[];
}

export interface ServerInfo {
  id: string;
  packageName: string;
  lastUsed: string;
}

export interface ToolInfo {
  name: string;
  description?: string;
  inputSchema?: any;
}

export interface ToolCallResponse {
  serverId: string;
  toolName: string;
  result: any;
}

export interface NpmServerOptions {
  pkg: string;
  version?: string;
  args?: string[];
  env?: Record<string, string>;
  clientName?: string;
  clientVersion?: string;
}

export class McpClient {
  private axios: AxiosInstance;

  constructor(private baseUrl: string = 'http://localhost:3001') {
    this.axios = axios.create({
      baseURL: baseUrl,
      timeout: 30000, // 30 second timeout
    });
  }

  async healthCheck(): Promise<DaemonHealthResponse> {
    const response = await this.axios.get('/health');
    return response.data;
  }

  async startServer(serverId: string, options: NpmServerOptions): Promise<{ message: string; serverId: string }> {
    const response = await this.axios.post('/servers', { serverId, ...options });
    return response.data;
  }

  async listServers(): Promise<ServerInfo[]> {
    const response = await this.axios.get('/servers');
    return response.data;
  }

  async listTools(serverId: string): Promise<{ serverId: string; tools: ToolInfo[] }> {
    const response = await this.axios.get(`/servers/${serverId}/tools`);
    return response.data;
  }

  async callTool(serverId: string, toolName: string, args: any = {}): Promise<ToolCallResponse> {
    const response = await this.axios.post(`/servers/${serverId}/tools/${toolName}/call`, {
      arguments: args
    });
    return response.data;
  }

  async stopServer(serverId: string): Promise<{ message: string }> {
    const response = await this.axios.delete(`/servers/${serverId}`);
    return response.data;
  }

  async stopAllServers(): Promise<{ message: string }> {
    const response = await this.axios.delete('/servers');
    return response.data;
  }

  // Utility method to check if daemon is running
  async isDaemonRunning(): Promise<boolean> {
    try {
      await this.healthCheck();
      return true;
    } catch (error) {
      return false;
    }
  }

  // Utility method to wait for daemon to be ready
  async waitForDaemon(maxRetries: number = 10, delay: number = 1000): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      if (await this.isDaemonRunning()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    throw new Error('Daemon did not become ready within the expected time');
  }
}

export default McpClient;
