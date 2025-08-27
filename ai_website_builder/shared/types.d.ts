export interface User {
    id: string;
    email: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface Website {
    id: string;
    userId: string;
    domain: string;
    title: string;
    description?: string;
    content: string;
    status: 'draft' | 'published' | 'deploying' | 'error';
    sslStatus: 'pending' | 'active' | 'error';
    dnsStatus: 'pending' | 'resolved' | 'error';
    createdAt: Date;
    updatedAt: Date;
    deployedAt?: Date;
}
export interface AIConversation {
    id: string;
    websiteId: string;
    messages: AIMessage[];
    createdAt: Date;
    updatedAt: Date;
}
export interface AIMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    websiteChanges?: WebsiteChange[];
}
export interface WebsiteChange {
    type: 'create' | 'update' | 'delete';
    element: string;
    content: string;
    styles?: Record<string, string>;
}
export interface DeploymentConfig {
    domain: string;
    serverPath: string;
    nginxConfig: string;
    sslCertPath?: string;
}
export interface ServerStats {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    activeWebsites: number;
    totalRequests: number;
}
export interface APIResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}
export interface AIPromptTemplate {
    id: string;
    name: string;
    category: 'generation' | 'editing' | 'optimization';
    prompt: string;
    variables: string[];
}
export interface EditorState {
    selectedElement: string | null;
    mode: 'visual' | 'code';
    history: HistoryItem[];
    currentIndex: number;
}
export interface HistoryItem {
    id: string;
    content: string;
    timestamp: Date;
    description: string;
}
//# sourceMappingURL=types.d.ts.map