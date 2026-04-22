<p align="center">
  <img src="docs/images/logo.png" width="120" alt="Sori Logo" />
</p>

<h1 align="center">Sori</h1>

<p align="center">
  <b>Real-time communication platform you actually control.</b><br/>
  Messaging. Voice. Infrastructure. All yours.
</p>

<p align="center">
  ⚡ Self-hosted • 🔒 Private • 🚀 Realtime
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-AGPL%20v3-blue.svg" />
  <img src="https://img.shields.io/badge/status-active-success.svg" />
  <img src="https://img.shields.io/badge/self--hosted-yes-important.svg" />
  <img src="https://img.shields.io/badge/docker-ready-blue.svg" />
  <img src="https://img.shields.io/badge/realtime-socket.io-orange.svg" />
</p>


SORI is a self-hosted communication platform that brings chat, voice, calls, media, and administration into a single system — fully under your control.

⸻

✨ What is SORI

SORI is designed as a single-server communication platform that combines:

* 💬 real-time messaging
* 🔊 voice channels
* 📞 direct and group calls
* 📎 file and media sharing
* 🛠 built-in admin panel

No external dependencies. No vendor lock-in. Just your infrastructure.

⸻

⚡ Features

* Real-time chat — fast messaging, reactions
* Voice & calls — powered by LiveKit for low latency
* Media uploads — S3-compatible storage (MinIO)
* Channels & direct messages — structured communication
* Admin panel — users, channels, storage, backups, telemetry
* Self-hosted — full ownership of your data and system

⸻

🧠 Architecture

SORI is built as a cohesive system of services:

* Frontend — React + Zustand
* Backend — Node.js + Hono
* Database — PostgreSQL
* Realtime — Socket.IO + Valkey
* Voice engine — LiveKit
* Object storage — MinIO (S3-compatible)
* Gateway — Caddy (routing + TLS)

👉 Everything runs via Docker.

⸻

🏗 Deployment Model

SORI is intentionally designed for simplicity:

* 🖥 Single-server deployment
* 🏠 Single default community
* 🔐 HTTPS-enabled setup
* ⚙️ Minimal infrastructure complexity

⸻

🌐 How It Works

One server → one URL → full system access:

* Web interface
* API
* WebSocket
* Voice services
* Media delivery

👉 Clients can automatically discover endpoints via a bootstrap API.

⸻

📦 Core Components

* Chat & messaging system
* Voice channels
* Direct call system (overlay → full workspace)
* File upload pipeline
* Admin panel
* Backup service

⸻

🔐 Configuration

SORI uses environment variables for configuration:

* database connection
* storage configuration
* voice service credentials
* public endpoints
* upload limits

👉 No insecure defaults — everything is explicit.

⸻

🧪 What’s Already Implemented

* stable real-time messaging
* voice and call lifecycle handling
* streaming uploads (no full file buffering)
* SSRF protections
* centralized routing via Caddy
* health checks and telemetry
* end-to-end smoke testing

⸻

🎯 Design Principles

SORI is built around:

* single server simplicity
* predictable architecture
* minimal hidden complexity
* full ownership and control
* self-host-first mindset

⸻

🚧 Status

SORI is under active development.

Current focus:

* stability and reliability
* simplified installation
* production readiness
* future native clients

⸻

🔮 Roadmap

* native desktop and mobile clients
* extended admin capabilities

⸻

🧑‍💻 Who It’s For

* private communities
* teams and small organizations
* self-hosting enthusiasts
* developers building internal communication systems

⸻

💡 Summary

SORI is more than a messaging tool.
It’s a complete communication platform you fully control.

_____

License

This project is licensed under the **GNU AGPL v3**.

You are free to use, modify, and deploy this software.  

However, if you run a modified version as a service, you must make the source code available.

See the [LICENSE](LICENSE) file for details.
