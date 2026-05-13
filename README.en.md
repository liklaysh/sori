<p align="center">
  <img src="docs/images/logo.png" width="120" />
</p>

<h1 align="center">Sori</h1>

<p align="center">
  <b>Self-hosted communication platform you actually control.</b><br/>
  Chat • Voice • Calls • Media • Admin — in one system
</p>

<p align="center">
  <a href="./README.md">Home</a> · <a href="./README.ru.md">🇷🇺 Русский</a> · 🇬🇧 English
</p>

---

## ✨ What is SORI

SORI is a self-hosted communication platform that brings messaging, voice, calls, media, and administration into a single unified system.

It is designed to replace fragmented tools with one controlled environment:

💬 real-time messaging  
🔊 voice channels  
📞 direct and group calls  
📎 file and media sharing  
🛠 built-in admin panel  

No external services. No vendor lock-in.  
Just your infrastructure, fully under your control.

---

## 📸 Preview

<p align="center">
  <img src="./docs/images/login.png" width="800"/>
  <br/>
  <i>Login</i>
</p>

<p align="center">
  <img src="./docs/images/chat.png" width="800"/>
  <br/>
  <i>Chat</i>
</p>

<p align="center">
  <img src="./docs/images/call.png" width="800"/>
  <br/>
  <i>Calls</i>
</p>

<p align="center">
  <img src="./docs/images/admin.png" width="800"/>
  <br/>
  <i>Admin</i>
</p>

---

## ⚡ Features

- Real-time chat — fast messaging, reactions, live updates  
- Voice & calls — powered by LiveKit for low-latency communication  
- Media uploads — S3-compatible storage via MinIO  
- Channels & direct messages — structured communication model  
- Admin panel — manage users, channels, and system state  
- Self-hosted — full ownership of data and infrastructure  

---

## 🧠 Architecture

| Layer | Stack | Role |
|------|------|------|
| **Frontend** | React 18 + Vite + Zustand | Interface & real-time UI |
| **Backend** | Node.js + Hono | API & core logic |
| **Database** | PostgreSQL + Drizzle | Data persistence |
| **Realtime** | Socket.IO + Valkey | Events & presence |
| **Voice** | LiveKit | Calls & voice channels |
| **Storage** | MinIO | Media & files |
| **Gateway** | Caddy | Routing & TLS |

👉 Docker-based unified system.

---

## 🌍 Localization

SORI supports multiple languages out of the box:

- 🇬🇧 English  
- 🇷🇺 Russian  

The interface is fully localized and can be extended with additional languages.

---

## 🧭 Versioning

SORI stores the product version in the root `VERSION` file. The backend exposes runtime version metadata at `/api/system/version`:

- `version` — the product version of the system.
- `apiVersion` — the API contract version for web, desktop, and future mobile clients.
- `buildId` — the build identifier. By default it matches the short git commit hash deployed through install/update/deploy.
- `commit` — the short git commit hash of the backend build.

---

## 🏗 Deployment Model

SORI is designed to be as simple as possible:

- 🖥 Single-server deployment  
- 🌐 One domain → full system access  
- 🔐 Automatic HTTPS via Caddy  
- ⚙️ Minimal infrastructure requirements  

All components run as one unified stack, making it easy to deploy and maintain.

---

## 🚀 Install

On a clean Ubuntu 22.04+ server:

```bash
curl -fsSL https://github.com/liklaysh/sori/raw/main/install.sh | sudo bash
```

The script asks for the domain, Let's Encrypt email, server name, and firewall settings.

Update an installed server:

```bash
curl -fsSL https://github.com/liklaysh/sori/raw/main/update.sh | sudo bash
```

Full guide: [install.md](install.md).

---

## 🧑‍💻 Who It’s For

- Private communities  
- Teams and small organizations  
- Self-hosting enthusiasts  
- Developers building internal communication systems  

---

## 💡 Summary

SORI is not just a chat app.

It’s a complete communication platform that you fully control — from data to infrastructure.

____

## 📄 License

This project is licensed under the **GNU AGPL v3**.

You are free to use, modify, and deploy this software.  
If you run a modified version as a service, you must make the source code available.

See the [LICENSE](LICENSE) file for details.

____

## 🤝 Contributors

- [@EchoRiteMusic](https://github.com/EchoRiteMusic) — Sound Design (notifications, call events, UI feedback)

---

## 💜 Support the Project

SORI is developed as an independent self-hosted project. I build it myself, including with the help of AI tools, while bringing practical understanding of how communication systems should work in real operations and product environments through my professional background.

If the project has been useful to you or you want to support further development, you can do it in any convenient way.

BTC: `bc1qk5d9nfrp3xcjeckpzl0qap2cftay3aa899ysk5`  
YooMoney: [https://yoomoney.ru/fundraise/1HO46GGNSHV.260513](https://yoomoney.ru/fundraise/1HO46GGNSHV.260513)  
CloudTips: [https://pay.cloudtips.ru/p/eb410a45](https://pay.cloudtips.ru/p/eb410a45)  
Boosty: coming soon
