export const CLIENT_BOOTSTRAP_VERSION = 1 as const;

export interface ClientBootstrapPayload {
  version: typeof CLIENT_BOOTSTRAP_VERSION;
  server: {
    name: string;
    installMode: "single-community";
    defaultCommunityId: string;
  };
  endpoints: {
    web: string;
    api: string;
    ws: string;
    livekit: string;
    media: string;
    health: string;
  };
  auth: {
    mode: "cookie";
    loginPath: string;
    mePath: string;
    refreshPath: string;
    logoutPath: string;
  };
  realtime: {
    socketPath: string;
    transports: ["websocket"];
  };
  upload: {
    maxUploadSizeMb: number;
  };
  features: {
    directMessages: true;
    directCalls: true;
    voiceChannels: true;
    mediaUploads: true;
    multiCommunity: false;
  };
  generatedAt: string;
}
