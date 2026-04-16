export interface User {
  id: string;
  shortId: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  isAdmin: boolean;
  createdAt: string;
}

export interface Message {
  id: string;
  content: string;
  userId: string;
  user: User;
  createdAt: string;
  channelId: string;
}

export interface PresenceUpdate {
  userId: string;
  online: boolean;
}

export type SocketEvents = {
  // Text
  'message:send': { content: string };
  'message:new': Message;
  'presence:update': PresenceUpdate;

  // Voice signaling
  'voice:join': void;
  'voice:leave': void;
  'voice:peers': { peers: string[] };
  'voice:offer': { to: string; sdp: RTCSessionDescriptionInit };
  'voice:answer': { to: string; sdp: RTCSessionDescriptionInit };
  'voice:ice': { to: string; candidate: RTCIceCandidateInit };
};
