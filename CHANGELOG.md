# Change Log

All notable changes to the "neuralforge" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

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
