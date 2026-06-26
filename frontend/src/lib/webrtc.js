/**
 * Minimal WebRTC peer wrapper for FastVi 1:1 calls.
 * Signaling is sent over the parent WebSocket through `signal(msg)`.
 */
export class CallPeer {
  constructor({ isCaller, signal, onRemoteStream, onClose }) {
    this.isCaller = isCaller;
    this.signal = signal;
    this.onRemoteStream = onRemoteStream;
    this.onClose = onClose;
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    this.pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream && onRemoteStream) onRemoteStream(stream);
    };
    this.pc.onicecandidate = (e) => {
      if (e.candidate) this.signal({ type: "ice", candidate: e.candidate });
    };
    this.pc.onconnectionstatechange = () => {
      const state = this.pc.connectionState;
      if (state === "failed" || state === "closed" || state === "disconnected") {
        if (this.onClose) this.onClose(state);
      }
    };
    this.localStream = null;
  }

  async attachLocalStream(stream) {
    this.localStream = stream;
    stream.getTracks().forEach((track) => this.pc.addTrack(track, stream));
  }

  async createOffer() {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.signal({ type: "offer", sdp: offer });
  }

  async handleSignal(msg) {
    if (msg.type === "offer") {
      await this.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      this.signal({ type: "answer", sdp: answer });
    } else if (msg.type === "answer") {
      await this.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
    } else if (msg.type === "ice" && msg.candidate) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
      } catch {
        /* ignore late ice */
      }
    }
  }

  destroy() {
    try {
      if (this.localStream) {
        this.localStream.getTracks().forEach((t) => t.stop());
      }
    } catch {
      /* noop */
    }
    try {
      this.pc.close();
    } catch {
      /* noop */
    }
  }
}

export async function getUserStream({ video = true, audio = true } = {}) {
  return navigator.mediaDevices.getUserMedia({ video, audio });
}
