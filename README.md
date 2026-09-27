<p align="center">
  <a href="https://linkedin.com/in/wisrovi-rodriguez"><img src="https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" alt="LinkedIn" /></a>
  <a href="https://wisrovi.dev"><img src="https://img.shields.io/badge/Author-wisrovi.dev-111827?style=for-the-badge&logo=google-chrome&logoColor=white" alt="Portal" /></a>
  <a href="https://orcid.org/0009-0005-0710-1861"><img src="https://img.shields.io/badge/ORCID-0009--0005--0710--1861-A6CE39?style=for-the-badge&logo=orcid&logoColor=white" alt="ORCID" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge" alt="License" /></a>
</p>

# NeuralForge Extension

![NeuralForge](media/readme.png)

This is the official VSCode Extension for the **train_service2** ecosystem. It integrates tightly with the NeuralForgeAI cluster through the local MCP Server, allowing you to monitor distributed ML workers, generate configuration YAMLs, and download trial artifacts directly from VSCode.

## Features

- **Cluster TreeView**: Monitor the active managers, invokers, and the current tasks queue.
- **Training Config Wizard**: An interactive webview to automatically generate NeuralForge-compatible `training.yaml` files.
- **Trial Artifacts Downloader**: Download and package all trial output files (EDA, models, reports) into a local `.zip` file from the MLflow Tracking Server.

## Architecture

This extension works as an MCP Client and depends on `wyoloservice2_mcp` running locally.

## License

This project follows the dual-licensing structure of the **train_service2** ecosystem:
- Open Source: AGPLv3
- Commercial: See `COMMERCIAL.md`

---

## 👤 Autor & Afiliación Oficial

* **William Steve Rodriguez Villamizar (Wisrovi)**
* **Cargo:** Principal AI Engineer & Applied AI Solutions Architect | Scientific Researcher
* 📧 **Email:** [wisrovi.rodriguez@gmail.com](mailto:wisrovi.rodriguez@gmail.com)
* 🌐 **Portal Oficial:** [wisrovi.dev](https://wisrovi.dev)
* 💼 **LinkedIn:** [wisrovi-rodriguez](https://www.linkedin.com/in/wisrovi-rodriguez/)
* 🆔 **ORCID:** [0009-0005-0710-1861](https://orcid.org/0009-0005-0710-1861)
* 📦 **PyPI:** [pypi.org/user/wisrovi/](https://pypi.org/user/wisrovi/)
* 🐙 **GitHub:** [@wisrovi](https://github.com/wisrovi)
