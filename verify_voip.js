import axios from "axios";

const API_URL = "http://127.0.0.1:3000";

async function testVoIP() {
  console.log("📞 Starting VoIP Token Verification Test...");

  try {
    // 1. Login
    console.log("📝 Logging in...");
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email: "test@sori.aether",
      password: "password123"
    });
    const { token } = loginRes.data;
    console.log("✅ Logged in successfully.");

    // 2. Request LiveKit Token
    console.log("🎟 Requesting LiveKit Token for room 'test-room'...");
    const voipRes = await axios.post(`${API_URL}/calls/token`, 
      { roomName: "test-room" },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (voipRes.data.token) {
      console.log("✅ LiveKit Token received!");
      console.log("🔑 Token prefix:", voipRes.data.token.substring(0, 20) + "...");
    } else {
      throw new Error("No token in response");
    }

  } catch (err) {
    console.error("❌ VoIP Test Failed:", err.response ? err.response.data : err.message);
    process.exit(1);
  }
}

testVoIP();
