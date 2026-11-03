import * as vscode from 'vscode';
import { ClusterApiClient, ClusterTask } from './clusterApiClient';

export class ExperimentsProvider implements vscode.TreeDataProvider<ExperimentTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ExperimentTreeItem | undefined | void> = new vscode.EventEmitter<ExperimentTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<ExperimentTreeItem | undefined | void> = this._onDidChangeTreeData.event;

    constructor() {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ExperimentTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ExperimentTreeItem): Promise<ExperimentTreeItem[]> {
        const client = ClusterApiClient.getInstance();

        if (!element) {
            try {
                const tasksData = await client.fetchTasks();
                const items: ExperimentTreeItem[] = [];

                // Running studies
                for (const t of tasksData.running) {
                    const sid = t.study_id || t.id || t.name || 'Active Study';
                    const worker = t.worker ? `on ${t.worker}` : '';
                    const runItem = new ExperimentTreeItem(
                        `🟢 [RUNNING] ${sid} ${worker}`,
                        vscode.TreeItemCollapsibleState.Expanded,
                        'play-circle',
                        'running',
                        sid
                    );
                    items.push(runItem);
                }

                // Queued studies
                for (const p of tasksData.pending) {
                    const pid = p.study_id || p.id || p.name || 'Queued Study';
                    const queuedItem = new ExperimentTreeItem(
                        `🟡 [QUEUED] ${pid} (${p.priority || 'medium'} priority)`,
                        vscode.TreeItemCollapsibleState.None,
                        'clock',
                        'queued',
                        pid
                    );
                    items.push(queuedItem);
                }

                if (items.length > 0) {
                    return items;
                }

                return [
                    new ExperimentTreeItem(
                        'No active experiments running right now',
                        vscode.TreeItemCollapsibleState.None,
                        'info',
                        'empty'
                    )
                ];
            } catch (err: any) {
                return [
                    new ExperimentTreeItem(
                        `Connection status: ${err.message || 'Connecting to cluster...'}`,
                        vscode.TreeItemCollapsibleState.None,
                        'warning',
                        'empty'
                    )
                ];
            }
        }

        // Sub-actions under a running experiment
        if (element.type === 'running' && element.studyId) {
            const sid = element.studyId;

            const curvesAction = new ExperimentTreeItem(
                '📊 View Live Loss & Metrics Curves',
                vscode.TreeItemCollapsibleState.None,
                'graph',
                'action',
                sid
            );
            curvesAction.command = {
                command: 'neuralforge.viewMetricsCurves',
                title: 'View Curves',
                arguments: [sid]
            };

            const logsAction = new ExperimentTreeItem(
                '📜 Tail Real-Time Logs',
                vscode.TreeItemCollapsibleState.None,
                'output',
                'action',
                sid
            );
            logsAction.command = {
                command: 'neuralforge.streamLogs',
                title: 'Stream Logs',
                arguments: [sid]
            };

            const stopAction = new ExperimentTreeItem(
                '🛑 Stop / Abort Experiment',
                vscode.TreeItemCollapsibleState.None,
                'circle-slash',
                'action',
                sid
            );
            stopAction.command = {
                command: 'neuralforge.cancelStudy',
                title: 'Cancel Study',
                arguments: [sid]
            };

            return [curvesAction, logsAction, stopAction];
        }

        return [];
    }
}

export class ExperimentTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly iconName: string,
        public readonly type: 'running' | 'queued' | 'completed' | 'action' | 'empty' = 'empty',
        public readonly studyId?: string
    ) {
        super(label, collapsibleState);
        this.iconPath = new vscode.ThemeIcon(iconName);
    }
}
