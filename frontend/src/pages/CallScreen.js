import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { CallPeer, getUserStream } from "../lib/webrtc";
import { useAuth } from "../context/AuthContext";
import { wsUrl, api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, Phone, X } from "lucide-react";
import { toast } from "sonner";

/**
 * Call screen used by:
 *  - Kiosk (caller, no auth): connects via /api/ws-kiosk/{call_id}, target = answering resident user_id
 *  - Resident (callee, auth): connects via /api/ws/{user_id} using its access_token, target = "kiosk:{call_id}"
 */
export default function CallScreen() {
  const { callId } = useParams();
  const [params] = useSearchParams();
  const role = params.get("role") || "callee"; // "caller" | "callee"
  const visitor = params.get("visitor") || "Visitor";
  const navigate = useNavigate();
  const { user } = useAuth();

  const [status, setStatus] = useState(role === "caller" ? "ringing" : "incoming");
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [remoteUserId, setRemoteUserId] = useState(null); // resident id for kiosk
  const localRef = useRef(null);
  const remoteRef = useRef(null);
  const wsRef = useRef(null);
  const peerRef = useRef(null);
  const reconnect = useRef(null);

  function getMyId() {
    return role === "caller" ? `kiosk:${callId}` : user?.id;
  }

  function getTargetForCaller() {
    return remoteUserId; // set when callee sends "accept" with from
  }

  function sendSignal(target, payload) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ to: target, ...payload }));
  }

  async function attachLocal() {
    try {
      const stream = await getUserStream({ video: true, audio: true });
      if (localRef.current) localRef.current.srcObject = stream;
      return stream;
    } catch (e) {
      toast.error("Camera/Mic permission required");
      throw e;
    }
  }

  async function startWebRTC(targetId, asCaller) {
    const peer = new CallPeer({
      isCaller: asCaller,
      signal: (msg) => sendSignal(targetId, msg),
      onRemoteStream: (stream) => { if (remoteRef.current) remoteRef.current.srcObject = stream; },
      onClose: () => { /* keep status, let user end */ },
    });
    peerRef.current = peer;
    const stream = await attachLocal();
    await peer.attachLocalStream(stream);
    if (asCaller) await peer.createOffer();
  }

  // Connect WebSocket
  useEffect(() => {
    let cancelled = false;
    async function connect() {
      let url;
      if (role === "caller") {
        url = wsUrl(`/api/ws-kiosk/${callId}`);
      } else {
        if (!user || !user.access_token) {
          // wait for auth
          return;
        }
        url = wsUrl(`/api/ws/${user.id}?token=${encodeURIComponent(user.access_token)}`);
      }
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onmessage = async (ev) => {
        let msg; try { msg = JSON.parse(ev.data); } catch { return; }
        // residents receive incoming_call & might be already on this page
        if (msg.type === "call_accept") {
          // caller side gets this: target was resident, store remote id
          setStatus("connected");
          setRemoteUserId(msg.from);
          await startWebRTC(msg.from, true);
        } else if (msg.type === "call_reject" || msg.type === "call_end") {
          setStatus(msg.type === "call_reject" ? "rejected" : "ended");
          cleanup();
        } else if (msg.type === "offer" || msg.type === "answer" || msg.type === "ice") {
          if (peerRef.current) await peerRef.current.handleSignal(msg);
        } else if (msg.type === "call_status") {
          // kiosk listens here for server-confirmed accept/reject too
          if (msg.status === "rejected") { setStatus("rejected"); cleanup(); }
          if (msg.status === "ended") { setStatus("ended"); cleanup(); }
        }
      };
      ws.onclose = () => {
        wsRef.current = null;
        if (!cancelled && (status === "ringing" || status === "incoming" || status === "connected")) {
          reconnect.current = setTimeout(connect, 1500);
        }
      };
      ws.onerror = () => { try { ws.close(); } catch { /* noop */ } };
    }
    connect();
    return () => {
      cancelled = true;
      if (reconnect.current) clearTimeout(reconnect.current);
      if (wsRef.current) { try { wsRef.current.close(); } catch { /* noop */ } }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, callId, user?.id, user?.access_token]);

  function cleanup() {
    if (peerRef.current) { peerRef.current.destroy(); peerRef.current = null; }
    if (localRef.current?.srcObject) {
      localRef.current.srcObject.getTracks().forEach((t) => t.stop());
      localRef.current.srcObject = null;
    }
  }

  async function accept() {
    try {
      await api.post("/calls/action", { call_id: callId, action: "accept" });
      // send accept signal to kiosk so caller can start offer toward us
      sendSignal(`kiosk:${callId}`, { type: "call_accept" });
      // wait for the offer; meanwhile prepare local stream
      const peer = new CallPeer({
        isCaller: false,
        signal: (msg) => sendSignal(`kiosk:${callId}`, msg),
        onRemoteStream: (stream) => { if (remoteRef.current) remoteRef.current.srcObject = stream; },
        onClose: () => { /* noop */ },
      });
      peerRef.current = peer;
      const stream = await attachLocal();
      await peer.attachLocalStream(stream);
      setStatus("connected");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Accept failed");
    }
  }

  async function reject() {
    try {
      if (role === "callee") {
        await api.post("/calls/action", { call_id: callId, action: "reject" });
      }
      sendSignal(role === "callee" ? `kiosk:${callId}` : "", { type: "call_reject" });
    } catch { /* noop */ }
    setStatus("rejected");
    cleanup();
    setTimeout(() => navigate(role === "callee" ? "/resident" : "/kiosk", { replace: true }), 1200);
  }

  async function end() {
    try {
      if (role === "callee") {
        await api.post("/calls/action", { call_id: callId, action: "end" });
      }
      const target = role === "callee" ? `kiosk:${callId}` : remoteUserId;
      if (target) sendSignal(target, { type: "call_end" });
    } catch { /* noop */ }
    setStatus("ended");
    cleanup();
    setTimeout(() => navigate(role === "callee" ? "/resident" : "/kiosk", { replace: true }), 1200);
  }

  function toggleMute() {
    if (!localRef.current?.srcObject) return;
    const stream = localRef.current.srcObject;
    stream.getAudioTracks().forEach((t) => (t.enabled = muted)); // if currently muted, re-enable
    setMuted((m) => !m);
  }
  function toggleVideo() {
    if (!localRef.current?.srcObject) return;
    const stream = localRef.current.srcObject;
    stream.getVideoTracks().forEach((t) => (t.enabled = videoOff)); // toggle
    setVideoOff((v) => !v);
  }

  // For caller: start camera immediately so they have a local preview while ringing
  useEffect(() => {
    if (role === "caller") {
      attachLocal().catch(() => { /* handled */ });
    }
    return () => { if (status !== "connected") cleanup(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden" data-testid="call-screen">
      {/* Remote video */}
      <video ref={remoteRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
      {!remoteRef.current?.srcObject && (
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-b from-zinc-900 to-black">
          <div className="text-center">
            <div className="text-xs uppercase tracking-[0.3em] text-white/60 mb-2" data-testid="call-status">{
              status === "ringing" ? "Ringing…" :
              status === "incoming" ? "Incoming call" :
              status === "connected" ? "Connecting video…" :
              status === "rejected" ? "Call declined" :
              status === "ended" ? "Call ended" : status
            }</div>
            <div className="font-display text-5xl">{visitor}</div>
            {status === "ringing" && (
              <div className="mt-6 inline-block relative">
                <div className="pulse-ring relative size-24 rounded-full bg-accent grid place-items-center">
                  <Phone />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Local PIP */}
      <video ref={localRef} autoPlay muted playsInline
             className="absolute bottom-32 right-6 w-40 sm:w-56 rounded-xl border border-white/20 bg-black/50 z-20" />

      {/* Gradient scrim */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 p-5 flex items-center justify-between z-30">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-white/60">FastVi Call</div>
          <div className="font-display text-2xl">{visitor}</div>
        </div>
        <Button variant="ghost" className="text-white" onClick={end} data-testid="call-close"><X /></Button>
      </div>

      {/* Bottom controls — glassmorphism */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30">
        <div className="glass-dark rounded-full px-6 py-4 flex items-center gap-4">
          {role === "callee" && status === "incoming" && (
            <>
              <Button onClick={reject} variant="destructive" className="rounded-full size-14" data-testid="call-reject"><PhoneOff /></Button>
              <Button onClick={accept} className="rounded-full size-14 bg-emerald-500 hover:bg-emerald-600 text-white" data-testid="call-accept"><Phone /></Button>
            </>
          )}
          {(status === "connected" || status === "ringing") && (
            <>
              <Button variant="ghost" className="rounded-full size-12 text-white hover:bg-white/10" onClick={toggleMute} data-testid="call-mute">{muted ? <MicOff/> : <Mic/>}</Button>
              <Button variant="ghost" className="rounded-full size-12 text-white hover:bg-white/10" onClick={toggleVideo} data-testid="call-video">{videoOff ? <VideoOff/> : <VideoIcon/>}</Button>
              <Button onClick={end} variant="destructive" className="rounded-full size-14" data-testid="call-end"><PhoneOff /></Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
