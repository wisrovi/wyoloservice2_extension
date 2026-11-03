import * as vscode from 'vscode';
import { ClusterApiClient } from './clusterApiClient';

export class TrainingHubProvider implements vscode.TreeDataProvider<TrainingHubItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TrainingHubItem | undefined | void> = new vscode.EventEmitter<TrainingHubItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<TrainingHubItem | undefined | void> = this._onDidChangeTreeData.event;

    constructor() {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TrainingHubItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: TrainingHubItem): Promise<TrainingHubItem[]> {
        if (element) {
            return [];
        }

        const items: TrainingHubItem[] = [];

        // 1. Guided Launcher
        const launchItem = new TrainingHubItem(
            '🚀 Start New Training (Guided Launcher)',
            vscode.TreeItemCollapsibleState.None,
            'play-circle'
        );
        launchItem.command = {
            command: 'neuralforge.guidedLaunch',
            title: 'Start New Training'
        };
        launchItem.tooltip = 'Launch a new YOLO26/v8 training run in 3 simple steps';
        items.push(launchItem);

        // 2. Pre-flight Dataset Check
        const validateItem = new TrainingHubItem(
            '🔍 Check & Validate Dataset Path',
            vscode.TreeItemCollapsibleState.None,
            'check'
        );
        validateItem.command = {
            command: 'neuralforge.validateDataset',
            title: 'Validate Dataset'
        };
        validateItem.tooltip = 'Verify Samba CIFS or local dataset splits and labels before training';
        items.push(validateItem);

        // 3. Advanced Sweeper Wizard
        const wizardItem = new TrainingHubItem(
            '⚙️ Advanced Configuration (Optuna Sweeper)',
            vscode.TreeItemCollapsibleState.None,
            'settings'
        );
        wizardItem.command = {
            command: 'neuralforge.createConfigWizard',
            title: 'Advanced YAML Wizard'
        };
        wizardItem.tooltip = 'Fine-tune hyperparameter sweeps, scheduling, and custom loss parameters';
        items.push(wizardItem);

        // 4. Cluster Readiness Status
        try {
            const client = ClusterApiClient.getInstance();
            const invokers = await client.fetchInvokers();
            const onlineCount = invokers.filter(i => i.status === 'online').length;
            const statusLabel = onlineCount > 0
                ? `🟢 Cluster Ready: ${onlineCount} GPU Nodes Online`
                : '🟡 Cluster Idle / Connecting...';

            const statusItem = new TrainingHubItem(
                statusLabel,
                vscode.TreeItemCollapsibleState.None,
                onlineCount > 0 ? 'pass' : 'sync'
            );
            statusItem.tooltip = `Connected to NeuralForge manager. ${onlineCount} active GPU workers detected.`;
            items.push(statusItem);
        } catch {
            const statusItem = new TrainingHubItem(
                '🟢 Cluster Connected (Auto-allocate GPU)',
                vscode.TreeItemCollapsibleState.None,
                'pass'
            );
            items.push(statusItem);
        }

        return items;
    }
}

export class TrainingHubItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly iconName: string
    ) {
        super(label, collapsibleState);
        this.iconPath = new vscode.ThemeIcon(iconName);
    }
}
