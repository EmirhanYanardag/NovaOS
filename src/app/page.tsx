"use client";

import { motion, useReducedMotion } from "framer-motion";
import ShaderLandingBackground from "@/components/ShaderLandingBackground";
import Image from "next/image";
import Link from "next/link";
import type { ElementType, ReactNode } from "react";
import { useEffect, useState } from "react";

const analysisCards = [
  [
    "Holder Quality",
    "Measures whether ownership is dominated by long-term conviction, experienced wallets, or short-term speculative activity.",
  ],
  [
    "Risk Pressure",
    "Identifies hidden structural weaknesses including concentrated ownership, distribution pressure, and fragile holder composition.",
  ],
  [
    "Liquidity Health",
    "Evaluates whether liquidity conditions support sustainable participation or amplify future volatility and exit risk.",
  ],
  [
    "Smart Money Flow",
    "Tracks the presence, activity, and conviction of wallets that historically demonstrate stronger market behavior.",
  ],
  [
    "Data Confidence",
    "Shows how much evidence exists behind the analysis and how reliable the resulting conviction profile should be considered.",
  ],
];

const depthModes = [
  ["Fast", "Quickly evaluates the highest-impact holders to produce an immediate conviction snapshot."],
  ["Balanced", "Expands coverage across a broader holder sample to improve behavioral accuracy and ownership context."],
  ["Deep", "Performs the most extensive ownership investigation, uncovering deeper wallet patterns, structural risks, and conviction signals."],
];

const problemPoints = [
  "A token can trend upward while weak holders, short-term wallets, or toxic ownership quietly dominate the supply.",
  "Liquidity can look healthy on the chart, but holder behavior may show rising sell pressure, rotation, or exit risk.",
  "Top holders often reveal the real structure first: accumulation, distribution, bundled wallets, whale pressure, and confidence quality.",
  "Raw wallet data is noisy. NovaOS turns holder quality, risk pressure, and market health into a readable conviction profile.",
];

const explainabilityItems = [
  "Conviction Drivers",
  "Holder Quality Breakdown",
  "Risk Contributors",
  "Liquidity Context",
  "Ownership Structure",
  "Confidence & Coverage",
];

const roadmapItems = [
  {
    phase: "Phase 01",
    label: "Today",
    title: "Token Conviction Intelligence",
    text: "Analyze holder quality, ownership structure, smart-money participation, liquidity health, and risk pressure behind any token.",
  },
  {
    phase: "Phase 02",
    label: "Next",
    title: "Wallet Intelligence Layer",
    text: "Build behavioral profiles for individual wallets, identifying conviction patterns, risk tendencies, accumulation behavior, and historical performance.",
  },
  {
    phase: "Phase 03",
    label: "Future",
    title: "Capital Flow Mapping",
    text: "Track how capital rotates between wallets, sectors, ecosystems, and narratives before it becomes visible on price charts.",
  },
  {
    phase: "Phase 04",
    label: "Expansion",
    title: "Narrative Intelligence",
    text: "Understand which stories, communities, and market themes are attracting conviction and driving ownership changes across the market.",
  },
  {
    phase: "Phase 05",
    label: "Vision",
    title: "The Conviction Graph",
    text: "A living intelligence network connecting tokens, wallets, narratives, and capital flows into a single explainable research layer.",
  },
];

const workflowSteps = [
  ["Select a Token", "Start with any token contract. NovaOS loads holder distribution, wallet activity, liquidity structure, and ownership signals."],
  ["Map the Holder Base", "Analyze who owns the supply, how concentrated ownership is, and whether conviction comes from strong or weak hands."],
  ["Trace Onchain Behavior", "Observe accumulation, distribution, wallet rotation, retention patterns, and smart-money participation across the holder base."],
  ["Build the Thesis", "Combine structural signals into a conviction profile with explainable scores, risk drivers, and confidence context."],
];

const navItems = [
  ["Problem", "problem"],
  ["Process", "workflow"],
  ["Signals", "signals"],
  ["Depth", "depth"],
  ["Explain", "explain"],
  ["Roadmap", "roadmap"],
  ["Pricing", "pricing"],
] as const;

type HeadingToken = {
  text: string;
  gradient?: boolean;
};

const heroWords: HeadingToken[] = [
  { text: "See" },
  { text: "Beyond" },
  { text: "The" },
  { text: "Chart", gradient: true },
];

const problemHeading: HeadingToken[] = [
  { text: "Price" },
  { text: "moves" },
  { text: "fast." },
  { text: "Conviction" },
  { text: "explains" },
  { text: "why.", gradient: true },
];

const workflowHeading: HeadingToken[] = [
  { text: "From" },
  { text: "a" },
  { text: "token" },
  { text: "address" },
  { text: "to" },
  { text: "a" },
  { text: "conviction" },
  { text: "thesis.", gradient: true },
];

const analysisHeading: HeadingToken[] = [
  { text: "Ownership" },
  { text: "reveals" },
  { text: "what" },
  { text: "price" },
  { text: "cannot.", gradient: true },
];

const depthHeading: HeadingToken[] = [
  { text: "Choose" },
  { text: "how" },
  { text: "deeply" },
  { text: "NovaOS" },
  { text: "investigates" },
  { text: "ownership.", gradient: true },
];

const explainabilityHeading: HeadingToken[] = [
  { text: "Every" },
  { text: "conviction" },
  { text: "score" },
  { text: "is" },
  { text: "traceable.", gradient: true },
];

const roadmapHeading: HeadingToken[] = [
  { text: "Building" },
  { text: "the" },
  { text: "operating" },
  { text: "system" },
  { text: "for" },
  { text: "onchain" },
  { text: "conviction.", gradient: true },
];

const pricingHeading: HeadingToken[] = [
  { text: "Pricing" },
  { text: "during" },
  { text: "demo" },
  { text: "access", gradient: true },
];

const finalHeading: HeadingToken[] = [
  { text: "See" },
  { text: "what" },
  { text: "the" },
  { text: "chart" },
  { text: "cannot" },
  { text: "show.", gradient: true },
];

const sectionTitleReveal = {
  hidden: { opacity: 0, y: 42, scale: 0.96, filter: "blur(18px)" },
  visible: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
};

const sectionTextReveal = {
  hidden: { opacity: 0, y: 22, filter: "blur(12px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)" },
};

const sectionCardReveal = {
  hidden: { opacity: 0, y: 44, scale: 0.96, filter: "blur(18px)" },
  visible: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
};

const heroWordReveal = {
  hidden: { opacity: 0, y: 42, scale: 0.96, filter: "blur(18px)" },
  visible: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
};

const heroIconReveal = {
  hidden: { opacity: 0, scale: 0.92, filter: "blur(14px)" },
  visible: { opacity: 1, scale: 1, filter: "blur(0px)" },
};

const heroEyebrowReveal = {
  hidden: { opacity: 0, y: 18, filter: "blur(12px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)" },
};

const heroSubtitleReveal = {
  hidden: { opacity: 0, y: 22, filter: "blur(14px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)" },
};

const heroButtonsReveal = {
  hidden: { opacity: 0, y: 18, scale: 0.96, filter: "blur(10px)" },
  visible: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
};

const heroDisclaimerReveal = {
  hidden: { opacity: 0, y: 12, filter: "blur(8px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)" },
};

const heroHeadingContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.14,
      delayChildren: 0.72,
    },
  },
};

const staggerContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.09,
    },
  },
};

const sectionCardContainer = {
  hidden: {},
  visible: {
    transition: {
      delayChildren: 0.55,
      staggerChildren: 0.18,
    },
  },
};

const premiumCardClass = "nova-landing-glass-card";

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

function CinematicHeading({
  as = "h2",
  className,
  tokens,
}: {
  as?: "h1" | "h2";
  className: string;
  tokens: HeadingToken[];
}) {
  const shouldReduceMotion = useReducedMotion();
  const HeadingTag = (as === "h1" ? motion.h1 : motion.h2) as ElementType;
  const containerVariants = as === "h1" ? heroHeadingContainer : {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.14,
      },
    },
  };

  if (shouldReduceMotion) {
    const StaticTag = as;

    return (
      <StaticTag className={className}>
        {tokens.map((token, index) => (
          <span
            key={`${token.text}-${index}`}
            className={`mr-[0.16em] inline-block last:mr-0 ${token.gradient ? "gradient-word" : ""}`}
          >
            {token.text}
          </span>
        ))}
      </StaticTag>
    );
  }

  return (
    <HeadingTag variants={containerVariants} className={className}>
      {tokens.map((token, index) => (
        <motion.span
          key={`${token.text}-${index}`}
          variants={as === "h1" ? heroWordReveal : sectionTitleReveal}
          transition={{ duration: 1.05, ease: [0.16, 1, 0.3, 1] }}
          className={`mr-[0.16em] inline-block last:mr-0 ${token.gradient ? "gradient-word" : ""}`}
        >
          {token.text}
        </motion.span>
      ))}
    </HeadingTag>
  );
}

function CinematicDescription({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <p className={className}>{children}</p>;
  }

  return (
    <motion.p
      variants={sectionTextReveal}
      transition={{ duration: 0.85, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.p>
  );
}

function CinematicCard({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      variants={sectionCardReveal}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function CardTitleReveal({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <p className={className}>{children}</p>;
  }

  return (
    <motion.p
      variants={{
        hidden: { opacity: 0, y: 8, filter: "blur(6px)" },
        visible: { opacity: 1, y: 0, filter: "blur(0px)" },
      }}
      transition={{ duration: 0.55, delay: 0.42, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.p>
  );
}

function TypewriterReveal({
  className,
  delay = 0.68,
  text,
}: {
  className: string;
  delay?: number;
  text: string;
}) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <p className={className}>{text}</p>;
  }

  return (
    <motion.p
      className={className}
      variants={{
        hidden: {},
        visible: {
          transition: {
            delayChildren: delay,
            staggerChildren: 0.045,
          },
        },
      }}
    >
      {text.split(/(\s+)/).map((part, index) => {
        if (/^\s+$/.test(part)) {
          return part;
        }

        return (
          <motion.span
            key={`${part}-${index}`}
            variants={{
              hidden: { opacity: 0, filter: "blur(4px)" },
              visible: { opacity: 1, filter: "blur(0px)" },
            }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="inline-block"
          >
            {part}
          </motion.span>
        );
      })}
    </motion.p>
  );
}

export default function Home() {
  const [activeSection, setActiveSection] = useState<(typeof navItems)[number][1] | null>(null);

  useEffect(() => {
    function updateActiveSection() {
      const offset = 180;
      const problemSection = document.getElementById("problem");

      if (!problemSection || problemSection.getBoundingClientRect().top > offset) {
        setActiveSection(null);
        return;
      }

      const current = navItems.reduce<(typeof navItems)[number][1] | null>((active, [, id]) => {
        const section = document.getElementById(id);
        if (!section) return active;
        return section.getBoundingClientRect().top <= offset ? id : active;
      }, null);

      setActiveSection(current);
    }

    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("resize", updateActiveSection);

    return () => {
      window.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);
    };
  }, []);

  return (
    <>
      <header className="fixed left-1/2 top-3 z-[9999] w-[calc(100%-24px)] max-w-[1440px] -translate-x-1/2 rounded-[24px] border border-white/10 bg-[#0a0c0d]/[0.48] px-4 py-3 font-[family:var(--font-geist-sans)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_24px_90px_rgba(0,0,0,0.42)] backdrop-blur-[26px] md:top-6 md:w-[calc(100%-64px)] md:rounded-[30px] md:px-7 md:py-4">
        <div className="flex h-10 items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/novaicon.png"
              alt="NovaOS"
              width={20}
              height={20}
              unoptimized
              className="h-5 w-5 object-contain"
            />
            <span className="text-sm font-semibold tracking-[-0.02em] text-white/90 md:text-[15px] md:font-bold">
              NovaOS
            </span>
          </Link>
          <nav className="hidden items-center gap-5 lg:gap-7 md:flex">
            {navItems.map(([label, id]) => {
              const isActive = activeSection === id;

              return (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={(event) => {
                    event.preventDefault();
                    smoothScrollTo(id);
                    setActiveSection(id);
                  }}
                  className={`group relative text-xs font-medium transition-all duration-300 ease-out hover:-translate-y-0.5 hover:text-white/90 lg:text-sm ${
                    isActive
                      ? "text-[#b5b09d] drop-shadow-[0_0_12px_rgba(181,176,157,0.14)]"
                      : "text-white/52"
                  }`}
                >
                  {label}
                  <span
                    className={`absolute -bottom-2 left-1/2 h-px -translate-x-1/2 bg-[#b5b09d] transition-all duration-300 ${
                      isActive ? "w-full" : "w-0 group-hover:w-full"
                    }`}
                  />
                </a>
              );
            })}
          </nav>
          <Link
            href="/terminal"
            className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/[0.045] px-6 py-3 text-xs font-bold uppercase tracking-[0.08em] text-[#E3E0D7] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_12px_40px_rgba(0,0,0,0.28)] backdrop-blur-[28px] transition-all duration-500 ease-out hover:-translate-y-0.5 hover:scale-[1.02] hover:border-[#B5B09F]/40 hover:bg-[#B5B09F]/[0.045] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_0_24px_rgba(181,176,159,0.14),0_0_60px_rgba(181,176,159,0.06)]"
          >
            ANALYZE
          </Link>
        </div>
      </header>

      <main className="nova-landing relative isolate min-h-screen overflow-hidden text-[color:var(--nova-text)]">
      <ShaderLandingBackground />
      <section className="relative flex min-h-screen items-center overflow-hidden px-5 pb-28 pt-32 md:pb-36 md:pt-36">
        <div className="pointer-events-none absolute left-1/2 top-24 h-80 w-80 -translate-x-1/2 rounded-full bg-[rgba(83,104,120,0.08)] blur-[120px]" />
        <motion.div
          initial="hidden"
          animate="visible"
          className="relative isolate mx-auto flex max-w-6xl flex-col items-center text-center"
        >
            <motion.div
              variants={heroIconReveal}
              transition={{ duration: 1, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="mb-14 h-44 w-44 object-contain md:mb-16 md:h-52 md:w-52"
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
            <motion.p variants={heroEyebrowReveal} transition={{ duration: 0.85, delay: 0.45, ease: [0.16, 1, 0.3, 1] }} className="nova-tech mb-7 text-[11px] font-medium text-white/45 md:text-xs">
              AI-native onchain conviction intelligence
            </motion.p>
            <CinematicHeading
              as="h1"
              tokens={heroWords}
              className="nova-display nova-hero-title max-w-6xl text-[3.05rem] font-black leading-[0.94] tracking-[-0.032em] text-[#E3E0D7] md:text-[4.85rem] md:leading-[0.94] lg:text-[5.95rem]"
            />
            <motion.p variants={heroSubtitleReveal} transition={{ duration: 0.85, delay: 1.62, ease: [0.16, 1, 0.3, 1] }} className="nova-tech mt-9 max-w-3xl text-[10px] font-medium leading-7 text-white/45 md:text-xs">
              NovaOS turns token holder behavior, wallet quality, liquidity
              conditions, and structural risk into a readable conviction profile.
            </motion.p>
            <motion.div variants={heroButtonsReveal} transition={{ duration: 0.8, delay: 1.86, ease: [0.16, 1, 0.3, 1] }} className="mt-11 flex justify-center">
              <Link
                href="/terminal"
                className="nova-landing-button nova-landing-button-cta rounded-full px-9 py-3.5 text-xs font-bold md:px-10 md:py-4"
              >
                START YOUR ANALYSIS
              </Link>
            </motion.div>
            <motion.p variants={heroDisclaimerReveal} transition={{ duration: 0.7, delay: 2.08, ease: [0.16, 1, 0.3, 1] }} className="nova-tech mt-6 text-[10px] text-white/35">
              Built for token research. Not financial advice.
            </motion.p>
        </motion.div>
      </section>

      <section id="problem" className="flex min-h-screen items-center px-5 py-32 md:py-40 lg:py-48">
        <RevealSection className="mx-auto w-full max-w-7xl">
          <motion.div variants={staggerContainer} className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <motion.div variants={{ hidden: {}, visible: {} }}>
              <CinematicHeading
                tokens={problemHeading}
                className="nova-display nova-section-title max-w-4xl text-[2.46rem] leading-[0.94] tracking-[-0.032em] text-[#E3E0D7] md:text-[3.7rem] lg:text-[4.45rem]"
              />
            </motion.div>
            <motion.div variants={sectionCardContainer} className="grid gap-6 sm:grid-cols-2">
              {problemPoints.map((point) => (
                <CinematicCard key={point} className={premiumCardClass}>
                  <TypewriterReveal
                    delay={0.5}
                    text={point}
                    className="nova-copy text-base font-normal leading-[1.9] text-white/72"
                  />
                </CinematicCard>
              ))}
            </motion.div>
          </motion.div>
        </RevealSection>
      </section>

      <section id="workflow" className="px-5 py-40 md:py-48 lg:py-56">
        <RevealSection className="mx-auto max-w-7xl">
          <div>
            <SectionIntro
              eyebrow="Workflow"
              titleTokens={workflowHeading}
              text="NovaOS transforms fragmented wallet activity, holder behavior, liquidity structure, and smart-money signals into a readable conviction profile."
            />
            <motion.div variants={sectionCardContainer} className="mt-16 grid gap-5 md:grid-cols-4">
              {workflowSteps.map(([title, text], index) => (
                <CinematicCard key={title} className={premiumCardClass}>
                  <span className="text-xs font-medium text-white/35">
                    0{index + 1}
                  </span>
                  <CardTitleReveal className="nova-tech mt-6 text-sm font-semibold tracking-[0.18em] text-white/82">
                    {title}
                  </CardTitleReveal>
                  <TypewriterReveal
                    text={text}
                    className="nova-copy mt-4 text-base leading-relaxed text-white/52"
                  />
                </CinematicCard>
              ))}
            </motion.div>
          </div>
        </RevealSection>
      </section>

      <section id="signals" className="px-5 py-40 md:py-48 lg:py-56">
        <RevealSection className="mx-auto max-w-7xl">
          <SectionIntro
            eyebrow="What NovaOS Analyzes"
            titleTokens={analysisHeading}
            text="NovaOS focuses on the behavior behind the chart: who owns the supply, how they behave, and whether conviction is strengthening or deteriorating."
          />
          <motion.div variants={sectionCardContainer} className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-5">
            {analysisCards.map(([title, text]) => (
              <CinematicCard key={title} className={premiumCardClass}>
                <CardTitleReveal className="nova-tech text-sm font-semibold tracking-[0.18em] text-white/82">
                  {title}
                </CardTitleReveal>
                <TypewriterReveal
                  text={text}
                  className="nova-copy mt-5 text-base leading-relaxed text-white/52"
                />
              </CinematicCard>
            ))}
          </motion.div>
        </RevealSection>
      </section>

      <section id="depth" className="px-5 py-40 md:py-48 lg:py-56">
        <RevealSection className="mx-auto max-w-7xl">
          <SectionIntro
            eyebrow="Analysis Depth"
            titleTokens={depthHeading}
            text="Different research depths examine different amounts of holder behavior, wallet history, and conviction evidence."
          />
          <motion.div variants={sectionCardContainer} className="mt-16 grid gap-5 md:grid-cols-3">
            {depthModes.map(([mode, detail]) => (
              <CinematicCard key={mode} className={`${premiumCardClass} p-7`}>
                <CardTitleReveal className="nova-tech text-sm font-semibold tracking-[0.18em] text-white/82">
                  {mode}
                </CardTitleReveal>
                <TypewriterReveal
                  text={detail}
                  className="nova-copy mt-6 text-lg leading-relaxed text-white/52"
                />
              </CinematicCard>
            ))}
          </motion.div>
        </RevealSection>
      </section>

      <section id="explain" className="px-5 py-40 md:py-48 lg:py-56">
        <RevealSection className="mx-auto grid max-w-7xl gap-16 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <SectionIntro
              eyebrow="Explainability"
              titleTokens={explainabilityHeading}
              text="NovaOS does not generate black-box ratings. Every score is connected to observable ownership behavior and structural evidence."
            />
          </div>
          <motion.div variants={sectionCardContainer} className="grid gap-4 sm:grid-cols-2">
              {explainabilityItems.map((item) => (
                <CinematicCard key={item} className={`${premiumCardClass} px-5 py-4`}>
                  <TypewriterReveal
                    delay={0.48}
                    text={item}
                    className="nova-copy text-base font-medium text-white/62"
                  />
                </CinematicCard>
              ))}
          </motion.div>
        </RevealSection>
      </section>

      <section id="roadmap" className="px-5 py-40 md:py-48 lg:py-56">
        <RevealSection className="mx-auto max-w-7xl">
          <SectionIntro
            eyebrow="Roadmap"
            titleTokens={roadmapHeading}
            text="NovaOS starts with token intelligence. The long-term vision is a complete intelligence layer that explains how capital, wallets, and narratives move across crypto markets."
          />

          <motion.div
            variants={{
              hidden: {},
              visible: {
                transition: {
                  delayChildren: 0.55,
                  staggerChildren: 0.12,
                },
              },
            }}
            className="relative left-1/2 mt-16 w-[min(92vw,1500px)] -translate-x-1/2"
          >
            <div className="roadmap-card-stack relative z-10 space-y-10">
              {roadmapItems.map((item) => (
                <CinematicCard key={item.phase} className={`${premiumCardClass} roadmap-card px-6 py-6 md:px-8 md:py-7`}>
                  <div className="roadmap-card-layout grid gap-5 xl:grid-cols-[minmax(320px,0.28fr)_minmax(0,0.72fr)] xl:items-center xl:gap-8">
                    <div className="min-w-0">
                      <span className="nova-tech block whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.22em] text-[#a39e8b]">
                        {item.label}
                      </span>
                      <CardTitleReveal className="nova-copy mt-3 whitespace-nowrap text-xl font-semibold tracking-[-0.035em] text-white/88 md:text-2xl">
                          {item.title}
                      </CardTitleReveal>
                    </div>
                    <TypewriterReveal
                      delay={0.48}
                      text={item.text}
                      className="nova-copy roadmap-card-description min-w-0 whitespace-nowrap text-[0.86rem] leading-relaxed text-white/52 min-[1500px]:text-[0.95rem] xl:text-left"
                    />
                  </div>
                </CinematicCard>
              ))}
            </div>
          </motion.div>
        </RevealSection>
      </section>

      <section id="pricing" className="px-5 py-40 md:py-48 lg:py-56">
        <RevealSection className="mx-auto max-w-7xl">
          <SectionIntro
            eyebrow="Early Access"
            titleTokens={pricingHeading}
            text="NovaOS is currently available in demo mode while the intelligence engine continues to evolve. During this phase, every feature is accessible at no cost."
          />

          <motion.div variants={sectionCardContainer} className="mx-auto mt-16 max-w-4xl">
            <CinematicCard className={`${premiumCardClass} p-8 md:p-10`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitleReveal className="nova-tech text-xs font-semibold uppercase tracking-[0.22em] text-[#a39e8b]">
                    Demo Pricing
                  </CardTitleReveal>
                  <p className="nova-copy mt-3 max-w-xl text-sm leading-relaxed text-white/52">
                    Complete platform access while NovaOS is in demo availability.
                  </p>
                </div>
                <span className="nova-tech rounded-full border border-white/12 bg-white/[0.045] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a39e8b]">
                  DEMO ACCESS
                </span>
              </div>

              <div className="mt-10 text-center">
                <div className="relative mx-auto inline-flex px-3 text-4xl font-semibold tracking-[-0.05em] text-white/42">
                  $25/mo
                  <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-[#b5b09d]/70" />
                </div>
                <div className="nova-display mt-2 bg-gradient-to-r from-[#E3E0D7] via-[#b5b09d] to-[#a39e8b] bg-clip-text text-[5.6rem] font-black leading-[0.9] tracking-[-0.04em] text-transparent md:text-[7rem]">
                  FREE
                </div>
              </div>

              <div className="mt-10 grid gap-3 sm:grid-cols-2">
                {[
                  "Full Conviction Engine Access",
                  "Wallet Intelligence Access",
                  "Insider Scan Access",
                  "AI vs Human Arena Access",
                ].map((feature) => (
                  <div key={feature} className="nova-copy flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 py-3 text-sm font-medium text-white/64">
                    <span className="text-[#a39e8b]">✓</span>
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              <p className="nova-copy mt-8 text-center text-xs leading-relaxed text-white/42">
                All NovaOS features are currently available for free during the demo phase. Future pricing may be introduced as additional intelligence layers and infrastructure are deployed.
              </p>
            </CinematicCard>
          </motion.div>
        </RevealSection>
      </section>

      <section id="terminal" className="px-5 py-44 md:py-52 lg:py-64">
        <RevealSection className="mx-auto max-w-5xl text-center">
          <CinematicHeading
            tokens={finalHeading}
            className="nova-display nova-section-title text-[2.46rem] font-black leading-[0.94] tracking-[-0.032em] text-[#E3E0D7] md:text-[3.7rem] lg:text-[4.45rem]"
          />
          <CinematicDescription className="nova-copy mx-auto mt-6 max-w-[720px] text-base leading-relaxed text-white/55">
            Start with a token and leave with a readable conviction thesis.
          </CinematicDescription>
          <Link
            href="/terminal"
            className="nova-landing-button nova-landing-button-cta mt-10 inline-flex rounded-full px-9 py-3.5 text-xs font-bold md:px-10 md:py-4"
          >
            LAUNCH TERMINAL
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
    </>
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
      viewport={{ once: true, amount: 0.35 }}
      variants={{ hidden: {}, visible: {} }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionIntro({
  text,
  titleTokens,
}: {
  eyebrow: string;
  text: string;
  titleTokens: HeadingToken[];
}) {
  return (
    <div>
      <CinematicHeading
        tokens={titleTokens}
        className="nova-display nova-section-title max-w-4xl text-[2.46rem] font-black leading-[0.94] tracking-[-0.032em] text-[#E3E0D7] md:text-[3.7rem] lg:text-[4.45rem]"
      />
      <CinematicDescription className="nova-copy mt-6 max-w-[720px] text-base leading-relaxed text-white/55">
        {text}
      </CinematicDescription>
    </div>
  );
}
