// ============================================================
// Neural Forge — src/StudyRoom.tsx
// Collaborative study rooms over WebSocket.
// Real-time presence, grind pings, task sync, XP celebrate.
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import { C, F } from "../tokens";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Member { user_id: string; name: string; xp: number; joined: string; }
interface RoomEvent { type: string; user_id?: string; name?: string; content?: string; platform?: string; problem?: string; xp?: number; event?: string; emoji?: string; task_name?: string; done?: boolean; ts: string; }

// ── Helpers ───────────────────────────────────────────────────────────────────
const row  = (gap = 8): React.CSSProperties => ({ display:"flex", alignItems:"center", gap });
const col_ = (gap = 14): React.CSSProperties => ({ display:"flex", flexDirection:"column", gap });
const btn  = (col: string, sm?: boolean): React.CSSProperties => ({
  background:`${col}1a`, border:`1px solid ${col}55`, color:col,
  padding:sm?"5px 11px":"9px 18px", borderRadius:7, cursor:"pointer",
  fontFamily:F.display, fontSize:sm?11:13, fontWeight:700, letterSpacing:1.2,
  display:"inline-flex", alignItems:"center", gap:5, whiteSpace:"nowrap",
  textTransform:"uppercase", transition:"all 0.18s",
});
const tag  = (col: string): React.CSSProperties => ({
  padding:"2px 9px", borderRadius:4, background:`${col}1e`, color:col,
  fontSize:11, fontWeight:700, fontFamily:F.display, whiteSpace:"nowrap",
});
const card = (col?: string): React.CSSProperties => ({
  background: col ? `linear-gradient(135deg,${C.surface},${col}0a)` : C.surface,
  border:`1px solid ${col?col+"33":C.border}`, borderRadius:12, padding:20,
});

const getWSBase = () => {
  if (typeof window === "undefined") return "ws://localhost:7731/collab/ws";
  const base = window.location.origin.replace(/^http/, "ws");
  return base + "/collab/ws";
};
const getHTTPBase = () => {
  if (typeof window === "undefined") return "http://localhost:7731/collab";
  return window.location.origin + "/collab";
};

// ── Mock data for dev/preview ─────────────────────────────────────────────────
const MOCK_ROOMS = [
  { room_id:"ml-grind",   name:"ML Grind Room",   topic:"Daily LeetCode + deepml.com", members:3, full:false },
  { room_id:"paper-club", name:"Paper Club",       topic:"Reading: Flash Attention 2",  members:1, full:false },
  { room_id:"kaggle-team",name:"Kaggle Team Alpha",topic:"Titanic extended features",   members:5, full:false },
];

export default function StudyRoom() {
  const [rooms,       setRooms]       = useState(MOCK_ROOMS);
  const [activeRoom,  setActiveRoom]  = useState<string | null>(null);
  const [roomName,    setRoomName]    = useState("");
  const [topic,       setTopic]       = useState("");
  const [ws,          setWs]          = useState<WebSocket | null>(null);
  const [members,     setMembers]     = useState<Member[]>([]);
  const [events,      setEvents]      = useState<RoomEvent[]>([]);
  const [chatInput,   setChatInput]   = useState("");
  const [connected,   setConnected]   = useState(false);
  const [userName]    = useState("You");
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${getHTTPBase()}/rooms`).then(r => r.json()).then(setRooms).catch(() => {});
  }, []);

  useEffect(() => {
    feedRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [events]);

  const joinRoom = useCallback((roomId: string, name: string) => {
    const socket = new WebSocket(`${getWSBase()}/${roomId}?user_id=local&name=${encodeURIComponent(userName)}`);
    socket.onopen = () => { setConnected(true); setActiveRoom(roomId); setRoomName(name); };
    socket.onmessage = e => {
      try {
        const msg: RoomEvent = JSON.parse(e.data);
        if (msg.type === "room_state" && (msg as any).members) {
          setMembers((msg as any).members);
        } else if (msg.type === "member_joined" || msg.type === "member_left") {
          setMembers((msg as any).members ?? []);
          setEvents(prev => [...prev, msg]);
        } else {
          setEvents(prev => [...prev, msg]);
        }
      } catch (err) {
        console.error("Failed to parse WebSocket message:", err);
      }
    };
    socket.onclose  = () => { setConnected(false); setActiveRoom(null); setWs(null); };
    socket.onerror  = () => { setConnected(false); };
    setWs(socket);
    // Simulate join for dev mode
    setTimeout(() => {
      setConnected(true);
      setMembers([
        { user_id:"local", name:"You", xp:0, joined:new Date().toISOString() },
        { user_id:"alice", name:"Alice", xp:180, joined:new Date().toISOString() },
        { user_id:"bob",   name:"Bob",   xp:90,  joined:new Date().toISOString() },
      ]);
      setEvents([{ type:"system", content:`Joined "${name}"`, ts:new Date().toISOString() }]);
    }, 400);
  }, [userName]);

  const leaveRoom = () => {
    ws?.close();
    setConnected(false); setActiveRoom(null); setRoomName(""); setMembers([]); setEvents([]); setWs(null);
  };

  const send = (type: string, payload: object) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, ...payload }));
    }
    // Dev mode: echo locally
    setEvents(prev => [...prev, { type, user_id:"local", name:"You", ts:new Date().toISOString(), ...payload } as RoomEvent]);
  };

  const sendChat = () => {
    if (!chatInput.trim()) return;
    send("chat", { content: chatInput.trim() });
    setChatInput("");
  };

  const createRoom = async () => {
    if (!roomName.trim()) return;
    const id = roomName.toLowerCase().replace(/\s+/g, "-").slice(0, 20);
    try {
      await fetch(`${getHTTPBase()}/rooms`, { method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ room_id:id, name:roomName.trim(), topic:topic.trim() }) });
      setRooms(r => [...r, { room_id:id, name:roomName.trim(), topic:topic.trim(), members:0, full:false }]);
    } catch (err) {
      console.error("Failed to create room:", err);
      setRooms(r => [...r, { room_id:id, name:roomName.trim(), topic:topic.trim(), members:0, full:false }]);
    }
    joinRoom(id, roomName.trim());
    setRoomName(""); setTopic("");
  };

  // ── Active room view ───────────────────────────────────────────────────────
  if (activeRoom) {
    return (
      <div style={{ display:"flex", height:"calc(100vh - 56px)", gap:14 }}>
        {/* Chat/event feed */}
        <div style={{ flex:1, ...col_(0), overflow:"hidden" }}>
          {/* Header */}
          <div style={{ ...row(), justifyContent:"space-between", marginBottom:14, flexShrink:0, flexWrap:"wrap", gap:8 }}>
            <div>
              <div style={{ fontFamily:F.mono, color:C.green, fontSize:10, letterSpacing:4, marginBottom:4 }}>// STUDY ROOM</div>
              <div style={{ fontFamily:F.display, fontSize:22, fontWeight:700, letterSpacing:2 }}>{roomName}</div>
            </div>
            <div style={row(8)}>
              <div style={{ ...row(6), padding:"7px 12px", borderRadius:9, background:`${C.green}18`, border:`1px solid ${C.green}44` }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:C.green, boxShadow:`0 0 6px ${C.green}`, animation:"pulse 2s ease-in-out infinite" }} />
                <span style={{ fontFamily:F.mono, fontSize:10, color:C.green }}>{members.length} online</span>
              </div>
              <button onClick={leaveRoom} style={{ ...btn(C.red, true) }}>✕ Leave</button>
            </div>
          </div>

          {/* Quick actions */}
          <div style={{ ...row(8), flexWrap:"wrap", marginBottom:12, flexShrink:0 }}>
            <button onClick={() => send("grind_ping", { platform:"LeetCode", problem:"Two Sum", xp:50 })}
              style={{ ...btn(C.gold, true) }}>⚔ Ping Grind +50</button>
            <button onClick={() => send("celebrate", { event:"Skill leveled up!", xp:200, emoji:"⭐" })}
              style={{ ...btn(C.purple, true) }}>⭐ Celebrate</button>
            <button onClick={() => send("task_update", { task_name:"Review transformers paper", done:true })}
              style={{ ...btn(C.green, true) }}>✓ Task Done</button>
          </div>

          {/* Event feed */}
          <div style={{ flex:1, overflow:"auto", ...col_(0), gap:6, padding:4 }}>
            {events.map((ev, i) => <FeedEvent key={i} ev={ev} />)}
            {events.length === 0 && (
              <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:C.muted, fontFamily:F.body, fontSize:13 }}>
                Joined. Start chatting or ping your grind!
              </div>
            )}
            <div ref={feedRef} />
          </div>

          {/* Chat input */}
          <div style={{ ...row(10), marginTop:12, flexShrink:0 }}>
            <input
              style={{ flex:1, background:C.surface2, border:`1px solid ${chatInput?C.green+"55":C.border}`, borderRadius:9, padding:"10px 14px", color:C.text, fontFamily:F.body, fontSize:14, outline:"none", transition:"all 0.2s" }}
              placeholder="Message the room… (Enter to send)"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key==="Enter") sendChat(); }}
            />
            <button onClick={sendChat} disabled={!chatInput.trim()}
              style={{ ...btn(C.green), padding:"12px 18px", opacity:!chatInput.trim()?0.4:1 }}>
              ⏎
            </button>
          </div>
        </div>

        {/* Members panel */}
        <div style={{ width:200, ...col_(10), flexShrink:0 }}>
          <div style={{ fontFamily:F.display, fontSize:10, color:C.muted, letterSpacing:2 }}>MEMBERS</div>
          {members.map(m => (
            <div key={m.user_id} style={{ ...card(C.green), padding:"12px 14px" }}>
              <div style={{ ...row(8) }}>
                <div style={{ width:28, height:28, borderRadius:"50%", background:`${C.green}22`, border:`1.5px solid ${C.green}55`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:F.display, fontSize:13, color:C.green, fontWeight:700, flexShrink:0 }}>
                  {m.name[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontFamily:F.display, fontSize:12, fontWeight:600, color:m.user_id==="local"?C.green:C.text }}>{m.name}</div>
                  {m.xp > 0 && <div style={{ fontFamily:F.mono, fontSize:9, color:C.gold }}>+{m.xp} XP</div>}
                </div>
              </div>
            </div>
          ))}
          <div style={{ fontFamily:F.display, fontSize:10, color:C.muted, letterSpacing:2, marginTop:8 }}>ROOM INFO</div>
          <div style={{ ...card(), padding:"12px 14px" }}>
            <div style={{ fontFamily:F.body, fontSize:12, color:C.muted, lineHeight:1.7 }}>{MOCK_ROOMS.find(r=>r.room_id===activeRoom)?.topic || ""}</div>
          </div>
        </div>
      </div>
    );
  }

  // ── Room browser ───────────────────────────────────────────────────────────
  return (
    <div style={col_()}>
      <div>
        <div style={{ fontFamily:F.mono, color:C.green, fontSize:10, letterSpacing:4, marginBottom:4 }}>// COLLAB</div>
        <div style={{ fontFamily:F.display, fontSize:26, fontWeight:700, letterSpacing:3, textTransform:"uppercase" }}>Study Rooms</div>
      </div>
      <div style={{ fontFamily:F.body, fontSize:13, color:C.muted, lineHeight:1.8 }}>
        Study with others on your LAN. Share grind pings, celebrate level-ups, and stay accountable in real time.
      </div>

      {/* Create room */}
      <div style={card(C.green)}>
        <div style={{ fontFamily:F.display, fontSize:11, color:C.green, letterSpacing:2, fontWeight:700, marginBottom:12 }}>⊕ CREATE ROOM</div>
        <div style={{ ...row(10), flexWrap:"wrap" }}>
          <input style={{ flex:1, minWidth:150, background:C.surface2, border:`1px solid ${roomName?C.green+"55":C.border}`, borderRadius:7, padding:"9px 12px", color:C.text, fontFamily:F.body, fontSize:13, outline:"none" }}
            placeholder="Room name…" value={roomName} onChange={e => setRoomName(e.target.value)} />
          <input style={{ flex:2, minWidth:180, background:C.surface2, border:`1px solid ${C.border}`, borderRadius:7, padding:"9px 12px", color:C.text, fontFamily:F.body, fontSize:13, outline:"none" }}
            placeholder="Topic (optional)…" value={topic} onChange={e => setTopic(e.target.value)} />
          <button onClick={createRoom} disabled={!roomName.trim()} style={{ ...btn(C.green), opacity:!roomName.trim()?0.4:1 }}>
            Create & Join
          </button>
        </div>
      </div>

      {/* Room list */}
      <div style={{ fontFamily:F.display, fontSize:10, color:C.muted, letterSpacing:2 }}>ACTIVE ROOMS ({rooms.length})</div>
      {rooms.map(r => (
        <div key={r.room_id} style={{ ...card(C.green), display:"flex", alignItems:"center", gap:14, padding:"16px 20px" }}>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:F.display, fontSize:15, fontWeight:700, color:C.text, marginBottom:4, letterSpacing:0.5 }}>{r.name}</div>
            {r.topic && <div style={{ fontFamily:F.body, fontSize:12, color:C.muted }}>{r.topic}</div>}
          </div>
          <div style={row(10)}>
            <span style={{ ...tag(C.green), fontSize:12 }}>👥 {r.members}</span>
            <button
              onClick={() => joinRoom(r.room_id, r.name)}
              disabled={r.full}
              style={{ ...btn(r.full?C.muted:C.green), opacity:r.full?0.35:1 }}>
              {r.full?"Full":"Join →"}
            </button>
          </div>
        </div>
      ))}

      {rooms.length === 0 && (
        <div style={{ padding:48, textAlign:"center", fontFamily:F.body, fontSize:13, color:C.muted }}>
          No rooms yet. Create one and invite teammates on your LAN.
        </div>
      )}
    </div>
  );
}

// ── Feed event renderer ───────────────────────────────────────────────────────
function FeedEvent({ ev }: { ev: RoomEvent }) {
  const time = ev.ts ? new Date(ev.ts).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }) : "";

  if (ev.type === "system") return (
    <div style={{ fontFamily:F.mono, fontSize:10, color:C.muted, textAlign:"center", padding:"4px 0", letterSpacing:1 }}>
      — {ev.content} —
    </div>
  );
  if (ev.type === "member_joined") return (
    <div style={{ fontFamily:F.body, fontSize:11, color:C.green, textAlign:"center" }}>
      {ev.name} joined the room
    </div>
  );
  if (ev.type === "member_left") return (
    <div style={{ fontFamily:F.body, fontSize:11, color:C.muted, textAlign:"center" }}>
      {ev.name} left
    </div>
  );
  if (ev.type === "grind_ping") return (
    <div style={{ background:`${C.gold}12`, border:`1px solid ${C.gold}33`, borderRadius:9, padding:"10px 14px", display:"flex", gap:10, alignItems:"flex-start" }}>
      <span style={{ fontSize:16 }}>⚔</span>
      <div>
        <div style={{ fontFamily:F.display, fontSize:11, color:C.gold, fontWeight:700, letterSpacing:1 }}>{ev.name} solved on {ev.platform}</div>
        <div style={{ fontFamily:F.body, fontSize:12, color:C.text2, marginTop:2 }}>{ev.problem}</div>
        {ev.xp && <div style={{ fontFamily:F.mono, fontSize:10, color:C.gold, marginTop:4 }}>+{ev.xp} XP</div>}
      </div>
      <div style={{ marginLeft:"auto", fontFamily:F.mono, fontSize:9, color:C.muted }}>{time}</div>
    </div>
  );
  if (ev.type === "celebrate") return (
    <div style={{ background:`${C.purple}12`, border:`1px solid ${C.purple}33`, borderRadius:9, padding:"10px 14px", display:"flex", gap:10, alignItems:"center" }}>
      <span style={{ fontSize:22 }}>{ev.emoji || "⭐"}</span>
      <div style={{ flex:1 }}>
        <div style={{ fontFamily:F.display, fontSize:12, color:C.purple, fontWeight:700 }}>{ev.name}: {ev.event}</div>
        {ev.xp && <div style={{ fontFamily:F.mono, fontSize:10, color:C.gold }}>+{ev.xp} XP</div>}
      </div>
    </div>
  );
  if (ev.type === "task_update") return (
    <div style={{ fontFamily:F.body, fontSize:12, color:ev.done?C.green:C.muted, display:"flex", alignItems:"center", gap:8 }}>
      <span>{ev.done?"✓":"○"}</span>
      <strong style={{ color:C.text }}>{ev.name}</strong> {ev.done?"completed":"updated"}: {ev.task_name}
    </div>
  );
  if (ev.type === "chat") return (
    <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
      <div style={{ width:26, height:26, borderRadius:"50%", background:`${C.accent}22`, border:`1px solid ${C.accent}44`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:F.display, fontSize:11, color:C.accent, flexShrink:0 }}>
        {(ev.name || "?")[0].toUpperCase()}
      </div>
      <div>
        <div style={{ fontFamily:F.display, fontSize:11, color:C.accent, fontWeight:700, marginBottom:3 }}>{ev.name} <span style={{ fontFamily:F.mono, fontSize:9, color:C.muted }}>{time}</span></div>
        <div style={{ fontFamily:F.body, fontSize:13, color:C.text, lineHeight:1.7 }}>{ev.content}</div>
      </div>
    </div>
  );
  return null;
}
