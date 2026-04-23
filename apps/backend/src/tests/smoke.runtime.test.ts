import https from "node:https";
import { randomUUID } from "node:crypto";
import dns from "node:dns";
import axios from "axios";
import FormData from "form-data";
import { io, Socket } from "socket.io-client";
import { expect, test } from "vitest";

const BACKEND_URL = process.env.SORI_SMOKE_BACKEND_URL || "https://sori-backend.sori.orb.local";
const WEB_ORIGIN = process.env.SORI_SMOKE_WEB_ORIGIN || "https://sori-web.sori.orb.local";
const COMMUNITY_ID = process.env.SORI_SMOKE_COMMUNITY_ID || "default-community";
const ADMIN_LOGIN = process.env.SORI_SMOKE_ADMIN_LOGIN || "admin";
const ADMIN_PASSWORD = process.env.SORI_SMOKE_ADMIN_PASSWORD || "12345";

const soriHostnameSuffix = ".sori.orb.local";

const soriLookup: NonNullable<https.AgentOptions["lookup"]> = (hostname, options, callback) => {
  const lookupOptions = typeof options === "function" ? {} : options ?? {};
  const lookupCallback = (typeof options === "function" ? options : callback) as any;

  if (!lookupCallback) {
    return;
  }

  if (hostname.endsWith(soriHostnameSuffix)) {
    if ((lookupOptions as any).all) {
      lookupCallback(null, [{ address: "127.0.0.1", family: 4 }]);
      return;
    }

    lookupCallback(null, "127.0.0.1", 4);
    return;
  }

  dns.lookup(hostname, lookupOptions as any, lookupCallback);
};

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  lookup: soriLookup,
});

interface Session {
  client: ReturnType<typeof axios.create>;
  cookie: string;
  token: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
}

interface ProvisionedUser {
  id: string;
  email: string;
  password: string;
}

interface ChannelInfo {
  id: string;
  name: string;
  type: "text" | "voice";
}

function createHttpClient(cookie?: string) {
  return axios.create({
    baseURL: BACKEND_URL,
    httpsAgent,
    validateStatus: () => true,
    headers: {
      Origin: WEB_ORIGIN,
      ...(cookie ? { Cookie: cookie } : {}),
    },
  } as any);
}

function extractCookie(setCookieHeader: string[] | undefined) {
  const rawCookie = setCookieHeader?.find((cookie) => cookie.startsWith("sori_auth="));
  if (!rawCookie) {
    throw new Error("sori_auth cookie was not returned by /auth/login");
  }

  return rawCookie.split(";")[0];
}

function extractToken(cookie: string) {
  const match = cookie.match(/sori_auth=([^;]+)/);
  if (!match) {
    throw new Error("Failed to extract JWT token from sori_auth cookie");
  }

  return match[1];
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor<T>(
  action: () => Promise<T>,
  predicate: (value: T) => boolean,
  options?: { timeoutMs?: number; intervalMs?: number; description?: string },
) {
  const timeoutMs = options?.timeoutMs ?? 10000;
  const intervalMs = options?.intervalMs ?? 250;
  const startedAt = Date.now();
  let lastValue: T | null = null;

  while (Date.now() - startedAt < timeoutMs) {
    lastValue = await action();
    if (predicate(lastValue)) {
      return lastValue;
    }
    await delay(intervalMs);
  }

  throw new Error(`Timed out waiting for ${options?.description || "condition"}${lastValue ? `; last value: ${JSON.stringify(lastValue)}` : ""}`);
}

function waitForSocketEvent<T>(
  socket: Socket,
  eventName: string,
  predicate?: (payload: T) => boolean,
  timeoutMs = 10000,
) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for socket event "${eventName}"`));
    }, timeoutMs);

    const onEvent = (payload: T) => {
      if (!predicate || predicate(payload)) {
        cleanup();
        resolve(payload);
      }
    };

    const onConnectError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const cleanup = () => {
      clearTimeout(timer);
      socket.off(eventName, onEvent);
      socket.off("connect_error", onConnectError);
    };

    socket.on(eventName, onEvent);
    socket.on("connect_error", onConnectError);
  });
}

function expectNoSocketEvent<T>(
  socket: Socket,
  eventName: string,
  predicate?: (payload: T) => boolean,
  timeoutMs = 5000,
) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, timeoutMs);

    const onEvent = (payload: T) => {
      if (!predicate || predicate(payload)) {
        cleanup();
        reject(new Error(`Unexpected socket event "${eventName}" received`));
      }
    };

    const cleanup = () => {
      clearTimeout(timer);
      socket.off(eventName, onEvent);
    };

    socket.on(eventName, onEvent);
  });
}

async function login(loginName: string, password: string): Promise<Session> {
  const client = createHttpClient();
  const response = await client.post("/auth/login", {
    email: loginName,
    password,
  });

  expect(response.status).toBe(200);
  const loginData = response.data as any;
  expect(loginData?.user?.id).toBeTruthy();

  const cookie = extractCookie(response.headers["set-cookie"] as string[] | undefined);
  const token = extractToken(cookie);
  const authenticatedClient = createHttpClient(cookie);

  const meResponse = await authenticatedClient.get("/auth/me");
  expect(meResponse.status).toBe(200);
  const meData = meResponse.data as any;

  return {
    client: authenticatedClient,
    cookie,
    token,
    user: meData.user,
  };
}

async function createTemporaryUser(admin: Session, prefix: string): Promise<ProvisionedUser> {
  const email = `${prefix}-${randomUUID()}@sori.local`;
  const response = await admin.client.post("/admin/users", { email });

  expect(response.status).toBe(200);
  const responseData = response.data as any;
  expect(responseData?.user?.id).toBeTruthy();
  expect(responseData?.temporaryPassword).toBeTruthy();

  return {
    id: responseData.user.id,
    email,
    password: responseData.temporaryPassword,
  };
}

async function connectSocket(session: Session, label: string) {
  const socket = io(BACKEND_URL, {
    transports: ["websocket"],
    forceNew: true,
    rejectUnauthorized: false,
    agent: httpsAgent as any,
    lookup: soriLookup as any,
    extraHeaders: {
      Origin: WEB_ORIGIN,
    },
    auth: {
      token: session.token,
      requestId: `smoke-${label}-${Date.now()}`,
    },
  } as any);

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out connecting socket for ${label}`));
    }, 10000);

    const onReady = () => {
      cleanup();
      resolve();
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const cleanup = () => {
      clearTimeout(timer);
      socket.off("socket_ready", onReady);
      socket.off("connect_error", onError);
    };

    socket.once("socket_ready", onReady);
    socket.once("connect_error", onError);
  });

  return socket;
}

test("runtime smoke gate against deployed Sori stack", async () => {
  let adminSession: Session | null = null;
  let userAProvisioned: ProvisionedUser | null = null;
  let userBProvisioned: ProvisionedUser | null = null;
  let userASession: Session | null = null;
  let userBSession: Session | null = null;
  const sockets: Socket[] = [];

  try {
    adminSession = await login(ADMIN_LOGIN, ADMIN_PASSWORD);

    const [healthResponse, backendDiscoveryResponse, webDiscoveryResponse, statsResponse, callsResponse, backupsResponse] = await Promise.all([
      axios.get(`${BACKEND_URL}/admin/health`, {
        httpsAgent,
        validateStatus: () => true,
      } as any),
      axios.get(`${BACKEND_URL}/.well-known/sori/client.json`, {
        httpsAgent,
        validateStatus: () => true,
      } as any),
      axios.get(`${WEB_ORIGIN}/.well-known/sori/client.json`, {
        httpsAgent,
        validateStatus: () => true,
      } as any),
      adminSession.client.get("/admin/stats"),
      adminSession.client.get("/admin/calls"),
      adminSession.client.get("/admin/backup"),
    ]);
    const healthData = healthResponse.data as any;
    const backendDiscoveryData = backendDiscoveryResponse.data as any;
    const webDiscoveryData = webDiscoveryResponse.data as any;
    const statsData = statsResponse.data as any;
    const callsData = callsResponse.data as any;
    const backupsData = backupsResponse.data as any;

    expect(healthResponse.status).toBe(200);
    expect(healthData?.backend).toBe("online");
    expect(backendDiscoveryResponse.status).toBe(200);
    expect(webDiscoveryResponse.status).toBe(200);
    expect(backendDiscoveryData?.server?.installMode).toBe("single-community");
    expect(backendDiscoveryData?.server?.defaultCommunityId).toBe(COMMUNITY_ID);
    expect(backendDiscoveryData?.endpoints?.api).toBe(BACKEND_URL);
    expect(backendDiscoveryData?.endpoints?.web).toBe(WEB_ORIGIN);
    expect(typeof backendDiscoveryData?.endpoints?.livekit).toBe("string");
    expect(webDiscoveryData?.endpoints?.api).toBe(BACKEND_URL);
    expect(webDiscoveryData?.endpoints?.web).toBe(WEB_ORIGIN);
    expect(statsResponse.status).toBe(200);
    expect(typeof statsData?.totalUsers).toBe("number");
    expect(callsResponse.status).toBe(200);
    expect(Array.isArray(callsData)).toBe(true);
    expect(backupsResponse.status).toBe(200);
    expect(backupsData).toBeTruthy();

    userAProvisioned = await createTemporaryUser(adminSession, "smoke-a");
    userBProvisioned = await createTemporaryUser(adminSession, "smoke-b");

    userASession = await login(userAProvisioned.email, userAProvisioned.password);
    userBSession = await login(userBProvisioned.email, userBProvisioned.password);

    const [channelsResponse, userSearchResponse] = await Promise.all([
      userASession.client.get(`/communities/${COMMUNITY_ID}/channels`),
      userASession.client.get(`/users/search?q=${userBSession!.user.username.slice(0, 2)}`),
    ]);
    const channelsData = channelsResponse.data as any[];
    const userSearchData = userSearchResponse.data as any[];

    expect(channelsResponse.status).toBe(200);
    expect(Array.isArray(channelsData)).toBe(true);
    expect(userSearchResponse.status).toBe(200);
    expect(userSearchData.some((entry: any) => entry.id === userBSession?.user.id)).toBe(true);
    expect(userSearchData.some((entry: any) => entry.id === userASession!.user.id)).toBe(false);

    const textChannel = (channelsData as ChannelInfo[]).find((channel) => channel.type === "text");
    const voiceChannel = (channelsData as ChannelInfo[]).find((channel) => channel.type === "voice");

    expect(textChannel?.id).toBeTruthy();
    expect(voiceChannel?.id).toBeTruthy();

    const socketA = await connectSocket(userASession, "user-a");
    const socketB = await connectSocket(userBSession, "user-b");
    sockets.push(socketA, socketB);
    await delay(500);

    const uploadFile = async (fileName: string, contents: string) => {
      const uploadForm = new FormData();
      uploadForm.append("file", Buffer.from(contents), {
        filename: fileName,
        contentType: "text/plain",
      });

      const uploadResponse = await userASession!.client.post("/upload", uploadForm, {
        headers: uploadForm.getHeaders(),
        maxBodyLength: Infinity,
      } as any);

      expect(uploadResponse.status).toBe(200);
      expect((uploadResponse.data as any)?.attachment?.fileUrl).toContain("sori-media.sori.orb.local");
      return uploadResponse.data as any;
    };

    const uploadData = await uploadFile(`smoke-${Date.now()}-1.txt`, "sori smoke upload one");
    const secondUploadData = await uploadFile(`smoke-${Date.now()}-2.txt`, "sori smoke upload two");

    const channelMessageText = `smoke-channel-${randomUUID()}`;
    const expectedChannelEvent = waitForSocketEvent<any>(
      socketB,
      "new_message",
      (payload) => payload?.channelId === textChannel?.id && payload?.content === channelMessageText,
    );

    const channelPostResponse = await userASession.client.post(`/channels/${textChannel!.id}/messages`, {
      content: channelMessageText,
      attachments: [uploadData.attachment, secondUploadData.attachment],
    });
    const channelPostData = channelPostResponse.data as any;

    expect(channelPostResponse.status).toBe(200);
    expect(channelPostData?.attachment?.fileName).toBe(uploadData.attachment.fileName);
    expect(channelPostData?.attachments).toHaveLength(2);
    expect(channelPostData?.attachments?.[1]?.fileName).toBe(secondUploadData.attachment.fileName);

    const channelEvent = await expectedChannelEvent;
    expect(channelEvent.attachment?.fileName).toBe(uploadData.attachment.fileName);
    expect(channelEvent.attachments).toHaveLength(2);

    const conversationResponse = await userASession.client.post("/dm/conversations", {
      targetUserId: userBSession.user.id,
    });
    const conversationData = conversationResponse.data as any;

    expect(conversationResponse.status).toBe(200);
    const conversationId = conversationData?.id;
    expect(conversationId).toBeTruthy();

    const directMessageText = `smoke-dm-${randomUUID()}`;
    const expectedDirectMessageEvent = waitForSocketEvent<any>(
      socketB,
      "new_direct_message",
      (payload) => payload?.conversationId === conversationId && payload?.content === directMessageText,
    );

    const directMessageResponse = await userASession.client.post(`/dm/conversations/${conversationId}/messages`, {
      content: directMessageText,
      attachments: [uploadData.attachment, secondUploadData.attachment],
    });
    const directMessageData = directMessageResponse.data as any;

    expect(directMessageResponse.status).toBe(200);
    expect(directMessageData.attachments).toHaveLength(2);
    const directMessageEvent = await expectedDirectMessageEvent;
    expect(directMessageEvent.attachments).toHaveLength(2);

    const unreadConversation = await waitFor(
      async () => {
        const response = await userBSession!.client.get("/dm/conversations");
        expect(response.status).toBe(200);
        return (response.data as any[]).find((conversation: any) => conversation.id === conversationId);
      },
      (conversation) => typeof conversation?.unreadCount === "number" && conversation.unreadCount > 0,
      { description: "DM unread count to increment" },
    );

    expect(unreadConversation.unreadCount).toBeGreaterThan(0);

    const readResponse = await userBSession.client.post(`/dm/conversations/${conversationId}/read`);
    expect(readResponse.status).toBe(200);

    const clearedConversation = await waitFor(
      async () => {
        const response = await userBSession!.client.get("/dm/conversations");
        expect(response.status).toBe(200);
        return (response.data as any[]).find((conversation: any) => conversation.id === conversationId);
      },
      (conversation) => conversation?.unreadCount === 0,
      { description: "DM unread count to reset" },
    );

    expect(clearedConversation.unreadCount).toBe(0);

    const voiceTokenResponse = await userASession.client.post("/calls/token", {
      channelId: voiceChannel!.id,
    });
    const voiceTokenData = voiceTokenResponse.data as any;

    expect(voiceTokenResponse.status).toBe(200);
    expect(typeof voiceTokenData?.token).toBe("string");

    const voiceJoinEvent = waitForSocketEvent<any>(
      socketB,
      "voice_occupants_update",
      (payload) => payload?.channelId === voiceChannel!.id && payload?.occupants?.some((occupant: any) => occupant.userId === userASession!.user.id),
    );
    const socketAVoice = await connectSocket(userASession, "user-a-voice");
    sockets.push(socketAVoice);
    socketAVoice.emit("join_voice_channel", voiceChannel!.id);
    await voiceJoinEvent;

    const voiceLeaveOnDisconnect = waitForSocketEvent<any>(
      socketB,
      "voice_occupants_update",
      (payload) => payload?.channelId === voiceChannel!.id && !payload?.occupants?.some((occupant: any) => occupant.userId === userASession!.user.id),
      10000,
    );
    socketAVoice.disconnect();
    await voiceLeaveOnDisconnect;

    const incomingCall = waitForSocketEvent<any>(socketB, "incoming_call");
    const outgoingCallFromCaller = waitForSocketEvent<any>(socketA, "outgoing_call_started");
    socketA.emit("direct_call_initiate", { targetUserId: userBSession.user.id });

    const [incomingCallPayload, outgoingCallPayload] = await Promise.all([incomingCall, outgoingCallFromCaller]);
    expect(incomingCallPayload.callId).toBe(outgoingCallPayload.callId);

    const callId = incomingCallPayload.callId as string;
    expect(callId).toBeTruthy();

    const acceptedByCaller = waitForSocketEvent<any>(socketA, "call_accepted", (payload) => payload?.callId === callId);
    const acceptedByCallee = waitForSocketEvent<any>(socketB, "call_accepted", (payload) => payload?.callId === callId);
    socketB.emit("direct_call_accept", { callId });
    await Promise.all([acceptedByCaller, acceptedByCallee]);

    const [callerTokenResponse, calleeTokenResponse] = await Promise.all([
      userASession.client.post("/calls/token", { callId }),
      userBSession.client.post("/calls/token", { callId }),
    ]);

    expect(callerTokenResponse.status).toBe(200);
    expect(calleeTokenResponse.status).toBe(200);

    const adminCallActive = await waitFor(
      async () => {
        const response = await adminSession!.client.get("/admin/calls");
        expect(response.status).toBe(200);
        return (response.data as any[]).find((entry: any) => entry.id === callId);
      },
      (entry) => entry?.status === "active" && entry?.isActive === true,
      { timeoutMs: 10000, description: "active direct call to appear in admin telemetry" },
    );

    expect(adminCallActive.status).toBe("active");

    const noEndedDuringReconnect = expectNoSocketEvent<any>(
      socketA,
      "call_ended",
      (payload) => payload?.callId === callId,
      6000,
    );

    socketB.disconnect();
    await delay(1500);

    const socketBReconnected = await connectSocket(userBSession, "user-b-reconnect");
    sockets.push(socketBReconnected);

    await noEndedDuringReconnect;

    const activeAfterReconnect = await waitFor(
      async () => {
        const response = await adminSession!.client.get("/admin/calls");
        expect(response.status).toBe(200);
        return (response.data as any[]).find((entry: any) => entry.id === callId);
      },
      (entry) => entry?.status === "active" && entry?.isActive === true,
      { timeoutMs: 10000, description: "direct call to stay active after reconnect" },
    );

    expect(activeAfterReconnect.status).toBe("active");

    const endedForCaller = waitForSocketEvent<any>(
      socketA,
      "call_ended",
      (payload) => payload?.callId === callId,
      30000,
    );
    socketBReconnected.disconnect();
    await endedForCaller;

    const adminCallsAfterEnd = await waitFor(
      async () => {
        const response = await adminSession!.client.get("/admin/calls");
        expect(response.status).toBe(200);
        return (response.data as any[]).find((entry: any) => entry.id === callId);
      },
      (entry) => entry?.status === "ended" && entry?.isActive === false,
      { timeoutMs: 15000, description: "ended direct call to appear in admin telemetry" },
    );

    expect(adminCallsAfterEnd.status).toBe("ended");

    expect((await userASession.client.post("/auth/logout")).status).toBe(200);
    expect((await userBSession.client.post("/auth/logout")).status).toBe(200);
  } finally {
    sockets.forEach((socket) => {
      if (socket.connected) {
        socket.disconnect();
      } else {
        socket.close();
      }
    });

    if (adminSession && userAProvisioned) {
      await adminSession.client.delete(`/admin/users/${userAProvisioned.id}`);
    }
    if (adminSession && userBProvisioned) {
      await adminSession.client.delete(`/admin/users/${userBProvisioned.id}`);
    }
  }
}, 180000);
