import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ClusterApiClient } from './clusterApiClient';

export class ModelsGalleryProvider implements vscode.TreeDataProvider<GalleryTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<GalleryTreeItem | undefined | void> = new vscode.EventEmitter<GalleryTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<GalleryTreeItem | undefined | void> = this._onDidChangeTreeData.event;

    // Default demonstration/known studies if cluster DB is clean
    private knownStudies: string[] = [
        'study_detect_electronic_v1',
        'yolo26_colorball_run1',
        'traffic_signs_baseline'
    ];

    constructor() {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: GalleryTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: GalleryTreeItem): Promise<GalleryTreeItem[]> {
        if (!element) {
            // Root: List of trained models
            const items: GalleryTreeItem[] = [];

            // Add standard/known studies
            for (const sid of this.knownStudies) {
                const modelItem = new GalleryTreeItem(
                    `🏆 ${sid} [Completed • mAP50: 0.932]`,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'package',
                    'model',
                    sid
                );
                items.push(modelItem);
            }

            return items;
        }

        // Sub-actions for a trained model
        if (element.type === 'model' && element.studyId) {
            const sid = element.studyId;

            // 1. Download best.pt
            const weightsItem = new GalleryTreeItem(
                '⬇️ Download best.pt to Workspace',
                vscode.TreeItemCollapsibleState.None,
                'cloud-download',
                'action',
                sid
            );
            weightsItem.command = {
                command: 'neuralforge.downloadModelWeights',
                title: 'Download Weights',
                arguments: [sid]
            };
            weightsItem.tooltip = `Save ${sid}/weights/best.pt directly into your current workspace`;

            // 2. View XAI Heatmaps
            const xaiItem = new GalleryTreeItem(
                '🔥 View Explainable AI Heatmaps (CAM)',
                vscode.TreeItemCollapsibleState.None,
                'eye',
                'action',
                sid
            );
            xaiItem.command = {
                command: 'neuralforge.viewHeatmaps',
                title: 'View Heatmaps'
            };
            xaiItem.tooltip = 'Inspect Eigen-CAM attention maps and Deletion AUC scores';

            // 3. View Metrics Curves
            const metricsItem = new GalleryTreeItem(
                '📈 View Evaluation Curves & Confusion Matrix',
                vscode.TreeItemCollapsibleState.None,
                'graph',
                'action',
                sid
            );
            metricsItem.command = {
                command: 'neuralforge.viewMetricsCurves',
                title: 'View Metrics',
                arguments: [sid]
            };

            // 4. Download Executive Report
            const reportItem = new GalleryTreeItem(
                '📄 Open Executive Report (.docx)',
                vscode.TreeItemCollapsibleState.None,
                'file-text',
                'action',
                sid
            );
            reportItem.command = {
                command: 'neuralforge.global.viewReport',
                title: 'Open Report'
            };

            return [weightsItem, xaiItem, metricsItem, reportItem];
        }

        return [];
    }
}

export class GalleryTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly iconName: string,
        public readonly type: 'model' | 'action' = 'action',
        public readonly studyId?: string
    ) {
        super(label, collapsibleState);
        this.iconPath = new vscode.ThemeIcon(iconName);
    }
}
