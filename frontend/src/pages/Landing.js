import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { ArrowRight, ShieldCheck, QrCode, Video, Building2 } from "lucide-react";

const HERO_IMG =
  "https://images.unsplash.com/photo-1775733924062-66ff3311f051?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2ODh8MHwxfHNlYXJjaHwzfHxtb2Rlcm4lMjBhcGFydG1lbnQlMjBidWlsZGluZyUyMGVudHJhbmNlfGVufDB8fHx8MTc4MjQ1NzY5M3ww&ixlib=rb-4.1.0&q=85";
const FEATURE_IMG =
  "https://images.pexels.com/photos/31594272/pexels-photo-31594272.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="px-6 md:px-10 py-5 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-md bg-primary text-primary-foreground grid place-items-center font-display text-sm">F</div>
          <span className="font-display text-xl">Fast<span className="text-accent">Vi</span></span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-foreground">Features</a>
          <a href="#how" className="hover:text-foreground">How it works</a>
          <Link to="/kiosk" className="hover:text-foreground" data-testid="nav-kiosk">Visitor kiosk</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/login"><Button variant="ghost" data-testid="nav-login">Sign in</Button></Link>
          <Link to="/register"><Button data-testid="nav-register">Get started <ArrowRight className="ml-1" size={16} /></Button></Link>
        </div>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 px-6 md:px-10 py-12 md:py-20 max-w-7xl mx-auto">
        <div className="lg:col-span-7 flex flex-col justify-center fade-up">
          <div className="label-tiny mb-6">Secure intercom · multi-tenant</div>
          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl leading-[0.95]">
            Faster doors.<br />
            Friendlier buildings.<br />
            <span className="text-accent">FastVi.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base sm:text-lg text-muted-foreground">
            A modern video intercom and visitor-pass system for residential buildings.
            Live WebRTC calls between visitors and residents, QR pass codes for deliveries,
            and a control room for admins &amp; guards.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/register"><Button size="lg" data-testid="hero-cta-register">Create an account</Button></Link>
            <Link to="/kiosk"><Button size="lg" variant="outline" data-testid="hero-cta-kiosk">Open Visitor Kiosk</Button></Link>
          </div>
          <div className="mt-8 text-sm text-muted-foreground font-mono">
            Try demo · building code <span className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded">FASTVI</span> · unit <span className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded">101</span>
          </div>
        </div>
        <div className="lg:col-span-5 relative">
          <div className="relative overflow-hidden rounded-2xl border border-border">
            <img src={HERO_IMG} alt="Building entrance" className="w-full h-[460px] object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute bottom-5 left-5 right-5 text-primary-foreground">
              <div className="label-tiny text-white/80">Live Door</div>
              <div className="font-display text-2xl text-white">FastVi Heights · Main Entrance</div>
              <div className="mt-3 inline-flex items-center gap-2 text-xs font-mono text-white/90">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse" /> 03 residents online
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="px-6 md:px-10 py-16 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { icon: Video, title: "Live video calls", body: "Real WebRTC peer-to-peer video between the lobby and any resident's device." },
          { icon: QrCode, title: "QR visitor passes", body: "Generate one-time pass codes for friends, family or deliveries. Guards scan, FastVi logs." },
          { icon: ShieldCheck, title: "Multi-role control", body: "Residents approve. Guards monitor. Admins run buildings — each with a tailored dashboard." },
        ].map((f) => (
          <div key={f.title} className="card-stroke p-6 fade-up">
            <f.icon className="mb-4 text-accent" />
            <div className="font-display text-2xl mb-2">{f.title}</div>
            <p className="text-sm text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>

      <section id="how" className="px-6 md:px-10 py-16 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-5 order-2 lg:order-1">
            <div className="label-tiny mb-4">From lobby to living room</div>
            <h2 className="font-display text-4xl mb-4">A handshake, not a hassle.</h2>
            <ol className="space-y-3 text-muted-foreground">
              <li className="flex gap-3"><span className="font-mono text-accent">01</span> Visitor taps the unit on the lobby kiosk.</li>
              <li className="flex gap-3"><span className="font-mono text-accent">02</span> Resident sees a ringing card with photo &amp; live preview.</li>
              <li className="flex gap-3"><span className="font-mono text-accent">03</span> One tap connects the live video call — no app required.</li>
              <li className="flex gap-3"><span className="font-mono text-accent">04</span> Pre-approved guests skip the call with a QR pass.</li>
            </ol>
          </div>
          <div className="lg:col-span-7 order-1 lg:order-2 relative">
            <div className="relative overflow-hidden rounded-2xl border border-border">
              <img src={FEATURE_IMG} alt="Guard desk" className="w-full h-[400px] object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/10 to-transparent" />
              <div className="absolute top-5 left-5 text-white">
                <Building2 className="mb-2" />
                <div className="font-display text-2xl">Guard Control Room</div>
                <div className="text-xs font-mono mt-1 text-white/80">FastVi · Multi-tenant</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border px-6 md:px-10 py-8 text-sm text-muted-foreground flex flex-col md:flex-row justify-between items-center gap-3">
        <div>© {new Date().getFullYear()} FastVi · Secure intercom for modern buildings</div>
        <div className="flex gap-4 font-mono text-xs">
          <Link to="/kiosk">/kiosk</Link>
          <Link to="/login">/login</Link>
          <Link to="/register">/register</Link>
        </div>
      </footer>
    </div>
  );
}
