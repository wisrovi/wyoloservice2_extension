import * as vscode from 'vscode';
import * as http from 'http';
import * as path from 'path';

export interface InvokerPhysical {
    gpu_model?: string;
    gpu_count?: number;
    gpu_memory_total?: string;
    ram_total?: string;
    swap_total?: string;
    cpu_cores?: string;
    gpu_temp_c?: number;
    gpu_power_watts?: number;
    gpu_tdp_watts?: number;
    gpu_compute_util_pct?: number;
}

export interface InvokerNode {
    worker_ip: string;
    hostname?: string;
    status: string;
    pause_state?: string;
    physical?: InvokerPhysical;
    limits?: {
        max_gpu_percent?: number;
        max_ram?: string;
        max_cpu_cores?: number;
        shm_size_gb?: number;
    };
    k8s_conditions?: {
        ready?: boolean;
        disk_pressure?: boolean;
        memory_pressure?: boolean;
    };
    k8s_gpu_plugin?: {
        capacity?: number;
        allocatable?: number;
        allocated?: number;
        status?: string;
    };
}

export interface ClusterTask {
    id?: string;
    study_id?: string;
    name?: string;
    worker?: string;
    status?: string;
    priority?: string;
    target_queue?: string;
    created_at?: string;
}

export class ClusterApiClient {
    private static instance: ClusterApiClient;

    private cachedToken: string | null = null;
    private tokenExpiry: number = 0;

    private constructor() {}

    public static getInstance(): ClusterApiClient {
        if (!ClusterApiClient.instance) {
            ClusterApiClient.instance = new ClusterApiClient();
        }
        return ClusterApiClient.instance;
    }

    public getControlHost(): string {
        const config = vscode.workspace.getConfiguration('neuralforge');
        return config.get<string>('controlHost', '192.168.10.252');
    }

    public getControlPort(): number {
        const config = vscode.workspace.getConfiguration('neuralforge');
        return config.get<number>('controlPort', 23442);
    }

    public getAdminHost(): string {
        const config = vscode.workspace.getConfiguration('neuralforge');
        return config.get<string>('adminHost', '127.0.0.1');
    }

    public getAdminPort(): number {
        const config = vscode.workspace.getConfiguration('neuralforge');
        return config.get<number>('k8sAdminPort', 30001);
    }

    public getAdminUsername(): string {
        const config = vscode.workspace.getConfiguration('neuralforge');
        return config.get<string>('adminUsername', 'wisrovi');
    }

    public getAdminPassword(): string {
        const config = vscode.workspace.getConfiguration('neuralforge');
        return config.get<string>('adminPassword', 'wyoloservice');
    }

    /**
     * Authenticates with the Cluster Admin API and returns the Bearer token.
     */
    public async getAuthToken(): Promise<string | null> {
        const now = Date.now();
        if (this.cachedToken && this.tokenExpiry > now + 60000) {
            return this.cachedToken;
        }

        const adminHost = this.getAdminHost();
        const adminPort = this.getAdminPort();
        const username = this.getAdminUsername();
        const password = this.getAdminPassword();

        try {
            const loginPayload = JSON.stringify({ username, password });
            const res = await this.httpRequest({
                host: adminHost,
                port: adminPort,
                path: '/api/v1/auth/login',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(loginPayload)
                }
            }, loginPayload);

            if (res && res.access_token) {
                this.cachedToken = res.access_token;
                this.tokenExpiry = now + 12 * 3600 * 1000; // 12 hours validity
                return this.cachedToken;
            }
        } catch (err) {
            console.warn('Failed to obtain Cluster Admin token:', err);
        }
        return null;
    }

    /**
     * Fetch list of invoker nodes with physical GPU telemetry.
     */
    public async fetchInvokers(): Promise<InvokerNode[]> {
        const token = await this.getAuthToken();
        const adminHost = this.getAdminHost();
        const adminPort = this.getAdminPort();

        if (token) {
            try {
                const res = await this.httpRequest({
                    host: adminHost,
                    port: adminPort,
                    path: '/api/v1/invokers',
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (Array.isArray(res)) {
                    return res;
                }
            } catch (err) {
                console.warn('Admin API invokers failed, falling back to control server:', err);
            }
        }

        // Fallback to Control Server /workers
        try {
            const res = await this.httpRequest({
                host: this.getControlHost(),
                port: this.getControlPort(),
                path: '/workers',
                method: 'GET'
            });
            if (res && res.workers) {
                const list: InvokerNode[] = [];
                for (const [wname, info] of Object.entries(res.workers)) {
                    const ip = Array.isArray(info) && info.length > 0 ? info[0] : wname;
                    list.push({
                        worker_ip: String(ip),
                        hostname: wname,
                        status: 'online'
                    });
                }
                return list;
            }
        } catch {
            // Ignore
        }

        return [];
    }

    /**
     * Fetch active and queued tasks across the cluster.
     */
    public async fetchTasks(): Promise<{ running: ClusterTask[]; pending: ClusterTask[] }> {
        // Try Control Server /tasks first
        try {
            const res = await this.httpRequest({
                host: this.getControlHost(),
                port: this.getControlPort(),
                path: '/tasks',
                method: 'GET'
            });
            if (res) {
                return {
                    running: res.running || [],
                    pending: res.pending || []
                };
            }
        } catch (err) {
            console.warn('Control server tasks failed, trying admin API:', err);
        }

        // Try Admin API
        const token = await this.getAuthToken();
        if (token) {
            try {
                const active = await this.httpRequest({
                    host: this.getAdminHost(),
                    port: this.getAdminPort(),
                    path: '/api/v1/tasks/active',
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                return {
                    running: Array.isArray(active) ? active : [],
                    pending: []
                };
            } catch {
                // Ignore
            }
        }

        return { running: [], pending: [] };
    }

    /**
     * Submits a training YAML configuration to the cluster.
     */
    public async submitTraining(
        filePath: string,
        yamlContent: string,
        options: { mode?: string; workerName?: string; priority?: string; startAt?: string } = {}
    ): Promise<{ success: boolean; study_id?: string; message?: string; error?: string }> {
        const host = this.getControlHost();
        const port = this.getControlPort();
        const filename = path.basename(filePath);
        const mode = options.mode || 'public';
        const priority = options.priority || 'medium';

        const boundary = '----NeuralForgeBoundary' + Math.random().toString(36).substring(2);
        let postData = '';
        postData += `--${boundary}\r\n`;
        postData += `Content-Disposition: form-data; name="mode"\r\n\r\n${mode}\r\n`;
        postData += `--${boundary}\r\n`;
        postData += `Content-Disposition: form-data; name="priority"\r\n\r\n${priority}\r\n`;
        if (options.workerName) {
            postData += `--${boundary}\r\n`;
            postData += `Content-Disposition: form-data; name="worker_name"\r\n\r\n${options.workerName}\r\n`;
        }
        if (options.startAt) {
            postData += `--${boundary}\r\n`;
            postData += `Content-Disposition: form-data; name="start_at"\r\n\r\n${options.startAt}\r\n`;
        }
        postData += `--${boundary}\r\n`;
        postData += `Content-Disposition: form-data; name="config_file"; filename="${filename}"\r\n`;
        postData += `Content-Type: application/x-yaml\r\n\r\n`;
        postData += yamlContent;
        postData += `\r\n--${boundary}--\r\n`;

        try {
            const res = await this.httpRequest({
                host,
                port,
                path: '/train',
                method: 'POST',
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    'Content-Length': Buffer.byteLength(postData)
                }
            }, postData);

            if (res && res.study_id) {
                return {
                    success: true,
                    study_id: res.study_id,
                    message: res.message || `Training successfully dispatched. Study ID: ${res.study_id}`
                };
            }
            if (res && res.error) {
                return { success: false, error: res.error };
            }
            return { success: true, study_id: res?.study_id, message: JSON.stringify(res) };
        } catch (err: any) {
            return { success: false, error: err.message || 'Failed to submit training job to Control Server' };
        }
    }

    /**
     * Cancels an active or queued training study.
     */
    public async cancelStudy(studyId: string): Promise<{ success: boolean; message: string }> {
        let success = false;
        let message = '';

        // Cancel via Control Server
        try {
            const res = await this.httpRequest({
                host: this.getControlHost(),
                port: this.getControlPort(),
                path: `/study/${encodeURIComponent(studyId)}/cancel`,
                method: 'POST'
            });
            if (res && (res.status === 'success' || res.message)) {
                success = true;
                message = res.message || `Study ${studyId} cancelled.`;
            }
        } catch {
            // Attempt admin API fallback
        }

        // Cancel via Admin API
        const token = await this.getAuthToken();
        if (token) {
            try {
                const res = await this.httpRequest({
                    host: this.getAdminHost(),
                    port: this.getAdminPort(),
                    path: `/api/v1/tasks/${encodeURIComponent(studyId)}/cancel`,
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res && res.status === 'success') {
                    success = true;
                    message = res.message || message;
                }
            } catch {
                // Ignore
            }
        }

        return { success, message: message || (success ? `Study ${studyId} cancelled.` : `Failed to cancel study ${studyId}`) };
    }

    /**
     * Retrieves real-time execution logs for a study.
     */
    public async fetchTaskLogs(studyId: string, limit: number = 200): Promise<string[]> {
        const token = await this.getAuthToken();
        if (token) {
            try {
                const res = await this.httpRequest({
                    host: this.getAdminHost(),
                    port: this.getAdminPort(),
                    path: `/api/v1/tasks/${encodeURIComponent(studyId)}/logs?limit=${limit}`,
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res && Array.isArray(res.logs)) {
                    return res.logs;
                }
            } catch (err) {
                console.warn('Failed to fetch logs from admin API:', err);
            }
        }
        return [];
    }

    /**
     * Retrieves trial metrics history for Optuna & YOLO convergence curves.
     */
    public async fetchStudyMetrics(studyId: string): Promise<any[]> {
        const token = await this.getAuthToken();
        if (token) {
            try {
                const res = await this.httpRequest({
                    host: this.getAdminHost(),
                    port: this.getAdminPort(),
                    path: `/api/v1/tasks/${encodeURIComponent(studyId)}/metrics`,
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (Array.isArray(res)) {
                    return res;
                }
            } catch (err) {
                console.warn('Failed to fetch study metrics:', err);
            }
        }
        return [];
    }

    /**
     * Pre-flight dataset inspection (validates train/val splits, class counts, data.yaml).
     */
    public async inspectDataset(datasetPath: string): Promise<any> {
        const token = await this.getAuthToken();
        if (token) {
            try {
                const res = await this.httpRequest({
                    host: this.getAdminHost(),
                    port: this.getAdminPort(),
                    path: `/api/v1/cluster/datasets/inspect?dataset_path=${encodeURIComponent(datasetPath)}`,
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                return res;
            } catch (err) {
                console.warn('Dataset inspect failed:', err);
            }
        }
        return null;
    }

    /**
     * Broadcasts Docker image pull to all invoker nodes across the cluster.
     */
    public async triggerBroadcastPull(targetImage: string = 'wisrovi/train_service:worker_executor_v1.0.0'): Promise<any> {
        const token = await this.getAuthToken();
        if (token) {
            try {
                const res = await this.httpRequest({
                    host: this.getAdminHost(),
                    port: this.getAdminPort(),
                    path: `/api/v1/cluster/images/broadcast-pull?target_image=${encodeURIComponent(targetImage)}`,
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                return res;
            } catch (err: any) {
                return { status: 'error', message: err.message };
            }
        }
        return { status: 'error', message: 'Failed to authenticate with Cluster Admin API.' };
    }

    /**
     * Runs deep diagnostics on an invoker node.
     */
    public async diagnoseNode(workerIp: string): Promise<any> {
        const token = await this.getAuthToken();
        if (token) {
            return this.httpRequest({
                host: this.getAdminHost(),
                port: this.getAdminPort(),
                path: `/api/v1/invokers/${encodeURIComponent(workerIp)}/diagnose`,
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        }
        return null;
    }

    /**
     * Prunes unused Docker objects and images on an invoker node.
     */
    public async pruneNodeDocker(workerIp: string): Promise<any> {
        const token = await this.getAuthToken();
        if (token) {
            return this.httpRequest({
                host: this.getAdminHost(),
                port: this.getAdminPort(),
                path: `/api/v1/invokers/${encodeURIComponent(workerIp)}/prune-docker`,
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        }
        return null;
    }

    /**
     * Generic HTTP request wrapper using native Node.js http module.
     */
    private httpRequest(options: http.RequestOptions, bodyData?: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const req = http.request({ ...options, timeout: 10000 }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            resolve(JSON.parse(data));
                        } catch {
                            resolve(data);
                        }
                    } else {
                        try {
                            const parsed = JSON.parse(data);
                            reject(new Error(parsed.detail || parsed.message || `HTTP ${res.statusCode}`));
                        } catch {
                            reject(new Error(`HTTP ${res.statusCode}: ${data || res.statusMessage}`));
                        }
                    }
                });
            });

            req.on('error', err => reject(err));
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timed out'));
            });

            if (bodyData) {
                req.write(bodyData);
            }
            req.end();
        });
    }
}
