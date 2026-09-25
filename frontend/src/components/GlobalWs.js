import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { wsUrl } from "../lib/api";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Bell, PhoneIncoming } from "lucide-react";

const MAX_WS_ATTEMPTS = 5;

/**
 * Persistent WebSocket. Receives incoming_call notifications for residents,
 * and forwards WebRTC signaling messages by attaching `window.__fastviWs` &
 * a global event emitter via `window.__fastviSignalHandler`.
 */
export function GlobalWs() {
  const { user } = useAuth();
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const attemptsRef = useRef(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !user.access_token) return undefined;
    let cancelled = false;
    attemptsRef.current = 0;

    function connect() {
      if (cancelled) return;
      if (attemptsRef.current >= MAX_WS_ATTEMPTS) return; // give up quietly
      attemptsRef.current += 1;

      let ws;
      try {
        const url = wsUrl(`/api/ws/${user.id}?token=${encodeURIComponent(user.access_token)}`);
        ws = new WebSocket(url);
      } catch {
        return;
      }
      wsRef.current = ws;
      window.__fastviWs = ws;

      ws.onopen = () => { attemptsRef.current = 0; };
      ws.onmessage = (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch { return; }
        if (msg.type === "incoming_call" && user.role === "resident") {
          toast(`Incoming call from ${msg.visitor_name}`, {
            description: `Unit ${msg.unit_number || ""}`,
            icon: <PhoneIncoming size={16} />,
            action: {
              label: "Answer",
              onClick: () => navigate(`/call/${msg.call_id}?role=callee`),
            },
            duration: 30000,
          });
          navigate(`/call/${msg.call_id}?role=callee&visitor=${encodeURIComponent(msg.visitor_name)}`);
        }
        if (window.__fastviSignalHandler) window.__fastviSignalHandler(msg);
      };
      ws.onclose = () => {
        wsRef.current = null;
        window.__fastviWs = null;
        if (!cancelled && attemptsRef.current < MAX_WS_ATTEMPTS) {
          reconnectTimer.current = setTimeout(connect, 2000);
        }
      };
      ws.onerror = () => { try { ws.close(); } catch { /* noop */ } };
    }

    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) { try { wsRef.current.close(); } catch { /* noop */ } }
      window.__fastviWs = null;
    };
  }, [user, navigate]);

  if (!user) return null;
  // pointer-events-none so this decorative indicator can NEVER block clicks.
  return (
    <div
      className="pointer-events-none fixed bottom-3 right-3 z-10 hidden md:flex items-center gap-2 text-xs font-mono text-muted-foreground bg-card/80 border border-border rounded-full px-3 py-1.5 shadow-sm"
      data-testid="ws-indicator"
    >
      <Bell size={12} />
      <span data-testid="ws-status">live</span>
    </div>
  );
}
