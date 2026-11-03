# Change Log

All notable changes to the "neuralforge" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.0.7] - 2026-11-03
### Added
- **Dynamic CV Task Type Selector:** Added support to choose between Object Detection (`detect`), Instance Segmentation (`segment`), Image Classification (`classify`), Oriented Bounding Boxes (`obb`), and Pose Estimation (`pose`), dynamically recomputing official model architecture names and suffixes (`yolo26n-seg.pt`, `yolo26n-cls.pt`, `yolo26n-obb.pt`, `yolo26n-pose.pt`).
- **Single Run vs. Optuna Sweeper Mode:** Integrated interactive mode selector in Studio Hub allowing users to choose between single-trial runs or multi-trial Optuna Sweepers with configurable trial counts, samplers (`tpe`, `cmaes`), and target metrics.
- **Persistent Connection & Samba CIFS Settings:** Added collapsible configuration panel in Studio Hub to store and remember Manager API endpoints and remote Samba CIFS storage credentials safely in VS Code preferences.
- **Dual Launcher Actions:** Added buttons for both `Generate YAML Specification` (opens side-by-side in editor) and `Start Training on Cluster Directly`.
- **Context-Aware In-Editor YAML CodeLens:** Dynamically detects NeuralForge YAMLs and displays interactive buttons directly in the code editor:
  - `▷ Launch Training on Cluster`
  - `▷ View Status & Curves [<study_id>]` *(when active)*
  - `▤ Tail Logs`
  - `🛑 Cancel Study`
  - `👁 Mini-EDA Preview`
  - `✓ Validate Dataset Splits`

## [0.0.6] - 2026-11-03
### Added
- **NeuralForge Studio Interface Redesign:** Complete UX overhaul transitioning the extension from a sysadmin-centric console into a human-centric, 3-step ML practitioner studio.
- **🚀 Training Hub (Quick Start):** Intuitive entry-point view featuring guided launcher, pre-flight dataset checks, and real-time cluster readiness indicators.
- **Guided Training Studio Launcher (`neuralforge.guidedLaunch`):** Single-screen visual Webview for launching YOLO26/v8 distributed training with presets for datasets (Colorball, Traffic Signs, COCO128), model sizes (Nano, Small, Medium), and training scales (5-epoch quick test vs. 100/300-epoch full runs).
- **📋 My Experiments & Runs View (`neuralforgeExperiments`):** Dedicated live experiment tracker displaying active and queued studies, with one-click shortcuts to live loss curves, log tailing, and instant graceful cancellation.
- **🏆 Models & Results Gallery (`neuralforgeGallery`):** Practitioner-centric model hub offering 1-click downloads of trained weights (`best.pt`) directly into the active workspace, XAI Eigen-CAM attention heatmap reviews, and executive reports.
- **One-Click Workspace Weights Download (`neuralforge.downloadModelWeights`):** Directly saves `models/<study_id>_best.pt` into the workspace root.
- **Global Studio View Refresh (`neuralforge.refreshAllViews`):** Synchronizes training hub, experiments, gallery, and cluster telemetry simultaneously.

### Changed
- Reorganized sidebar hierarchy: technical cluster infrastructure, TDP wattage, and socket diagnostics are now neatly collapsed under `⚙️ Cluster Infrastructure (Advanced)`.

## [0.0.5] - 2026-11-03
### Added
- **1-Click Training Submission:** Submit training YAMLs directly to the cluster from the editor (`neuralforge.submitTraining`, `neuralforge.launchTraining`) with automatic queue priority selection and `study_id` injection.
- **Real-Time Live Log Streamer:** Dedicated output channel and polling stream (`neuralforge.streamLogs`) showing real-time executor container stdout, progress bars, and completion detection.
- **Task & Study Cancellation:** Interactive abort and cancel control (`neuralforge.cancelStudy`) directly from the Tasks tree or command palette.
- **Physical GPU Telemetry & Hardware Gauges:** Real-time VRAM allocation, GPU core load %, temperature (°C), wattage/TDP, and CPU/RAM display per invoker node in the Cluster tree.
- **Interactive MLflow Metrics & Loss Curves Explorer:** Standalone responsive Webview (`neuralforge.viewMetricsCurves`) charting training/validation loss curves (`train/box_loss`, `val/box_loss`) and metric progressions (`mAP50`, `mAP50-95`, `precision`).
- **Dataset Pre-flight Health Check:** Automated directory and split validator (`neuralforge.validateDataset`) checking images, labels, class balances, and `data.yaml` compliance.
- **Broadcast Docker Pull Synchronization:** One-click cluster-wide command (`neuralforge.triggerBroadcastPull`) dispatching `force_docker_pull` to all active GPU invokers.
- **Node Diagnostics & Docker Prune:** Remote socket diagnosis and disk cleanup utilities (`neuralforge.diagnoseNode`, `neuralforge.pruneNodeDocker`).

## [0.0.4] - 2026-11-03
### Changed
- Rendered architecture flowchart into high-resolution Retina image (`media/architecture.png`) to ensure visual rendering in VS Code Marketplace and extension details tab.

## [0.0.3] - 2026-11-03
### Added
- **XAI Heatmaps & Explainability Explorer:** Interactive VSCode Webview panel to inspect post-training Eigen-CAM / Grad-CAM visual heatmaps, Deletion AUC scores, and adversarial robustness metrics.
- **Next-Gen YOLO26 & Sweeper v2 Support:** Wizard updated with YOLO26 family (`yolo26n/s/m/l`), multi-task targets (`obb`, `pose`), Optuna samplers (`tpe`, `cmaes`), and post-training toggles.
- **Live Cluster API Connectivity:** `ClusterTreeProvider` and `celeryDashboard` now query live Kubernetes / Control Server telemetry endpoints instead of mock data.
- **Node Recommender & Duration Estimator:** Integrated cluster admin endpoints to estimate training time and select optimal GPU compute nodes.
- **Selective MLflow Artifact Downloader:** Added capability to retrieve specific assets (`best.pt`, `LLM_Report.docx`, heatmaps, or LaTeX tables) without downloading large zip archives.
- **Updated NeuralForge JSON Schema:** Full IntelliSense and schema validation for YOLO26 and post-train attributes.

## [0.0.2] - 2026-08-10
### Added
- Advanced validation and hyperparameter options for YAML Wizard (Optuna Sweeper integration)
- JSON Schema for NeuralForge configurations (YAML IntelliSense)
- Local Invoker Live Logs streaming viewer
- Local E2E testing command for Invoker nodes
- Global MLflow EDA & OpenCode report integration viewer
- Global WPipe scaffolding integration
- YAML CodeLens support for direct training launch and EDA preview
- Celery Task Manager interactive dashboard (Mission Control)

## [0.0.1] - 2026-08-01
- Initial release
