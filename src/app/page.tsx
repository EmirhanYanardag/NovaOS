"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

const analysisCards = [
  [
    "Holder Quality",
    "Evaluates holder behavior and wallet quality signals from the available analysis depth.",
  ],
  [
    "Risk Pressure",
    "Surfaces structural pressure such as weak-holder, concentration, and related risk inputs when available.",
  ],
  [
    "Liquidity Health",
    "Looks at liquidity conditions as part of the conviction profile instead of reading price alone.",
  ],
  [
    "Smart Money Flow",
    "Includes smart-money flow signals when the underlying evidence is available for the token.",
  ],
  [
    "Data Confidence",
    "Shows how much trust to place in the output based on coverage and available inputs.",
  ],
];

const depthModes = [
  ["Fast", "Top holders are checked with a lighter research pass for quicker results."],
  ["Balanced", "A wider holder sample is reviewed for stronger conviction context."],
  ["Deep", "More holder behavior is evaluated for a deeper research profile."],
];

const problemPoints = [
  "A token can look strong while weak holders dominate ownership.",
  "Liquidity can look healthy while risk pressure is rising.",
  "Top holders can decide structure before retail sees it.",
  "Raw wallet data is noisy without interpretation.",
];

const explainabilityItems = [
  "Nova Conviction score",
  "Holder quality breakdown",
  "Risk drivers",
  "Data confidence",
  "Top holder contribution",
  "Deep vs light analysis visibility",
];

const workflowSteps = [
  ["Search Token", "Start with a token contract or pair and load the research context."],
  ["Select Analysis Depth", "Choose Fast, Balanced, or Deep depending on how much holder behavior you want evaluated."],
  ["Evaluate Holder Quality", "Review available holder and wallet-quality signals with structural risk context."],
  ["Review Conviction Profile", "Leave with a readable thesis, risk drivers, and data confidence instead of raw noise."],
];

const heroWords = ["See", "Beyond", "The", "Chart"];

const reveal = {
  hidden: { opacity: 0, y: 24, filter: "blur(10px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)" },
};

const heroWordReveal = {
  hidden: { opacity: 0, y: 18, filter: "blur(12px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)" },
};

const staggerContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.09,
    },
  },
};

function smoothScrollTo(id: string) {
  const target = document.getElementById(id);
  if (!target) return;

  const start = window.scrollY;
  const end = target.getBoundingClientRect().top + window.scrollY - 72;
  const distance = end - start;
  const duration = 900;
  const startTime = performance.now();

  function easeInOutCubic(value: number) {
    return value < 0.5
      ? 4 * value * value * value
      : 1 - Math.pow(-2 * value + 2, 3) / 2;
  }

  function step(now: number) {
    const progress = Math.min(1, (now - startTime) / duration);
    window.scrollTo(0, start + distance * easeInOutCubic(progress));
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--nova-bg)] text-[color:var(--nova-text)]">
      <header className="sticky top-0 z-50 border-b border-[color:var(--nova-border-soft)] bg-[rgba(10,10,10,0.86)] backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/novaicon.png"
              alt="NovaOS"
              width={32}
              height={32}
              unoptimized
              className="h-8 w-8 object-contain"
            />
            <span className="text-sm font-semibold tracking-[-0.02em]">
              NovaOS
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-xs text-[color:var(--nova-text-muted)] md:flex">
            <a href="#how" onClick={(event) => { event.preventDefault(); smoothScrollTo("how"); }} className="transition hover:text-[color:var(--nova-text)]">
              How it works
            </a>
            <a href="#depth" onClick={(event) => { event.preventDefault(); smoothScrollTo("depth"); }} className="transition hover:text-[color:var(--nova-text)]">
              Depth
            </a>
            <a href="#terminal" onClick={(event) => { event.preventDefault(); smoothScrollTo("terminal"); }} className="transition hover:text-[color:var(--nova-text)]">
              Terminal
            </a>
          </nav>
          <Link
            href="/terminal"
            className="nova-button rounded-full px-4 py-2 text-xs font-medium transition"
          >
            Open Terminal
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden px-5 pb-32 pt-28 md:pb-44 md:pt-44">
        <div className="pointer-events-none absolute left-1/2 top-24 h-80 w-80 -translate-x-1/2 rounded-full bg-[rgba(83,104,120,0.08)] blur-[120px]" />
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="relative mx-auto flex max-w-5xl flex-col items-center text-center"
        >
            <motion.div
              variants={reveal}
              transition={{ duration: 1.15, ease: [0.16, 1, 0.3, 1] }}
              className="mb-12 h-32 w-32 object-contain md:mb-14 md:h-36 md:w-36"
            >
              <Image
                src="/novaicon.png"
                alt="NovaOS"
                width={144}
                height={144}
                unoptimized
                priority
                className="h-full w-full object-contain"
              />
            </motion.div>
            <motion.p variants={reveal} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} className="nova-tech mb-5 text-xs text-[color:var(--nova-accent-soft)]">
              AI-native onchain conviction intelligence
            </motion.p>
            <motion.h1
              variants={staggerContainer}
              transition={{ staggerChildren: 0.16, delayChildren: 0.16 }}
              className="nova-display max-w-5xl text-5xl leading-[0.98] text-[color:var(--nova-text)] md:text-7xl lg:text-8xl"
            >
              {heroWords.map((word) => (
                <motion.span
                  key={word}
                  variants={heroWordReveal}
                  transition={{ duration: 1.05, ease: [0.16, 1, 0.3, 1] }}
                  className={`mr-[0.22em] inline-block last:mr-0 ${word === "Chart" ? "gradient-word" : ""}`}
                >
                  {word}
                </motion.span>
              ))}
            </motion.h1>
            <motion.p variants={reveal} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} className="nova-copy mt-7 max-w-2xl text-base leading-7 text-[color:var(--nova-text-soft)] md:text-lg">
              NovaOS turns token holder behavior, wallet quality, liquidity
              conditions, and structural risk into a readable conviction profile.
            </motion.p>
            <motion.div variants={reveal} transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1] }} className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/terminal"
                className="nova-button rounded-full px-6 py-3 text-sm font-semibold transition"
              >
                Open Intelligence Terminal
              </Link>
              <a
                href="#how"
                onClick={(event) => { event.preventDefault(); smoothScrollTo("how"); }}
                className="rounded-full nova-card-inner px-6 py-3 text-sm font-semibold text-[color:var(--nova-text-soft)] transition hover:text-[color:var(--nova-text)]"
              >
                How It Works
              </a>
            </motion.div>
            <motion.p variants={reveal} transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }} className="nova-tech mt-5 text-[10px] text-[color:var(--nova-text-faint)]">
              Built for token research. Not financial advice.
            </motion.p>
        </motion.div>
      </section>

      <section id="how" className="px-5 py-28 md:py-36">
        <RevealSection className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr]">
            <div>
              <p className="nova-tech mb-4 text-xs text-[color:var(--nova-accent-soft)]">
                The Problem
              </p>
              <h2 className="nova-display text-4xl leading-tight md:text-6xl">
                Charts show price. They don&apos;t explain{" "}
                <span className="gradient-word">conviction.</span>
              </h2>
            </div>
            <motion.div variants={staggerContainer} className="grid gap-3 sm:grid-cols-2">
              {problemPoints.map((point) => (
                <motion.div variants={reveal} key={point} className="rounded-[1.5rem] nova-card p-5">
                  <p className="nova-copy text-sm leading-6 text-[color:var(--nova-text-soft)]">
                    {point}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </div>

          <div className="mt-28 md:mt-36">
            <p className="nova-tech mb-4 text-xs text-[color:var(--nova-accent-soft)]">
              Workflow
            </p>
            <h2 className="nova-display max-w-3xl text-4xl leading-tight md:text-6xl">
              How NovaOS <span className="gradient-word">Works</span>
            </h2>
            <p className="nova-copy mt-5 max-w-2xl text-sm leading-7 text-[color:var(--nova-text-soft)] md:text-base">
              Start with a token, choose an analysis depth, and review a
              conviction profile built from available onchain signals.
            </p>
            <motion.div variants={staggerContainer} className="mt-14 grid gap-4 md:grid-cols-4">
              {workflowSteps.map(([title, text], index) => (
                <motion.div variants={reveal} key={title} className="rounded-[1.5rem] nova-card p-5">
                  <span className="text-xs text-[color:var(--nova-text-faint)]">
                    0{index + 1}
                  </span>
                  <p className="nova-tech mt-5 text-xs text-[color:var(--nova-text)]">
                    {title}
                  </p>
                  <p className="nova-copy mt-3 text-sm leading-6 text-[color:var(--nova-text-muted)]">
                    {text}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </RevealSection>
      </section>

      <section className="px-5 py-28 md:py-36">
        <RevealSection className="mx-auto max-w-7xl">
          <SectionIntro
            eyebrow="What NovaOS analyzes"
            title={<>A conviction profile from multiple onchain <span className="gradient-word">signals.</span></>}
            text="NovaOS combines available holder, wallet, liquidity, flow, and confidence inputs into a readable research surface."
          />
          <motion.div variants={staggerContainer} className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {analysisCards.map(([title, text]) => (
              <motion.div variants={reveal} key={title} className="rounded-[1.5rem] nova-card p-5">
                <p className="nova-tech text-xs text-[color:var(--nova-text)]">
                  {title}
                </p>
                <p className="nova-copy mt-4 text-sm leading-6 text-[color:var(--nova-text-muted)]">
                  {text}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </RevealSection>
      </section>

      <section id="depth" className="px-5 py-28 md:py-36">
        <RevealSection className="mx-auto max-w-7xl">
          <SectionIntro
            eyebrow="Analysis Depth"
            title={<>Choose how much holder behavior NovaOS <span className="gradient-word">evaluates.</span></>}
            text="Deeper modes take longer because more holder behavior is evaluated."
          />
          <motion.div variants={staggerContainer} className="mt-14 grid gap-4 md:grid-cols-3">
            {depthModes.map(([mode, detail]) => (
              <motion.div variants={reveal} key={mode} className="rounded-[1.75rem] nova-card-strong p-6">
                <p className="nova-tech text-xs text-[color:var(--nova-accent-soft)]">
                  {mode}
                </p>
                <p className="nova-copy mt-5 text-lg leading-7 text-[color:var(--nova-text-soft)]">
                  {detail}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </RevealSection>
      </section>

      <section className="px-5 py-28 md:py-36">
        <RevealSection className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[1fr_1fr]">
          <div>
            <p className="nova-tech mb-4 text-xs text-[color:var(--nova-accent-soft)]">
              Explainability
            </p>
            <h2 className="nova-display text-4xl md:text-6xl">
              Every score needs a <span className="gradient-word">reason.</span>
            </h2>
          </div>
          <div className="rounded-[2rem] nova-card p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              {explainabilityItems.map((item) => (
                <div key={item} className="rounded-[1.2rem] nova-card-inner px-4 py-3">
                  <p className="nova-copy text-sm text-[color:var(--nova-text-soft)]">
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </RevealSection>
      </section>

      <section id="terminal" className="px-5 py-32 md:py-44">
        <RevealSection className="mx-auto max-w-5xl text-center">
          <h2 className="nova-display text-4xl md:text-6xl">
            Start with a token. Leave with a <span className="gradient-word">thesis.</span>
          </h2>
          <Link
            href="/terminal"
            className="nova-button mt-8 inline-flex rounded-full px-7 py-3 text-sm font-semibold transition"
          >
            Launch Terminal
          </Link>
        </RevealSection>
      </section>

      <footer className="border-t border-[color:var(--nova-border-soft)] px-5 py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 text-xs text-[color:var(--nova-text-muted)] md:flex-row md:items-center md:justify-between">
          <p className="font-medium text-[color:var(--nova-text)]">NovaOS</p>
          <p>AI-native onchain conviction intelligence.</p>
          <p>Research tool. Not financial advice.</p>
        </div>
      </footer>
    </main>
  );
}

function RevealSection({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-120px" }}
      variants={reveal}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionIntro({
  eyebrow,
  text,
  title,
}: {
  eyebrow: string;
  text: string;
  title: ReactNode;
}) {
  return (
    <div>
      <p className="nova-tech mb-4 text-xs text-[color:var(--nova-accent-soft)]">
        {eyebrow}
      </p>
      <h2 className="nova-display max-w-3xl text-4xl leading-tight md:text-6xl">
        {title}
      </h2>
      <p className="nova-copy mt-5 max-w-2xl text-sm leading-7 text-[color:var(--nova-text-soft)] md:text-base">
        {text}
      </p>
    </div>
  );
}
