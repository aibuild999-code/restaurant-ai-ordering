import { NextRequest } from "next/server";

export const RESTAURANT_ID = "58b007f7-c3ed-420a-aab3-36fc8b979dc9";

export function isVoiceAgentAuthorized(request: NextRequest) {
  const configuredSecret = process.env.VOICE_AGENT_SECRET;
  if (!configuredSecret) return false;

  const suppliedSecret = request.headers.get("x-voice-agent-secret");
  return suppliedSecret === configuredSecret;
}
