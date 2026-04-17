import axios from "axios";
import { io as Client } from "socket.io-client";
import { nanoid } from "nanoid";
import FormData from "form-data";
import { Readable } from "stream";

const API_URL = process.env.API_URL || "http://localhost:3000";
const SOCKET_URL = process.env.SOCKET_URL || "http://localhost:3000";
const CONCURRENCY = 20;

async function runScenario(id: number) {
  const email = `test_user_${id}@sori.io`;
  const password = "adminpassword123";
  const requestId = nanoid();

  try {
    console.log(`[User ${id}] 🔑 Stage 1: Auth...`);
    // Note: We might need to ensure these users exist or just use sori-admin for all (with rate limiters off for test)
    // For a real load test, we'd seed many users.
    const authRes = await axios.post(`${API_URL}/auth/login`, {
      email: "admin@sori.io", // Using seeded admin for simplicity in smoke/load
      password: "adminpassword123"
    }, {
      headers: { "X-Request-Id": requestId }
    });

    const token = (authRes.data as any).token;
    console.log(`[User ${id}] ✅ Auth Success.`);

    console.log(`[User ${id}] 🔌 Stage 2: Socket Connecting...`);
    const socket = Client(SOCKET_URL, {
      auth: { token, requestId }
    });

    await new Promise((resolve, reject) => {
      socket.on("connect", () => {
        console.log(`[User ${id}] 🔌 Socket Connected!`);
        resolve(true);
      });
      socket.on("connect_error", (err) => reject(err));
      setTimeout(() => reject(new Error("Socket Timeout")), 5000);
    });

    console.log(`[User ${id}] 💬 Stage 3: Sending Activity...`);
    socket.emit("typing", { channelId: "main", isTyping: true });
    
    console.log(`[User ${id}] 🎙️ Stage 4: Voice Join...`);
    socket.emit("join_voice_channel", "main-voice");

    console.log(`[User ${id}] 📁 Stage 5: MinIO Upload...`);
    const form = new FormData();
    const stream = Readable.from(["hello sori load test"]);
    form.append("file", stream, { filename: "test.txt", contentType: "text/plain" });

    await axios.post(`${API_URL}/upload`, form, {
      headers: { 
        ...form.getHeaders(),
        "Authorization": `Bearer ${token}`,
        "X-Request-Id": requestId 
      }
    });
    console.log(`[User ${id}] ✅ Upload Success.`);

    console.log(`[User ${id}] 🏥 Stage 6: Health Check...`);
    const health = await axios.get(`${API_URL}/health`);
    if ((health.data as any).status !== "ok") {
      console.warn(`[User ${id}] ⚠️ Health degraded:`, (health.data as any).services);
    }

    console.log(`[User ${id}] ✨ Scenario completed.`);
    socket.disconnect();

  } catch (err: any) {
    const errorData = err.response?.data || err.message;
    console.error(`[User ${id}] ❌ Failed:`, typeof errorData === 'object' ? JSON.stringify(errorData) : errorData);
  }
}

async function main() {
  console.log(`🚀 Starting Sori Load Test (${CONCURRENCY} users)`);
  const start = Date.now();
  
  const runners = Array.from({ length: CONCURRENCY }, (_, i) => runScenario(i));
  await Promise.all(runners);
  
  const duration = (Date.now() - start) / 1000;
  console.log(`\n🏁 Finished in ${duration.toFixed(2)}s`);
}

main().catch(console.error);
