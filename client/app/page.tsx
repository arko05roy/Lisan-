"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Shield, Eye, Zap, Lock, Fingerprint, Network } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";

// Morphing gradient blob
function MorphingBlob() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-30"
        style={{
          background: "radial-gradient(circle, rgba(139, 140, 255, 0.4) 0%, rgba(99, 102, 241, 0.2) 40%, transparent 70%)",
          filter: "blur(80px)",
          animation: "morphBlob 20s ease-in-out infinite",
        }}
      />
      <div
        className="absolute top-1/3 right-1/4 w-[500px] h-[500px] opacity-20"
        style={{
          background: "radial-gradient(circle, rgba(236, 72, 153, 0.3) 0%, transparent 60%)",
          filter: "blur(60px)",
          animation: "morphBlob 15s ease-in-out infinite reverse",
        }}
      />
    </div>
  );
}

// Custom cursor follower
function CursorGlow() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
      setIsVisible(true);
    };
    const handleMouseLeave = () => setIsVisible(false);

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  if (typeof window === "undefined") return null;

  return (
    <div
      className="fixed pointer-events-none z-[100] transition-opacity duration-300 hidden md:block"
      style={{
        left: position.x - 200,
        top: position.y - 200,
        width: 400,
        height: 400,
        background: "radial-gradient(circle, rgba(139, 140, 255, 0.08) 0%, transparent 60%)",
        opacity: isVisible ? 1 : 0,
      }}
    />
  );
}

// Animated counter with scroll trigger
function AnimatedNumber({ value, suffix = "", delay = 0 }: { value: number; suffix?: string; delay?: number }) {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          setTimeout(() => {
            let start = 0;
            const duration = 2000;
            const startTime = performance.now();
            const animate = (currentTime: number) => {
              const elapsed = currentTime - startTime;
              const progress = Math.min(elapsed / duration, 1);
              const eased = 1 - Math.pow(1 - progress, 4);
              setCount(Math.floor(eased * value));
              if (progress < 1) requestAnimationFrame(animate);
            };
            requestAnimationFrame(animate);
          }, delay);
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value, delay, hasAnimated]);

  return (
    <span ref={ref}>
      {count}
      {suffix}
    </span>
  );
}

// Magnetic hover effect hook
function useMagneticHover(strength = 0.3) {
  const ref = useRef<HTMLElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width / 2) * strength;
      const y = (e.clientY - rect.top - rect.height / 2) * strength;
      setTransform({ x, y });
    },
    [strength]
  );

  const handleMouseLeave = useCallback(() => {
    setTransform({ x: 0, y: 0 });
  }, []);

  return { ref, transform, handleMouseMove, handleMouseLeave };
}

// Feature card with number
function FeatureBlock({
  number,
  title,
  description,
  icon: Icon,
}: {
  number: string;
  title: string;
  description: string;
  icon: React.ElementType;
}) {
  return (
    <div className="group relative min-w-[340px] md:min-w-[400px] p-8 md:p-10">
      {/* Background */}
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/[0.03] to-transparent border border-white/[0.06] group-hover:border-white/[0.12] group-hover:from-white/[0.05] transition-all duration-500" />

      {/* Hover glow */}
      <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{
        background: "radial-gradient(circle at 50% 0%, rgba(139, 140, 255, 0.15) 0%, transparent 60%)",
      }} />

      <div className="relative z-10">
        {/* Large number */}
        <span className="block font-serif text-[120px] md:text-[150px] leading-none text-white/[0.03] group-hover:text-white/[0.06] transition-colors duration-500 -mb-16 md:-mb-20">
          {number}
        </span>

        {/* Icon */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#8B8CFF]/20 to-[#8B8CFF]/5 flex items-center justify-center mb-6 border border-[#8B8CFF]/20 group-hover:border-[#8B8CFF]/40 group-hover:scale-110 transition-all duration-300">
          <Icon className="w-6 h-6 text-[#8B8CFF]" />
        </div>

        {/* Content */}
        <h3 className="font-sans text-xl md:text-2xl font-medium text-white mb-3 group-hover:translate-x-1 transition-transform duration-300">
          {title}
        </h3>
        <p className="font-sans text-base text-white/40 leading-relaxed max-w-[300px] group-hover:text-white/50 transition-colors duration-300">
          {description}
        </p>

        {/* Learn more link */}
        <div className="mt-6 flex items-center gap-2 text-[#8B8CFF]/60 group-hover:text-[#8B8CFF] transition-colors duration-300">
          <span className="text-sm font-medium">Learn more</span>
          <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-300" />
        </div>
      </div>
    </div>
  );
}

// Process step
function ProcessStep({ number, title, description, isLast = false }: { number: string; title: string; description: string; isLast?: boolean }) {
  return (
    <div className="relative flex gap-6 md:gap-8">
      {/* Timeline */}
      <div className="flex flex-col items-center">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#8B8CFF] to-[#6366f1] flex items-center justify-center text-white font-mono text-sm font-bold shrink-0">
          {number}
        </div>
        {!isLast && (
          <div className="w-px h-full bg-gradient-to-b from-[#8B8CFF]/40 to-transparent min-h-[80px]" />
        )}
      </div>

      {/* Content */}
      <div className="pb-12">
        <h3 className="font-sans text-xl md:text-2xl font-medium text-white mb-2">{title}</h3>
        <p className="font-sans text-white/40 leading-relaxed max-w-md">{description}</p>
      </div>
    </div>
  );
}

export default function Home() {
  const [scrollY, setScrollY] = useState(0);
  const featuresRef = useRef<HTMLDivElement>(null);
  const [featureScroll, setFeatureScroll] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Horizontal scroll for features
  const scrollFeatures = (direction: "left" | "right") => {
    if (!featuresRef.current) return;
    const scrollAmount = 420;
    const newScroll = direction === "left"
      ? Math.max(0, featureScroll - scrollAmount)
      : featureScroll + scrollAmount;
    featuresRef.current.scrollTo({ left: newScroll, behavior: "smooth" });
    setFeatureScroll(newScroll);
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#030305] font-sans">
      <CursorGlow />

      {/* Noise texture */}
      <div
        className="fixed inset-0 pointer-events-none z-50 opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* HERO SECTION */}
      <section className="relative min-h-screen overflow-hidden">
        {/* Background image with parallax */}
        <div
          className="absolute inset-0 w-full h-full"
          style={{ transform: `translateY(${scrollY * 0.4}px) scale(1.1)` }}
        >
          <Image
            src="/hero.png"
            alt="Lisan Hero"
            fill
            priority
            className="object-cover object-center"
          />

          {/* Cinematic overlays */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#030305]/60 via-transparent to-[#030305]" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#030305]/80 via-transparent to-[#030305]/80" />
          <div className="absolute inset-0" style={{
            background: "radial-gradient(ellipse 80% 50% at 50% 50%, transparent 0%, #030305 100%)",
          }} />
        </div>

        <MorphingBlob />

        {/* Navigation */}
        <nav className="relative z-30 flex items-center justify-between px-6 md:px-12 lg:px-20 py-6 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#8B8CFF] to-[#6366f1] flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="font-serif text-2xl text-white tracking-tight">Lisan</span>
          </Link>

          <div className="hidden lg:flex items-center gap-10">
            {["Features", "How it Works", "Docs", "Community"].map((item) => (
              <Link
                key={item}
                href={`#${item.toLowerCase().replace(" ", "-")}`}
                className="relative font-sans text-sm text-white/50 hover:text-white transition-colors duration-300 group"
              >
                {item}
                <span className="absolute -bottom-1 left-0 w-0 h-px bg-[#8B8CFF] group-hover:w-full transition-all duration-300" />
              </Link>
            ))}
          </div>

          <Link
            href="/deposit"
            className="group flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black text-sm font-sans font-medium hover:bg-[#8B8CFF] hover:text-white transition-all duration-300"
          >
            <span>Launch App</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
          </Link>
        </nav>

        {/* Hero content - asymmetric layout */}
        <div className="relative z-20 min-h-[calc(100vh-100px)] flex flex-col justify-center px-6 md:px-12 lg:px-20 pb-20">
          <div className="max-w-7xl mx-auto w-full">
            {/* Status badge */}
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] mb-8 animate-fade-in-up opacity-0" style={{ animationDelay: "200ms", animationFillMode: "forwards" }}>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span className="font-sans text-sm text-white/70">Live on Starknet Mainnet</span>
            </div>

            {/* Main headline - large and dramatic */}
            <div className="grid lg:grid-cols-12 gap-8 lg:gap-4 items-end">
              <div className="lg:col-span-8">
                <h1 className="font-serif text-white leading-[0.95] tracking-tight">
                  <span className="block text-[2.5rem] sm:text-[3.5rem] md:text-[4.5rem] lg:text-[5.5rem] animate-fade-in-up opacity-0" style={{ animationDelay: "300ms", animationFillMode: "forwards" }}>
                    Do anything on
                  </span>
                  <span
                    className="block text-[2.5rem] sm:text-[3.5rem] md:text-[4.5rem] lg:text-[5.5rem] animate-fade-in-up opacity-0"
                    style={{
                      animationDelay: "400ms",
                      animationFillMode: "forwards",
                      background: "linear-gradient(90deg, #8B8CFF, #a78bfa, #8B8CFF)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                      backgroundSize: "200% auto",
                    }}
                  >
                    Starknet.
                  </span>
                  <span className="block text-[2.2rem] sm:text-[3rem] md:text-[4rem] lg:text-[5rem] italic font-light text-white/70 mt-2 animate-fade-in-up opacity-0" style={{ animationDelay: "500ms", animationFillMode: "forwards" }}>
                    No one knows it&apos;s you.
                  </span>
                </h1>

                {/* Subheadline */}
                <p className="mt-8 text-lg md:text-xl text-white/40 font-sans font-light max-w-lg leading-relaxed animate-fade-in-up opacity-0" style={{ animationDelay: "600ms", animationFillMode: "forwards" }}>
  Tornado Cash hid transfers <br /> We hide everything                </p>
              </div>

              {/* Right side stats */}
              <div className="lg:col-span-4 flex flex-col gap-6 lg:items-end animate-fade-in-up opacity-0" style={{ animationDelay: "700ms", animationFillMode: "forwards" }}>
                <div className="text-right">
                  <div className="font-serif text-5xl md:text-6xl text-white">
                    <AnimatedNumber value={2} suffix=".4M+" />
                  </div>
                  <div className="font-sans text-sm text-white/40 uppercase tracking-wider mt-1">TVL Protected</div>
                </div>
                <div className="text-right">
                  <div className="font-serif text-5xl md:text-6xl text-white">
                    <AnimatedNumber value={12} suffix="K+" delay={200} />
                  </div>
                  <div className="font-sans text-sm text-white/40 uppercase tracking-wider mt-1">Private Transactions</div>
                </div>
              </div>
            </div>

            {/* CTA buttons */}
            <div className="flex flex-wrap items-center gap-4 mt-12 animate-fade-in-up opacity-0" style={{ animationDelay: "800ms", animationFillMode: "forwards" }}>
              <Link
                href="/deposit"
                className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-full bg-white text-black font-sans font-medium overflow-hidden transition-all duration-300 hover:shadow-[0_0_50px_rgba(139,140,255,0.4)]"
              >
                <span className="relative z-10">Enter App</span>
                <ArrowRight className="relative z-10 w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#8B8CFF] to-[#a78bfa] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Link>

              <Link
                href="#how-it-works"
                className="group inline-flex items-center gap-3 px-8 py-4 rounded-full border border-white/10 text-white font-sans font-medium hover:border-white/30 hover:bg-white/[0.02] transition-all duration-300"
              >
                <span>How it Works</span>
                <div className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center group-hover:border-white/40 transition-colors duration-300">
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform duration-300" />
                </div>
              </Link>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 animate-fade-in-up opacity-0" style={{ animationDelay: "900ms", animationFillMode: "forwards" }}>
            <div className="w-px h-16 bg-gradient-to-b from-transparent via-white/20 to-transparent" />
            <span className="font-mono text-[10px] text-white/30 uppercase tracking-[0.3em]">Scroll</span>
          </div>
        </div>
      </section>

      {/* FEATURES - Horizontal scroll */}
      <section id="features" className="relative z-10 py-24 md:py-32 overflow-hidden">
        {/* Section header */}
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-20 mb-12">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <span className="font-mono text-sm text-[#8B8CFF] uppercase tracking-wider">Features</span>
              <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-white mt-4">
                Privacy by<br />
                <span className="text-white/40">Design</span>
              </h2>
            </div>

            {/* Scroll controls */}
            <div className="flex gap-3">
              <button
                onClick={() => scrollFeatures("left")}
                className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:border-white/30 transition-all duration-300"
              >
                <ArrowRight className="w-5 h-5 rotate-180" />
              </button>
              <button
                onClick={() => scrollFeatures("right")}
                className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:border-white/30 transition-all duration-300"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Horizontal scrolling cards */}
        <div
          ref={featuresRef}
          className="flex gap-6 overflow-x-auto scrollbar-hide px-6 md:px-12 lg:px-20 pb-4"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          <FeatureBlock
            number="01"
            icon={Eye}
            title="Anonymous Execution"
            description="Your wallet address is never revealed on-chain. Execute any transaction while maintaining complete anonymity."
          />
          <FeatureBlock
            number="02"
            icon={Shield}
            title="ZK-Powered Privacy"
            description="Leveraging Starknet's native zero-knowledge proofs for cryptographic privacy guarantees."
          />
          <FeatureBlock
            number="03"
            icon={Zap}
            title="Instant Finality"
            description="Sub-2 second transaction finality with Starknet's STARK-based validity rollup architecture."
          />
          <FeatureBlock
            number="04"
            icon={Lock}
            title="Self-Custodial"
            description="Your keys, your crypto. No trusted third parties, no central points of failure."
          />
          <FeatureBlock
            number="05"
            icon={Fingerprint}
            title="Identity Protection"
            description="Advanced identity shielding ensures your on-chain activity can never be linked to you."
          />
          <FeatureBlock
            number="06"
            icon={Network}
            title="Relayer Network"
            description="Decentralized relayer network ensures transaction submission without revealing your identity."
          />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="relative z-10 py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-20">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-24">
            {/* Left - sticky header */}
            <div className="lg:sticky lg:top-32 lg:self-start">
              <span className="font-mono text-sm text-[#8B8CFF] uppercase tracking-wider">Process</span>
              <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-white mt-4 leading-tight">
                Four steps to<br />
                <span className="text-white/40">complete privacy</span>
              </h2>
              <p className="font-sans text-lg text-white/40 mt-6 leading-relaxed max-w-md">
                Lisan makes private transactions simple. No complex setup, no technical knowledge required.
              </p>

              {/* Visual element */}
              <div className="hidden lg:block mt-12 relative w-64 h-64">
                <div className="absolute inset-0 rounded-full border border-[#8B8CFF]/20 animate-spin" style={{ animationDuration: "20s" }} />
                <div className="absolute inset-4 rounded-full border border-[#8B8CFF]/10 animate-spin" style={{ animationDuration: "15s", animationDirection: "reverse" }} />
                <div className="absolute inset-8 rounded-full border border-dashed border-[#8B8CFF]/20" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#8B8CFF]/30 to-[#6366f1]/20 flex items-center justify-center backdrop-blur-sm">
                    <Shield className="w-8 h-8 text-white/80" />
                  </div>
                </div>
              </div>
            </div>

            {/* Right - steps */}
            <div className="space-y-0">
              <ProcessStep
                number="01"
                title="Connect & Deposit"
                description="Connect your Starknet wallet and deposit assets into Lisan's shielded pool. Your deposit enters a privacy-preserving smart contract."
              />
              <ProcessStep
                number="02"
                title="Generate ZK Proof"
                description="Locally generate a zero-knowledge proof that validates your transaction without revealing any identifying information."
              />
              <ProcessStep
                number="03"
                title="Submit via Relayer"
                description="Your proof is submitted through our decentralized relayer network, completely breaking the link between you and the transaction."
              />
              <ProcessStep
                number="04"
                title="Execute Privately"
                description="Your transaction executes on Starknet with full privacy. No one can trace it back to your wallet address."
                isLast
              />
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIAL / QUOTE */}
      <section className="relative z-10 py-24 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#8B8CFF]/[0.02] to-transparent" />

        <div className="max-w-5xl mx-auto px-6 md:px-12 lg:px-20 text-center relative">
          <div className="font-serif text-[120px] md:text-[200px] text-white/[0.02] absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/4 select-none">"</div>

          <blockquote className="font-serif text-3xl md:text-4xl lg:text-5xl text-white leading-tight relative z-10">
            Privacy is not about having something to hide.<br />
            <span className="text-white/40">It&apos;s about having something to protect.</span>
          </blockquote>

          <div className="mt-10 flex items-center justify-center gap-4">
            <div className="w-12 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <span className="font-sans text-sm text-white/40 uppercase tracking-wider">The Lisan Philosophy</span>
            <div className="w-12 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="relative z-10 py-24 md:py-40">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-20">
          <div className="relative rounded-[40px] overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#8B8CFF]/20 via-[#6366f1]/10 to-transparent" />
            <div className="absolute inset-0 backdrop-blur-3xl" />
            <div className="absolute inset-0 border border-white/[0.08] rounded-[40px]" />

            <div className="relative z-10 py-20 md:py-28 px-8 md:px-16 text-center">
              <h2 className="font-serif text-4xl md:text-6xl lg:text-7xl text-white mb-6">
                Ready to go private?
              </h2>
              <p className="font-sans text-lg md:text-xl text-white/50 max-w-xl mx-auto mb-10">
                Join the privacy revolution on Starknet. Your first transaction is just a click away.
              </p>

              <Link
                href="/deposit"
                className="group inline-flex items-center gap-3 px-10 py-5 rounded-full bg-white text-black font-sans font-semibold text-lg hover:shadow-[0_0_60px_rgba(255,255,255,0.3)] transition-all duration-300"
              >
                <span>Start Now</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 py-16 border-t border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-20">
          <div className="grid md:grid-cols-4 gap-12 md:gap-8">
            {/* Brand */}
            <div className="md:col-span-2">
              <Link href="/" className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8B8CFF] to-[#6366f1] flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <span className="font-serif text-2xl text-white">Lisan</span>
              </Link>
              <p className="font-sans text-white/40 mt-4 max-w-sm leading-relaxed">
                The privacy-first execution layer for Starknet. Built for those who believe privacy is a right, not a privilege.
              </p>
            </div>

            {/* Links */}
            <div>
              <h4 className="font-sans text-sm text-white/60 uppercase tracking-wider mb-4">Product</h4>
              <div className="space-y-3">
                {["Features", "How it Works", "Security", "Roadmap"].map((link) => (
                  <Link key={link} href="#" className="block font-sans text-white/40 hover:text-white transition-colors duration-300">
                    {link}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-sans text-sm text-white/60 uppercase tracking-wider mb-4">Community</h4>
              <div className="space-y-3">
                {["Twitter", "Discord", "GitHub", "Documentation"].map((link) => (
                  <Link key={link} href="#" className="block font-sans text-white/40 hover:text-white transition-colors duration-300">
                    {link}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-16 pt-8 border-t border-white/[0.05]">
            <p className="font-sans text-sm text-white/30">
              © 2025 Lisan. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <Link href="#" className="font-sans text-sm text-white/30 hover:text-white/60 transition-colors">Privacy Policy</Link>
              <Link href="#" className="font-sans text-sm text-white/30 hover:text-white/60 transition-colors">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
