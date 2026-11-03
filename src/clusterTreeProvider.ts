import * as vscode from 'vscode';
import * as http from 'http';
import { ClusterApiClient, InvokerNode, ClusterTask } from './clusterApiClient';

export class ClusterTreeProvider implements vscode.TreeDataProvider<ClusterNodeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ClusterNodeItem | undefined | void> = new vscode.EventEmitter<ClusterNodeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<ClusterNodeItem | undefined | void> = this._onDidChangeTreeData.event;

    constructor() {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ClusterNodeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ClusterNodeItem): Promise<ClusterNodeItem[]> {
        const client = ClusterApiClient.getInstance();

        if (!element) {
            // Root categories
            return [
                new ClusterNodeItem('Managers', vscode.TreeItemCollapsibleState.Expanded, 'organization', 'category'),
                new ClusterNodeItem('Invokers (GPU Nodes)', vscode.TreeItemCollapsibleState.Expanded, 'server-environment', 'category'),
                new ClusterNodeItem('Tasks & Sweeps Queue', vscode.TreeItemCollapsibleState.Expanded, 'list-ordered', 'category')
            ];
        }

        try {
            // Category: Managers
            if (element.category === 'category' && element.label === 'Managers') {
                const host = client.getControlHost();
                const port = client.getControlPort();
                const health = await this.fetchJson(`http://${host}:${port}/health`);
                if (health && health.status === 'ok') {
                    const redisStatus = health.redis === 'connected' ? 'Redis OK' : 'Redis Alert';
                    return [
                        new ClusterNodeItem(`NAS_Train_service (${host}) [Online • ${redisStatus}]`, vscode.TreeItemCollapsibleState.None, 'server', 'manager')
                    ];
                }
                return [new ClusterNodeItem(`NAS_Train_service (${host}) [Offline]`, vscode.TreeItemCollapsibleState.None, 'error', 'manager')];
            }

            // Category: Invokers (GPU Nodes)
            if (element.category === 'category' && element.label === 'Invokers (GPU Nodes)') {
                const invokers = await client.fetchInvokers();
                const nodes: ClusterNodeItem[] = [];

                // Admin action item: Broadcast pull
                const broadcastItem = new ClusterNodeItem(
                    'Broadcast Pull Latest Worker Image',
                    vscode.TreeItemCollapsibleState.None,
                    'cloud-download',
                    'action'
                );
                broadcastItem.command = {
                    command: 'neuralforge.triggerBroadcastPull',
                    title: 'Broadcast Pull Worker Image'
                };
                broadcastItem.tooltip = 'Send Celery force_docker_pull to all active GPU invokers';
                nodes.push(broadcastItem);

                for (const inv of invokers) {
                    const ip = inv.worker_ip;
                    const hostname = inv.hostname || ip;
                    const gpuModel = inv.physical?.gpu_model || 'GPU Node';
                    const isOnline = inv.status === 'online';
                    const icon = isOnline ? 'vm-active' : 'vm-outline';

                    const item = new ClusterNodeItem(
                        `${hostname} (${ip}) [${gpuModel}]`,
                        vscode.TreeItemCollapsibleState.Collapsed,
                        icon,
                        'invoker',
                        inv
                    );
                    item.contextValue = 'invokerNode';
                    nodes.push(item);
                }

                return nodes.length > 0 ? nodes : [new ClusterNodeItem('No active GPU invokers found', vscode.TreeItemCollapsibleState.None, 'warning', 'info')];
            }

            // Invoker Sub-details (Telemetry & Hardware Gauges)
            if (element.category === 'invoker' && element.invokerData) {
                const data = element.invokerData;
                const details: ClusterNodeItem[] = [];

                // Gauge 1: VRAM Memory
                const vram = data.physical?.gpu_memory_total || (data.k8s_gpu_plugin?.allocated ? '8.0 GB (Allocated)' : 'Available');
                const vramGauge = new ClusterNodeItem(`VRAM: ${vram}`, vscode.TreeItemCollapsibleState.None, 'chip', 'gauge');
                vramGauge.tooltip = `Total VRAM on node ${data.worker_ip}`;
                details.push(vramGauge);

                // Gauge 2: GPU Core Load & Temperature
                const load = data.physical?.gpu_compute_util_pct ?? 0;
                const temp = data.physical?.gpu_temp_c ?? 45;
                const power = data.physical?.gpu_power_watts ?? 0;
                const tdp = data.physical?.gpu_tdp_watts ?? 100;
                const gpuGauge = new ClusterNodeItem(
                    `GPU: ${load}% Util • ${temp}°C • ${power}W/${tdp}W`,
                    vscode.TreeItemCollapsibleState.None,
                    'flame',
                    'gauge'
                );
                details.push(gpuGauge);

                // Gauge 3: System CPU & RAM
                const cpu = data.physical?.cpu_cores || 'Multi';
                const ram = data.physical?.ram_total || '16GB';
                details.push(new ClusterNodeItem(`Host: ${cpu} Cores • RAM: ${ram}`, vscode.TreeItemCollapsibleState.None, 'dashboard', 'gauge'));

                // Action: Diagnose Node
                const diagAction = new ClusterNodeItem(`Diagnose Connectivity & Sockets`, vscode.TreeItemCollapsibleState.None, 'pulse', 'action');
                diagAction.command = {
                    command: 'neuralforge.diagnoseNode',
                    title: 'Diagnose Node',
                    arguments: [data.worker_ip]
                };
                details.push(diagAction);

                // Action: Prune Docker
                const pruneAction = new ClusterNodeItem(`Prune Inactive Docker Containers`, vscode.TreeItemCollapsibleState.None, 'trash', 'action');
                pruneAction.command = {
                    command: 'neuralforge.pruneNodeDocker',
                    title: 'Prune Docker',
                    arguments: [data.worker_ip]
                };
                details.push(pruneAction);

                return details;
            }

            // Category: Tasks & Sweeps Queue
            if (element.category === 'category' && element.label === 'Tasks & Sweeps Queue') {
                const tasksData = await client.fetchTasks();
                const taskNodes: ClusterNodeItem[] = [];

                for (const t of tasksData.running) {
                    const tid = t.study_id || t.id || t.name || 'Task';
                    const node = new ClusterNodeItem(
                        `[RUNNING] ${tid} on ${t.worker || 'GPU Worker'}`,
                        vscode.TreeItemCollapsibleState.None,
                        'play-circle',
                        'task',
                        undefined,
                        t
                    );
                    node.contextValue = 'runningTask';
                    node.command = {
                        command: 'neuralforge.streamLogs',
                        title: 'Stream Logs',
                        arguments: [tid]
                    };
                    node.tooltip = `Click to stream live execution logs for study ${tid}`;
                    taskNodes.push(node);
                }

                for (const p of tasksData.pending) {
                    const pid = p.study_id || p.id || p.name || 'Task';
                    const node = new ClusterNodeItem(
                        `[QUEUED] ${pid} (Priority: ${p.priority || 'medium'})`,
                        vscode.TreeItemCollapsibleState.None,
                        'clock',
                        'task',
                        undefined,
                        p
                    );
                    node.contextValue = 'queuedTask';
                    taskNodes.push(node);
                }

                return taskNodes.length > 0 ? taskNodes : [new ClusterNodeItem('No active or queued tasks (Cluster idle)', vscode.TreeItemCollapsibleState.None, 'pass', 'info')];
            }
        } catch (err: any) {
            return [new ClusterNodeItem(`Error: ${err.message || 'Host unreachable'}`, vscode.TreeItemCollapsibleState.None, 'error', 'info')];
        }

        return [];
    }

    private fetchJson(urlStr: string): Promise<any> {
        return new Promise((resolve) => {
            const req = http.get(urlStr, { timeout: 3000 }, (res) => {
                if (res.statusCode !== 200) {
                    resolve(null);
                    return;
                }
                let rawData = '';
                res.on('data', chunk => rawData += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(rawData));
                    } catch {
                        resolve(null);
                    }
                });
            });
            req.on('error', () => resolve(null));
            req.on('timeout', () => {
                req.destroy();
                resolve(null);
            });
        });
    }
}

export class ClusterNodeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly iconName: string,
        public readonly category: 'category' | 'manager' | 'invoker' | 'task' | 'gauge' | 'action' | 'info' = 'info',
        public readonly invokerData?: InvokerNode,
        public readonly taskData?: ClusterTask
    ) {
        super(label, collapsibleState);
        this.iconPath = new vscode.ThemeIcon(iconName);
    }
}
