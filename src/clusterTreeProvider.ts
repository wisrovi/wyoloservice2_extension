import * as vscode from 'vscode';
import * as http from 'http';

export class ClusterTreeProvider implements vscode.TreeDataProvider<ClusterNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<ClusterNode | undefined | void> = new vscode.EventEmitter<ClusterNode | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<ClusterNode | undefined | void> = this._onDidChangeTreeData.event;

    private controlHost: string = '192.168.10.252';
    private controlPort: number = 23442;

    constructor() {
        const config = vscode.workspace.getConfiguration('neuralforge');
        this.controlHost = config.get<string>('controlHost', '192.168.10.252');
        this.controlPort = config.get<number>('controlPort', 23442);
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ClusterNode): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ClusterNode): Promise<ClusterNode[]> {
        if (!element) {
            // Root categories
            return [
                new ClusterNode('Managers', vscode.TreeItemCollapsibleState.Expanded, 'organization'),
                new ClusterNode('Invokers (GPU Nodes)', vscode.TreeItemCollapsibleState.Expanded, 'server-environment'),
                new ClusterNode('Tasks & Sweeps Queue', vscode.TreeItemCollapsibleState.Expanded, 'list-ordered')
            ];
        }

        try {
            if (element.label === 'Managers') {
                const health = await this.fetchJson(`http://${this.controlHost}:${this.controlPort}/health`);
                if (health && health.status === 'ok') {
                    const redisStatus = health.redis === 'connected' ? 'Redis OK' : 'Redis Alert';
                    return [
                        new ClusterNode(`NAS_Train_service (${this.controlHost}) [Online • ${redisStatus}]`, vscode.TreeItemCollapsibleState.None, 'server')
                    ];
                }
                return [new ClusterNode(`NAS_Train_service (${this.controlHost}) [Offline]`, vscode.TreeItemCollapsibleState.None, 'error')];
            } 
            
            if (element.label === 'Invokers (GPU Nodes)') {
                const workersData = await this.fetchJson(`http://${this.controlHost}:${this.controlPort}/workers`);
                const nodes: ClusterNode[] = [];
                if (workersData && workersData.workers) {
                    for (const [wname, info] of Object.entries(workersData.workers)) {
                        const ip = Array.isArray(info) && info.length > 0 ? info[0] : wname;
                        if (ip !== 'managers' && !wname.includes('NAS')) {
                            nodes.push(new ClusterNode(`${wname} (${ip}) [Active GPU Worker]`, vscode.TreeItemCollapsibleState.None, 'vm-active'));
                        }
                    }
                }
                return nodes.length > 0 ? nodes : [new ClusterNode('No active GPU invokers found', vscode.TreeItemCollapsibleState.None, 'warning')];
            } 
            
            if (element.label === 'Tasks & Sweeps Queue') {
                const tasksData = await this.fetchJson(`http://${this.controlHost}:${this.controlPort}/tasks`);
                const taskNodes: ClusterNode[] = [];
                if (tasksData) {
                    const running = tasksData.running || [];
                    const pending = tasksData.pending || [];

                    for (const t of running) {
                        const tname = t.name || t.id || 'Task';
                        taskNodes.push(new ClusterNode(`[RUNNING] ${tname} on ${t.worker || 'node'}`, vscode.TreeItemCollapsibleState.None, 'play-circle'));
                    }
                    for (const p of pending) {
                        const pname = p.name || p.id || 'Task';
                        taskNodes.push(new ClusterNode(`[QUEUED] ${pname}`, vscode.TreeItemCollapsibleState.None, 'clock'));
                    }
                }
                return taskNodes.length > 0 ? taskNodes : [new ClusterNode('No active or queued tasks (Cluster idle)', vscode.TreeItemCollapsibleState.None, 'pass')];
            }
        } catch (err: any) {
            return [new ClusterNode(`Connection error: ${err.message || 'Host unreachable'}`, vscode.TreeItemCollapsibleState.None, 'error')];
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

export class ClusterNode extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly iconName: string
    ) {
        super(label, collapsibleState);
        this.iconPath = new vscode.ThemeIcon(iconName);
    }
}
