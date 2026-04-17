import axios from "axios";
import { io } from "socket.io-client";

const API_URL = "http://localhost:3000";

async function test() {
  console.log("🚀 Starting Chat Verification Test...");

  try {
    // 1. Test Registration
    let token, user;
    try {
      console.log("📝 Registering test user...");
      const regRes = await axios.post(`${API_URL}/auth/register`, {
        username: "TestPilot",
        email: "test@sori.aether",
        password: "password123"
      });
      token = regRes.data.token;
      user = regRes.data.user;
      console.log(`✅ User registered: ${user.username} (ID: ${user.id})`);
    } catch (err) {
      if (err.response && err.response.status === 400) {
        console.log("ℹ️ User already exists. Attempting Login instead...");
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
          email: "test@sori.aether",
          password: "password123"
        });
        token = loginRes.data.token;
        user = loginRes.data.user;
        console.log(`✅ User logged in: ${user.username} (ID: ${user.id})`);
      } else {
        throw err;
      }
    }

    // 2. Test WebSocket Connection
    console.log(`🔌 Connecting to Sori Gateway at ${API_URL}...`);
    const socket = io(API_URL, {
      auth: { token },
      transports: ["websocket"] // Force WebSocket to avoid polling issues
    });

    socket.on("connect_error", (err) => {
      console.error("❌ WebSocket Connect Error:", err.message);
    });

    socket.on("connect", () => {
      console.log("✅ WebSocket Connected!");
      
      console.log("👥 Joining channel: main...");
      socket.emit("join_channel", "main");
      
      // Wait for server to process join
      setTimeout(() => {
        // 3. Send Message
        console.log("💬 Sending test message...");
        socket.emit("send_message", {
          channelId: "main",
          content: "Hello from the test script! 🚀"
        });
      }, 500);
    });

    // 4. Receive Message
    socket.on("new_message", (msg) => {
      console.log(`✅ Message Received: [${msg.username}] ${msg.content}`);
      process.exit(0);
    });

    // Timeout after 5s
    setTimeout(() => {
      console.error("❌ Test Timeout: No message received.");
      process.exit(1);
    }, 5000);

  } catch (err) {
    console.error("❌ Test Failed:", err.message);
    if (err.response) {
      console.error("Response data:", err.response.data);
      console.error("Response status:", err.response.status);
    }
    process.exit(1);
  }
}

test();
