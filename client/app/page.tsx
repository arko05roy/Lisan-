"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, FileText, Shield, Eye, Zap, Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Floating particles component for atmosphere
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(30)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white/20"
          style={{
            width: Math.random() * 3 + 1 + "px",
            height: Math.random() * 3 + 1 + "px",
            left: Math.random() * 100 + "%",
            top: Math.random() * 100 + "%",
            animation: `float-particle ${15 + Math.random() * 20}s linear infinite`,
            animationDelay: `-${Math.random() * 20}s`,
            opacity: Math.random() * 0.5 + 0.1,
          }}
        />
      ))}
    </div>
  );
}

// Animated text reveal component
function RevealText({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-block overflow-hidden ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span
        className="inline-block animate-text-reveal"
        style={{ animationDelay: `${delay}ms` }}
      >
        {children}
      </span>
    </span>
  );
}

// Feature card component
function FeatureCard({
  icon: Icon,
  title,
  description,
  delay,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  delay: number;
}) {
  return (
    <div
      className="group relative p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] backdrop-blur-sm hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-500 hover:translate-y-[-4px] animate-fade-in-up opacity-0"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      {/* Glow effect on hover */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background:
            "radial-gradient(circle at 50% 0%, rgba(139, 140, 255, 0.1) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#8B8CFF]/20 to-[#8B8CFF]/5 flex items-center justify-center mb-4 border border-[#8B8CFF]/20 group-hover:border-[#8B8CFF]/40 transition-colors duration-300">
          <Icon className="w-5 h-5 text-[#8B8CFF]" />
        </div>
        <h3 className="font-sans text-lg font-medium text-white mb-2">
          {title}
        </h3>
        <p className="font-sans text-sm text-white/50 leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}

// Magnetic button effect
function MagneticButton({
  children,
  href,
  variant = "primary",
}: {
  children: React.ReactNode;
  href: string;
  variant?: "primary" | "secondary";
}) {
  const buttonRef = useRef<HTMLAnchorElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    setPosition({ x: x * 0.15, y: y * 0.15 });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
  };

  const baseStyles =
    "relative inline-flex items-center justify-center gap-2 px-8 py-4 font-sans font-medium rounded-full transition-all duration-300 overflow-hidden";

  const variants = {
    primary: "bg-white text-black hover:shadow-[0_0_40px_rgba(255,255,255,0.3)]",
    secondary:
      "bg-white/[0.03] hover:bg-white/[0.06] backdrop-blur-md border border-white/10 hover:border-white/20 text-white",
  };

  return (
    <Link
      ref={buttonRef}
      href={href}
      className={`${baseStyles} ${variants[variant]}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
      }}
    >
      {variant === "primary" && (
        <span className="absolute inset-0 bg-gradient-to-r from-[#8B8CFF] to-[#6366f1] opacity-0 hover:opacity-100 transition-opacity duration-300" />
      )}
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </Link>
  );
}

// Stats counter
function StatCounter({
  value,
  label,
  delay,
}: {
  value: string;
  label: string;
  delay: number;
}) {
  return (
    <div
      className="text-center animate-fade-in-up opacity-0"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      <div className="font-serif text-4xl md:text-5xl text-white mb-1">
        {value}
      </div>
      <div className="font-sans text-sm text-white/40 uppercase tracking-wider">
        {label}
      </div>
    </div>
  );
}

export default function Home() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030305] font-sans">
      {/* Noise texture overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-50 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />


      {/* Hero Section */}
      <section className="relative min-h-screen">
        {/* Hero Image Container with parallax */}
        <div
          className="absolute inset-0 w-full h-full"
          style={{
            transform: `translateY(${scrollY * 0.3}px)`,
          }}
        >
          <Image
            src="/hero.png"
            alt="Lisan Hero"
            fill
            priority
            className="object-cover object-center scale-110"
          />

          {/* Vignette effect */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at center, transparent 0%, rgba(3,3,5,0.4) 50%, rgba(3,3,5,0.95) 100%)",
            }}
          />

          {/* Bottom gradient fade */}
          <div
            className="absolute bottom-0 left-0 right-0 h-[70%]"
            style={{
              background:
                "linear-gradient(to bottom, transparent 0%, rgba(3,3,5,0.3) 30%, rgba(3,3,5,0.7) 50%, rgba(3,3,5,0.95) 70%, #030305 100%)",
            }}
          />

          {/* Side gradients for cinematic feel */}
          <div
            className="absolute inset-y-0 left-0 w-1/4"
            style={{
              background:
                "linear-gradient(to right, rgba(3,3,5,0.8) 0%, transparent 100%)",
            }}
          />
          <div
            className="absolute inset-y-0 right-0 w-1/4"
            style={{
              background:
                "linear-gradient(to left, rgba(3,3,5,0.8) 0%, transparent 100%)",
            }}
          />
        </div>

        {/* Floating particles */}
        <FloatingParticles />

        {/* Ambient glow orbs */}
        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full animate-pulse-glow pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(139, 140, 255, 0.15) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="absolute bottom-1/3 right-1/4 w-72 h-72 rounded-full animate-pulse-glow pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(99, 102, 241, 0.1) 0%, transparent 70%)",
            filter: "blur(50px)",
            animationDelay: "2s",
          }}
        />

        {/* Navigation */}
        <nav
          className="relative z-20 flex items-center justify-between px-6 md:px-12 py-6 animate-fade-in-up"
          style={{ animationDelay: "100ms" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8B8CFF] to-[#6366f1] flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="font-serif text-2xl text-white tracking-tight">
              Lisan
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <Link
              href="#features"
              className="font-sans text-sm text-white/60 hover:text-white transition-colors duration-300"
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              className="font-sans text-sm text-white/60 hover:text-white transition-colors duration-300"
            >
              How it Works
            </Link>
            <Link
              href="#"
              className="font-sans text-sm text-white/60 hover:text-white transition-colors duration-300"
            >
              Docs
            </Link>
          </div>

          <Link
            href="/deposit"
            className="hidden md:inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 hover:border-white/20 text-white text-sm font-sans font-medium transition-all duration-300"
          >
            Launch App
            <ArrowRight className="w-4 h-4" />
          </Link>
        </nav>

        {/* Hero Content */}
        <div className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-100px)] pb-32 px-6">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#8B8CFF]/10 border border-[#8B8CFF]/20 mb-8 animate-fade-in-up opacity-0"
            style={{ animationDelay: "200ms", animationFillMode: "forwards" }}
          >
            <div className="w-2 h-2 rounded-full bg-[#8B8CFF] animate-pulse" />
            <span className="font-sans text-sm text-[#8B8CFF]">
              Now Live on Starknet Mainnet
            </span>
          </div>

          {/* Hero Text */}
          <div className="text-center max-w-5xl">
            <h1 className="font-serif text-white tracking-tight leading-[0.95]">
              <div className="overflow-hidden">
                <RevealText delay={300}>
                  <span className="block text-[2.8rem] xs:text-5xl sm:text-6xl md:text-7xl lg:text-8xl">
                    Do anything on
                  </span>
                </RevealText>
              </div>
              <div className="overflow-hidden">
                <RevealText delay={400}>
                  <span className="block text-[2.8rem] xs:text-5xl sm:text-6xl md:text-7xl lg:text-8xl bg-gradient-to-r from-white via-[#8B8CFF] to-white bg-clip-text text-transparent animate-gradient">
                    Starknet.
                  </span>
                </RevealText>
              </div>
              <div className="overflow-hidden mt-2">
                <RevealText delay={500}>
                  <span className="block text-[2.5rem] xs:text-4xl sm:text-5xl md:text-6xl lg:text-7xl italic font-light text-white/80">
                    No one knows
                  </span>
                </RevealText>
              </div>
              <div className="overflow-hidden">
                <RevealText delay={600}>
                  <span className="block text-[3rem] xs:text-5xl sm:text-6xl md:text-7xl lg:text-8xl italic font-light text-white/70">
                    it&apos;s you.
                  </span>
                </RevealText>
              </div>
            </h1>

            <p
              className="mt-10 text-lg md:text-xl text-white/50 font-sans font-light max-w-2xl mx-auto leading-relaxed animate-fade-in-up opacity-0"
              style={{ animationDelay: "800ms", animationFillMode: "forwards" }}
            >
              The privacy-first execution layer for Starknet. Execute
              transactions privately through zero-knowledge proofs, keeping your
              identity hidden while maintaining full control.
            </p>

            {/* CTA Buttons */}
            <div
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12 animate-fade-in-up opacity-0"
              style={{ animationDelay: "1000ms", animationFillMode: "forwards" }}
            >
              <MagneticButton href="/deposit" variant="primary">
                <span>Enter App</span>
                <ArrowRight className="w-5 h-5" />
              </MagneticButton>

              <MagneticButton href="#" variant="secondary">
                <FileText className="w-5 h-5 opacity-70" />
                <span>Read Whitepaper</span>
              </MagneticButton>
            </div>
          </div>

          {/* Scroll indicator */}
          <div
            className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-fade-in-up opacity-0"
            style={{ animationDelay: "1200ms", animationFillMode: "forwards" }}
          >
            <span className="font-sans text-xs text-white/30 uppercase tracking-widest">
              Scroll to explore
            </span>
            <div className="w-6 h-10 rounded-full border border-white/20 flex items-start justify-center p-2">
              <div
                className="w-1 h-2 rounded-full bg-white/50 animate-bounce"
                style={{ animationDuration: "1.5s" }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative z-10 py-16 border-y border-white/[0.05]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
            <StatCounter value="$2.4M+" label="TVL Protected" delay={100} />
            <StatCounter value="12K+" label="Private Txns" delay={200} />
            <StatCounter value="100%" label="On-chain Privacy" delay={300} />
            <StatCounter value="<2s" label="Finality" delay={400} />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative z-10 py-24 md:py-32">
        <div className="max-w-6xl mx-auto px-6">
          {/* Section header */}
          <div className="text-center mb-16">
            <h2
              className="font-serif text-3xl md:text-5xl text-white mb-4 animate-fade-in-up opacity-0"
              style={{ animationFillMode: "forwards" }}
            >
              Privacy by Design
            </h2>
            <p
              className="font-sans text-lg text-white/40 max-w-xl mx-auto animate-fade-in-up opacity-0"
              style={{ animationDelay: "100ms", animationFillMode: "forwards" }}
            >
              Built from the ground up with zero-knowledge cryptography to
              ensure your transactions remain yours alone.
            </p>
          </div>

          {/* Feature cards grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={Eye}
              title="Anonymous Execution"
              description="Your wallet address is never revealed on-chain. Execute any transaction while maintaining complete anonymity."
              delay={200}
            />
            <FeatureCard
              icon={Shield}
              title="ZK-Powered Privacy"
              description="Leveraging Starknet's native zero-knowledge proofs for cryptographic privacy guarantees."
              delay={300}
            />
            <FeatureCard
              icon={Zap}
              title="Instant Finality"
              description="Sub-2 second transaction finality with Starknet's STARK-based validity rollup architecture."
              delay={400}
            />
            <FeatureCard
              icon={Lock}
              title="Self-Custodial"
              description="Your keys, your crypto. No trusted third parties, no central points of failure."
              delay={500}
            />
            <FeatureCard
              icon={FileText}
              title="Any Contract"
              description="Interact with any Starknet smart contract privately. DeFi, NFTs, DAOs — all shielded."
              delay={600}
            />
            <FeatureCard
              icon={Shield}
              title="Relayer Network"
              description="Decentralized relayer network ensures transaction submission without revealing your identity."
              delay={700}
            />
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section
        id="how-it-works"
        className="relative z-10 py-24 md:py-32 border-t border-white/[0.05]"
      >
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Text content */}
            <div>
              <h2
                className="font-serif text-3xl md:text-5xl text-white mb-6 animate-fade-in-up opacity-0"
                style={{ animationFillMode: "forwards" }}
              >
                How Lisan Works
              </h2>
              <div className="space-y-6">
                {[
                  {
                    step: "01",
                    title: "Deposit to Shield",
                    desc: "Move assets into your shielded balance using our privacy pool.",
                  },
                  {
                    step: "02",
                    title: "Generate Proof",
                    desc: "Create a zero-knowledge proof of your transaction locally.",
                  },
                  {
                    step: "03",
                    title: "Submit via Relayer",
                    desc: "A relayer submits your transaction, hiding your identity.",
                  },
                  {
                    step: "04",
                    title: "Execute Privately",
                    desc: "Your transaction executes on-chain with full privacy.",
                  },
                ].map((item, i) => (
                  <div
                    key={item.step}
                    className="flex gap-4 animate-fade-in-up opacity-0"
                    style={{
                      animationDelay: `${(i + 1) * 150}ms`,
                      animationFillMode: "forwards",
                    }}
                  >
                    <span className="font-mono text-sm text-[#8B8CFF]/60 font-medium shrink-0 w-8">
                      {item.step}
                    </span>
                    <div>
                      <h3 className="font-sans text-lg text-white font-medium mb-1">
                        {item.title}
                      </h3>
                      <p className="font-sans text-white/40">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Visual diagram placeholder */}
            <div
              className="relative aspect-square rounded-3xl overflow-hidden bg-gradient-to-br from-[#8B8CFF]/10 to-transparent border border-white/[0.05] animate-fade-in-up opacity-0"
              style={{ animationDelay: "300ms", animationFillMode: "forwards" }}
            >
              {/* Decorative elements */}
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  background:
                    "radial-gradient(circle at 30% 30%, rgba(139, 140, 255, 0.1) 0%, transparent 50%)",
                }}
              >
                <div className="relative w-48 h-48">
                  {/* Animated rings */}
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute inset-0 rounded-full border border-[#8B8CFF]/20"
                      style={{
                        transform: `scale(${1 + i * 0.4})`,
                        opacity: 1 - i * 0.3,
                        animation: `pulse-glow ${3 + i}s ease-in-out infinite`,
                        animationDelay: `${i * 0.5}s`,
                      }}
                    />
                  ))}
                  {/* Center icon */}
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#8B8CFF]/30 to-[#6366f1]/20 rounded-full backdrop-blur-sm">
                    <Shield className="w-16 h-16 text-white/80" />
                  </div>
                </div>
              </div>

              {/* Grid pattern overlay */}
              <div
                className="absolute inset-0 opacity-[0.03]"
                style={{
                  backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                  backgroundSize: "40px 40px",
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-24 md:py-32">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2
            className="font-serif text-4xl md:text-6xl text-white mb-6 animate-fade-in-up opacity-0"
            style={{ animationFillMode: "forwards" }}
          >
            Ready for Privacy?
          </h2>
          <p
            className="font-sans text-lg text-white/40 mb-10 max-w-xl mx-auto animate-fade-in-up opacity-0"
            style={{ animationDelay: "100ms", animationFillMode: "forwards" }}
          >
            Join thousands of users already transacting privately on Starknet.
          </p>
          <div
            className="animate-fade-in-up opacity-0"
            style={{ animationDelay: "200ms", animationFillMode: "forwards" }}
          >
            <MagneticButton href="/deposit" variant="primary">
              <span>Get Started</span>
              <ArrowRight className="w-5 h-5" />
            </MagneticButton>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-12 border-t border-white/[0.05]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#8B8CFF] to-[#6366f1] flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="font-serif text-xl text-white">Lisan</span>
            </div>

            <div className="flex items-center gap-8">
              <Link
                href="#"
                className="font-sans text-sm text-white/40 hover:text-white transition-colors"
              >
                Documentation
              </Link>
              <Link
                href="#"
                className="font-sans text-sm text-white/40 hover:text-white transition-colors"
              >
                GitHub
              </Link>
              <Link
                href="#"
                className="font-sans text-sm text-white/40 hover:text-white transition-colors"
              >
                Twitter
              </Link>
            </div>

            <p className="font-sans text-sm text-white/30">
              © 2025 Lisan. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
