import * as vscode from 'vscode';

export class ClusterTreeProvider implements vscode.TreeDataProvider<ClusterNode> {
	private _onDidChangeTreeData: vscode.EventEmitter<ClusterNode | undefined | void> = new vscode.EventEmitter<ClusterNode | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<ClusterNode | undefined | void> = this._onDidChangeTreeData.event;

	constructor() {}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: ClusterNode): vscode.TreeItem {
		return element;
	}

	getChildren(element?: ClusterNode): Thenable<ClusterNode[]> {
		if (element) {
			if (element.label === 'Managers') {
				return Promise.resolve([
					new ClusterNode('NAS_Train_service (Online)', vscode.TreeItemCollapsibleState.None, 'server')
				]);
			} else if (element.label === 'Invokers') {
				return Promise.resolve([
					new ClusterNode('Invoker_192.168.1.10 (Active)', vscode.TreeItemCollapsibleState.None, 'vm-active'),
					new ClusterNode('Invoker_192.168.1.11 (Active)', vscode.TreeItemCollapsibleState.None, 'vm-active')
				]);
			} else if (element.label === 'Tasks Queue') {
				return Promise.resolve([
					new ClusterNode('Task: detect_arepo (Running)', vscode.TreeItemCollapsibleState.None, 'play-circle'),
					new ClusterNode('Task: segment_base (Pending)', vscode.TreeItemCollapsibleState.None, 'clock')
				]);
			}
			return Promise.resolve([]);
		} else {
			// Root items
			return Promise.resolve([
				new ClusterNode('Managers', vscode.TreeItemCollapsibleState.Expanded, 'organization'),
				new ClusterNode('Invokers', vscode.TreeItemCollapsibleState.Expanded, 'server-environment'),
				new ClusterNode('Tasks Queue', vscode.TreeItemCollapsibleState.Expanded, 'list-ordered')
			]);
		}
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
