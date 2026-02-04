"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black font-sans">
      {/* Hero Image Container */}
      <div className="absolute inset-0 w-full h-full">
        <Image
          src="/hero.png"
          alt="Lisan Hero"
          fill
          priority
          className="object-cover object-center scale-105"
        />

        {/* Bottom blur overlay - gradient that fades from transparent to black with blur */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[60%] pointer-events-none"
          style={{
            background: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.2) 20%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0.8) 60%, rgba(0,0,0,0.95) 80%, #000 100%)',
          }}
        />

        {/* Extra blur layer for enhanced effect */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[40%] pointer-events-none backdrop-blur-[2px]"
          style={{
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 60%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 60%)',
          }}
        />
      </div>

      {/* Content overlay */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen pb-24 px-6">
        {/* Hero Text */}
        <div className="text-center max-w-6xl animate-fade-in-up space-y-10">
          <h1 className="flex flex-col items-center justify-center font-serif text-white tracking-tighter leading-[0.9]">
            {/* Line 1: Do anything on */}
            <span className="text-[3.2rem] xs:text-6xl sm:text-7xl md:text-8xl lg:text-9xl block">
              Do anything on
            </span>

            {/* Line 2: Starknet. */}
            <span className="text-[3.2rem] xs:text-6xl sm:text-7xl md:text-8xl lg:text-9xl block mb-2 sm:mb-4">
              Starknet.
            </span>

            {/* Line 3: No one knows it's (Italic) */}
            <span className="text-[3.2rem] xs:text-6xl sm:text-7xl md:text-8xl lg:text-9xl block italic text-gray-100 font-light">
              No one knows it's
            </span>

            {/* Line 4: you. (Italic) */}
            <span className="text-[3.5rem] xs:text-[4rem] sm:text-[5rem] md:text-[6rem] lg:text-[7rem] xl:text-[8rem] block italic text-gray-100 font-light mt-[-0.5rem] sm:mt-[-1rem]">
              you.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-white/60 font-light max-w-2xl mx-auto leading-relaxed pt-6">
            The privacy-first wallet for Starknet. Execute transactions
            privately, manage shielded assets, and interact with contracts
            anonymously.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-10">
            <Link
              href="/deposit"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-10 py-4 bg-white text-black hover:bg-gray-200 
                         font-medium rounded-full transition-all duration-300 transform hover:scale-105"
            >
              <span>Enter App</span>
              <ArrowRight className="w-5 h-5" />
            </Link>

            <Link
              href="#"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-10 py-4 bg-white/5 hover:bg-white/10 
                         backdrop-blur-md border border-white/10 rounded-full text-white
                         transition-all duration-300 transform hover:scale-105"
            >
              <FileText className="w-5 h-5 opacity-70" />
              <span>Read Whitepaper</span>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
