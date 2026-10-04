export interface ClientToServerEvents {
  'room:join': (data: { groupId: string }, ack: (response: RoomJoinResponse) => void) => void;
  'room:leave': (data: { groupId: string }) => void;
  'sync:ping': (data: { t0: number }, ack: (response: { t0: number; ts: number }) => void) => void;
  'playback:play': (data: { groupId: string }) => void;
  'playback:pause': (data: { groupId: string; forEveryone: boolean }) => void;
  'playback:seek': (data: { groupId: string; positionMs: number }) => void;
  'playback:skip': (data: { groupId: string }) => void;
  'playback:ended': (data: { groupId: string; trackId: string; version: number }) => void;
  'playback:load-track': (data: { groupId: string; trackId: string }) => void;
  'playback:resync': (data: { groupId: string }) => void;
  'queue:add': (data: { groupId: string; trackId: string; playNext?: boolean }) => void;
  'queue:remove': (data: { groupId: string; queueItemId: string }) => void;
  'queue:reorder': (data: { groupId: string; queueItemId: string; newPosition: number }) => void;
  'reaction:send': (data: { groupId: string; emoji: string }) => void;
  'skipvote:cast': (data: { groupId: string }) => void;
  'presence:update': (data: { groupId: string; status: 'listening' | 'paused' | 'buffering' }) => void;
}

export interface ServerToClientEvents {
  'room:state': (data: RoomState) => void;
  'room:member-joined': (data: { member: MemberPresence }) => void;
  'room:member-left': (data: { userId: string }) => void;
  'playback:state': (data: PlaybackState) => void;
  'playback:admin-paused': (data: { pausedBy: string; pausedByName: string }) => void;
  'playback:admin-resumed': (data: { resumedBy: string; resumedByName: string }) => void;
  'queue:updated': (data: { queue: QueueItem[] }) => void;
  'reaction:received': (data: { userId: string; userName: string; emoji: string }) => void;
  'skipvote:updated': (data: { votesNeeded: number; currentVotes: number; voters: string[] }) => void;
  'skipvote:passed': () => void;
  'presence:updated': (data: { userId: string; status: 'listening' | 'paused' | 'buffering' }) => void;
  'error': (data: { message: string; code?: string }) => void;
}

export interface PlaybackState {
  trackId: string | null;
  isPlaying: boolean;
  positionMs: number;
  serverTimeMs: number;
  version: number;
  controlledBy: string | null;
  track?: TrackInfo;
}

export interface TrackInfo {
  id: string;
  title: string;
  artist: string;
  artworkUrl?: string;
  durationMs: number;
  streamUrl?: string;
  addedBy?: string;
  attribution?: string;
}

export interface MemberPresence {
  userId: string;
  displayName: string;
  avatarEmoji: string;
  avatarColor: string;
  role: string;
  status: 'listening' | 'paused' | 'buffering';
}

export interface RoomState {
  groupId: string;
  groupName: string;
  playback: PlaybackState;
  queue: QueueItem[];
  members: MemberPresence[];
  membersCanControl: boolean;
  myRole: string;
}

export interface QueueItem {
  id: string;
  trackId: string;
  title: string;
  artist: string;
  artworkUrl?: string;
  durationMs: number;
  addedBy: string;
  addedByName: string;
  position: number;
}

export interface RoomJoinResponse {
  success: boolean;
  error?: string;
  state?: RoomState;
}
