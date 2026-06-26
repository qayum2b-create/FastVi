import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Camera, PhoneOutgoing } from "lucide-react";
import { toast } from "sonner";

export default function Kiosk() {
  const navigate = useNavigate();
  const [buildingCode, setBuildingCode] = useState("FASTVI");
  const [confirmed, setConfirmed] = useState(false);
  const [building, setBuilding] = useState(null);
  const [units, setUnits] = useState([]);
  const [filter, setFilter] = useState("");
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [visitorName, setVisitorName] = useState("");
  const [photo, setPhoto] = useState(null);
  const [streaming, setStreaming] = useState(false);
  const [calling, setCalling] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  async function loadUnits(code) {
    try {
      const { data } = await api.get(`/public/units`, { params: { building_code: code }, withCredentials: false });
      setBuilding(data.building);
      setUnits(data.units);
      setConfirmed(true);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Building not found");
    }
  }

  async function startCam() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setStreaming(true);
    } catch {
      toast.error("Camera not available");
    }
  }

  function capture() {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = 320; canvas.height = 240;
    canvas.getContext("2d").drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    setPhoto(canvas.toDataURL("image/jpeg", 0.7));
  }

  async function placeCall() {
    if (!selectedUnit) return toast.error("Pick a unit first");
    if (!selectedUnit.has_residents) return toast.error("No residents in this unit yet");
    setCalling(true);
    try {
      const { data } = await api.post("/calls/initiate", {
        unit_id: selectedUnit.id,
        visitor_name: visitorName || "Visitor",
        photo_data_url: photo,
      }, { withCredentials: false });
      // stop camera (call screen will use its own)
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      navigate(`/call/${data.id}?role=caller&visitor=${encodeURIComponent(visitorName||"Visitor")}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Call failed");
    } finally {
      setCalling(false);
    }
  }

  useEffect(() => () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
  }, []);

  const filtered = units.filter(u => u.number.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto p-6 md:p-10">
        <header className="flex items-center justify-between mb-10">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-white/60">Visitor kiosk</div>
            <div className="font-display text-3xl">Fast<span className="text-accent">Vi</span> · Lobby</div>
          </div>
          <div className="text-xs font-mono text-white/60">{new Date().toLocaleString()}</div>
        </header>

        {!confirmed ? (
          <div className="max-w-md mx-auto mt-16 text-center fade-up">
            <div className="text-xs uppercase tracking-[0.3em] text-white/60 mb-3">Step 1</div>
            <h1 className="font-display text-5xl mb-6">Enter building code</h1>
            <Input
              value={buildingCode}
              onChange={(e)=>setBuildingCode(e.target.value.toUpperCase())}
              className="bg-zinc-900 border-zinc-700 text-white font-mono text-2xl text-center h-16"
              data-testid="kiosk-building"
            />
            <Button onClick={()=>loadUnits(buildingCode)} className="mt-4 w-full h-12" data-testid="kiosk-confirm">Continue</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 fade-up">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-white/60 mb-2">Step 2 · {building?.name}</div>
              <h2 className="font-display text-4xl mb-4">Choose a unit</h2>
              <Input
                placeholder="Search 101…"
                value={filter} onChange={(e)=>setFilter(e.target.value)}
                className="bg-zinc-900 border-zinc-700 text-white font-mono mb-4"
                data-testid="kiosk-search"
              />
              <div className="grid grid-cols-3 gap-3 max-h-[420px] overflow-y-auto pr-1" data-testid="kiosk-units">
                {filtered.map((u) => (
                  <button
                    key={u.id}
                    onClick={()=>setSelectedUnit(u)}
                    data-testid={`unit-${u.number}`}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      selectedUnit?.id === u.id ? "border-accent bg-accent/10" : "border-zinc-800 hover:border-zinc-600 bg-zinc-900"
                    } ${!u.has_residents ? "opacity-60" : ""}`}
                  >
                    <div className="font-mono text-2xl">{u.number}</div>
                    <div className="text-[10px] uppercase tracking-widest text-white/50 mt-1">{u.has_residents ? "Occupied" : "Vacant"}</div>
                  </button>
                ))}
                {filtered.length === 0 && <div className="col-span-3 text-sm text-white/60">No units found.</div>}
              </div>
            </div>

            <div className="space-y-4">
              <div className="text-xs uppercase tracking-[0.3em] text-white/60">Step 3</div>
              <h2 className="font-display text-4xl">Identify &amp; call</h2>
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-white/60 mb-2">Your name</div>
                <Input
                  value={visitorName} onChange={(e)=>setVisitorName(e.target.value)}
                  className="bg-zinc-900 border-zinc-700 text-white"
                  placeholder="John Visitor"
                  data-testid="kiosk-visitor-name"
                />
              </div>

              <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900">
                <div className="aspect-video relative">
                  <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                  {!streaming && (
                    <button onClick={startCam} className="absolute inset-0 grid place-items-center text-white/70 hover:text-white" data-testid="kiosk-start-cam">
                      <Camera size={36} />
                    </button>
                  )}
                  {photo && (
                    <img src={photo} alt="snapshot" className="absolute bottom-2 right-2 w-20 rounded border border-zinc-700"/>
                  )}
                </div>
                <div className="flex justify-between p-3 border-t border-zinc-800">
                  <Button size="sm" variant="outline" onClick={capture} disabled={!streaming} data-testid="kiosk-capture">Snap photo</Button>
                  <div className="text-xs text-white/60 self-center font-mono">{selectedUnit ? `Unit ${selectedUnit.number}` : "—"}</div>
                </div>
              </div>

              <Button onClick={placeCall} disabled={calling || !selectedUnit?.has_residents} className="w-full h-14 text-lg" data-testid="kiosk-call">
                <PhoneOutgoing className="mr-2" /> {calling ? "Calling…" : `Ring ${selectedUnit?.number || "—"}`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
