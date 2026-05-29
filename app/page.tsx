"use client";

import { motion } from "framer-motion";

const reveal = {
  initial: { opacity: 0, y: 40, filter: "blur(14px)" },
  whileInView: { opacity: 1, y: 0, filter: "blur(0px)" },
  viewport: { once: true, margin: "-160px" },
  transition: { duration: 1 },
};

const headingGradient =
  "bg-gradient-to-r from-cyan-100 via-slate-200 to-sky-200 bg-clip-text text-transparent";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020407] text-white">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(2,32,38,0.78),transparent_34%),radial-gradient(circle_at_18%_72%,rgba(46,1,1,0.16),transparent_32%),radial-gradient(circle_at_82%_68%,rgba(25,9,38,0.24),transparent_34%),linear-gradient(to_bottom,#020407,#03080b_45%,#010203)]" />
      <div className="fixed inset-0 opacity-[0.05] bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:90px_90px]" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.38)_56%,rgba(0,0,0,0.86)_100%)]" />

      <header className="fixed left-1/2 top-5 z-50 flex w-[92%] max-w-6xl -translate-x-1/2 items-center justify-between rounded-full border border-white/10 bg-black/20 px-5 py-3 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
        <div className="flex items-center gap-3">
          <div className="relative h-7 w-7">
            <div className="absolute inset-0 rounded-full bg-cyan-300/20 blur-md" />
            <div className="relative h-7 w-7 rounded-full border border-cyan-200/25 bg-gradient-to-br from-cyan-100/55 via-[#192638] to-[#190926]" />
          </div>
          <span className="text-sm font-semibold tracking-[0.02em] text-white/90">
            NovaOS
          </span>
        </div>

        <nav className="hidden items-center gap-8 text-xs text-white/45 md:flex">
          {["Product", "Intelligence", "Terminal", "Roadmap"].map((item) => (
            <a
              key={item}
              className="transition duration-300 hover:text-cyan-100"
              href="#"
            >
              {item}
            </a>
          ))}
        </nav>

        <a
  href="/terminal"
  className="rounded-full border border-cyan-200/15 bg-cyan-200/[0.045] px-5 py-2 text-xs text-cyan-100/85 transition duration-300 hover:bg-cyan-200/10"
>
  Launch App
</a>
      </header>

      <section className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 pt-24 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.65, filter: "blur(30px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 1.4, ease: "easeOut" }}
          className="relative mb-12"
        >
          <div className="absolute -inset-44 rounded-full bg-cyan-900/30 blur-[130px]" />
          <div className="absolute -inset-28 rounded-full border border-cyan-100/8" />
          <div className="absolute -inset-16 rounded-full border border-red-200/5" />

          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 38, repeat: Infinity, ease: "linear" }}
            className="relative h-56 w-56 rounded-full border border-white/10 bg-[radial-gradient(circle_at_34%_28%,rgba(170,235,255,0.24),rgba(2,32,38,0.46)_34%,rgba(25,9,38,0.54)_58%,rgba(2,4,7,0.95)_74%)] shadow-[0_0_150px_rgba(56,189,248,0.16)]"
          >
            <div className="absolute inset-6 rounded-full border border-white/10" />
            <div className="absolute inset-16 rounded-full bg-cyan-200/14 blur-2xl" />
            <div className="absolute left-1/2 top-1/2 h-[1px] w-80 -translate-x-1/2 -translate-y-1/2 rotate-12 bg-gradient-to-r from-transparent via-cyan-100/24 to-transparent" />
            <div className="absolute left-1/2 top-1/2 h-[1px] w-80 -translate-x-1/2 -translate-y-1/2 -rotate-12 bg-gradient-to-r from-transparent via-purple-200/18 to-transparent" />
            <div className="absolute left-1/2 top-1/2 h-[1px] w-64 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-gradient-to-r from-transparent via-red-200/10 to-transparent" />
          </motion.div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.8 }}
          className="mb-6 rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-xs tracking-wide text-white/50 backdrop-blur-xl"
        >
          AI-native onchain conviction intelligence
        </motion.p>

        <motion.h1 className="max-w-6xl text-6xl font-semibold leading-[0.92] tracking-[-0.08em] text-white/95 md:text-9xl">
  {[
    ["See", "What"],
    ["Smart", "Capital", "Sees."],
  ].map((line, lineIndex) => (
    <span key={lineIndex} className="block">
      {line.map((word, wordIndex) => (
        <motion.span
          key={word}
          initial={{ opacity: 0, y: 28, scale: 0.96, filter: "blur(18px)" }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          transition={{
            delay: 0.45 + lineIndex * 0.18 + wordIndex * 0.14,
            duration: 0.75,
            ease: [0.16, 1, 0.3, 1],
          }}
          className={`inline-block ${
            word === "Sees." ? headingGradient : ""
          }`}
        >
          {word}
          {wordIndex !== line.length - 1 && "\u00A0"}
        </motion.span>
      ))}
    </span>
  ))}
</motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.9 }}
          className="mt-8 max-w-2xl text-base leading-relaxed text-white/48 md:text-lg"
        >
          NovaOS transforms raw blockchain activity into AI-powered conviction
          intelligence, revealing smart money flow, insider behavior and hidden
          market intent.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.9 }}
          className="mt-10 flex flex-col gap-4 sm:flex-row"
        >
          <a
  href="/terminal"
  className="rounded-full bg-cyan-100 px-8 py-4 text-sm font-semibold text-black shadow-[0_0_70px_rgba(125,211,252,0.16)] transition duration-300 hover:scale-[1.025] hover:bg-white hover:shadow-[0_0_90px_rgba(125,211,252,0.22)]"
>
  Analyze Any Token
</a>

          <button className="rounded-full border border-white/10 bg-white/[0.03] px-8 py-4 text-sm font-semibold text-white/70 backdrop-blur-xl transition duration-300 hover:border-cyan-100/20 hover:bg-white/[0.06] hover:text-white">
            Explore Terminal
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.32, duration: 1 }}
          className="mt-12 flex items-center gap-4 text-xs text-white/32"
        >
          <span>Ethereum</span>
          <span>•</span>
          <span>Base</span>
          <span>•</span>
          <span>Mantle</span>
          <span>•</span>
          <span>Solana</span>
        </motion.div>
      </section>

      <SectionProblem />
      <SectionConviction />
      <SectionBubble />
      <SectionSocial />
      <SectionTerminal />
      <SectionMultichain />
      <SectionFinal />
    </main>
  );
}

function SectionProblem() {
  return (
    <section className="relative z-10 min-h-screen px-6 py-36">
      <div className="mx-auto grid max-w-7xl items-center gap-20 md:grid-cols-2">
        <motion.div {...reveal}>
          <p className="mb-6 text-xs uppercase tracking-[0.45em] text-cyan-100/45">
            The Problem
          </p>

          <h2 className="text-5xl font-semibold leading-[1] tracking-[-0.065em] md:text-7xl">
            Markets show price.
            <br />
            NovaOS shows <span className={headingGradient}>conviction.</span>
          </h2>

          <p className="mt-8 max-w-xl text-lg leading-relaxed text-white/45">
            Price is the outcome. Conviction is the cause. NovaOS reads the
            hidden behavior behind the chart.
          </p>
        </motion.div>

        <motion.div
          {...reveal}
          transition={{ duration: 1, delay: 0.15 }}
          className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-white/[0.032] p-7 backdrop-blur-2xl"
        >
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-900/18 blur-3xl" />

          <div className="relative space-y-4">
            {[
              ["Smart Money Accumulation", "+2.4M", "High-quality wallets increased exposure.", "bg-cyan-100/[0.035] border-cyan-100/10 text-cyan-100/70"],
              ["Insider Cluster Risk", "Moderate", "Early linked wallets detected.", "bg-[#2e0101]/20 border-red-200/10 text-red-100/65"],
              ["Narrative Rotation", "AI Agents ↑", "Capital flow shifting toward agent tokens.", "bg-[#190926]/30 border-purple-200/10 text-purple-100/65"],
            ].map(([title, value, desc, style]) => (
              <div
                key={title}
                className={`rounded-3xl border p-6 ${style}`}
              >
                <p className="text-sm">{title}</p>
                <p className="mt-2 text-4xl font-semibold tracking-[-0.05em] text-white">
                  {value}
                </p>
                <p className="mt-2 text-sm text-white/35">{desc}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function SectionConviction() {
  return (
    <section className="relative z-10 min-h-screen px-6 py-36">
      <div className="mx-auto max-w-7xl">
        <motion.div {...reveal} className="mx-auto max-w-3xl text-center">
          <p className="mb-6 text-xs uppercase tracking-[0.45em] text-cyan-100/45">
            Conviction Engine
          </p>

          <h2 className="text-5xl font-semibold leading-[1] tracking-[-0.065em] md:text-7xl">
            Raw data becomes
            <br />
            market <span className={headingGradient}>intelligence.</span>
          </h2>

          <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-white/45">
            NovaOS connects wallet activity, holder behavior, liquidity flows
            and social signals into one AI-powered conviction layer.
          </p>
        </motion.div>

        <div className="mt-24 grid gap-6 md:grid-cols-3">
          {[
            ["Wallet Activity", "Track accumulation, distribution and suspicious linked wallet behavior."],
            ["Holder Behavior", "Understand whether holders are committed, rotating or preparing to exit."],
            ["Smart Money Flow", "Surface high-quality capital movement before it becomes obvious."],
          ].map(([title, text], index) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 30, filter: "blur(12px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true, margin: "-120px" }}
              transition={{ duration: 0.8, delay: index * 0.12 }}
              className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] p-7 backdrop-blur-2xl"
            >
              <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-cyan-900/20 blur-3xl transition group-hover:bg-cyan-700/20" />
              <div className="relative">
                <div className="mb-8 h-10 w-10 rounded-2xl border border-white/10 bg-white/[0.04]" />
                <h3 className="text-2xl font-semibold tracking-[-0.04em]">
                  {title}
                </h3>
                <p className="mt-4 leading-relaxed text-white/42">{text}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          {...reveal}
          className="relative mt-10 overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.032] p-8 backdrop-blur-2xl"
        >
          <div className="absolute inset-0 opacity-60">
            <motion.div
              animate={{ x: ["-20%", "120%"] }}
              transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
              className="absolute top-1/2 h-[1px] w-1/2 bg-gradient-to-r from-transparent via-cyan-200/30 to-transparent"
            />
            <motion.div
              animate={{ x: ["120%", "-20%"] }}
              transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
              className="absolute top-1/3 h-[1px] w-1/3 bg-gradient-to-r from-transparent via-purple-200/20 to-transparent"
            />
          </div>

          <div className="relative grid gap-8 md:grid-cols-4">
            {["Diamond Hands", "Insider Risk", "Smart Money", "Rotation"].map(
              (score, index) => (
                <div
                  key={score}
                  className="rounded-3xl border border-white/10 bg-black/20 p-6"
                >
                  <p className="text-sm text-white/42">{score}</p>
                  <p className="mt-4 text-5xl font-semibold tracking-[-0.06em]">
                    {[91, 32, 88, 74][index]}
                  </p>
                  <p className="mt-3 text-sm text-white/35">
                    {["Very Strong", "Moderate", "Strong", "Rising"][index]}
                  </p>
                </div>
              )
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function SectionBubble() {
  const nodes = [
    ["Insider Cluster", "12", "15%", "32%", "h-36 w-36"],
    ["Exchange Wallets", "5", "10%", "58%", "h-28 w-28"],
    ["Diamond Hands", "91", "31%", "66%", "h-36 w-36"],
    ["Rotation Wallets", "74", "66%", "58%", "h-36 w-36"],
    ["Whale Accumulation", "28.6%", "78%", "30%", "h-34 w-34"],
    ["Retail Cloud", "421", "80%", "70%", "h-32 w-32"],
  ];

  return (
    <section className="relative z-10 min-h-screen px-6 py-36">
      <div className="mx-auto max-w-7xl">
        <motion.div {...reveal} className="mx-auto max-w-3xl text-center">
          <p className="mb-6 text-xs uppercase tracking-[0.45em] text-cyan-100/45">
            Bubble Intelligence
          </p>
          <h2 className="text-5xl font-semibold leading-[1] tracking-[-0.065em] md:text-7xl">
            Visualize hidden
            <br />
            wallet <span className={headingGradient}>relationships.</span>
          </h2>
          <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-white/45">
            NovaOS maps wallet clusters, insider behavior and smart money
            influence into one cinematic intelligence layer.
          </p>
        </motion.div>

        <div className="relative mt-20 min-h-[720px] overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(1,44,59,0.52),transparent_42%),radial-gradient(circle_at_20%_55%,rgba(2,31,41,0.38),transparent_34%),radial-gradient(circle_at_80%_55%,rgba(12,33,41,0.38),transparent_34%)]" />

          {[
            "left-[20%] top-[34%] w-[36%] rotate-[16deg]",
            "left-[32%] top-[56%] w-[30%] -rotate-[22deg]",
            "left-[48%] top-[44%] w-[31%] -rotate-[14deg]",
            "left-[56%] top-[61%] w-[30%] rotate-[18deg]",
            "left-[24%] top-[62%] w-[42%] rotate-[5deg]",
            "left-[61%] top-[36%] w-[20%] rotate-[26deg]",
          ].map((line, index) => (
            <motion.div
              key={line}
              animate={{ opacity: [0.12, 0.38, 0.12] }}
              transition={{
                duration: 4.5 + index * 0.6,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className={`absolute h-[1px] ${line} bg-gradient-to-r from-transparent via-cyan-100/35 to-transparent`}
            />
          ))}

          <BubbleNode
            main
            label="Smart Money"
            value="87%"
            className="absolute left-1/2 top-[30%] -translate-x-1/2"
          />

          {nodes.map(([label, value, x, y, size], index) => (
            <BubbleNode
              key={label}
              label={label}
              value={value}
              size={size}
              index={index}
              style={{ left: x, top: y }}
              className="absolute"
            />
          ))}

          <div className="absolute bottom-2 left-1/2 grid w-full max-w-4xl -translate-x-1/2 grid-cols-3 gap-8 text-center">
            {[
              ["Linked Wallets", "148"],
              ["Suspicious Clusters", "12"],
              ["High Conviction Score", "91/100"],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs uppercase tracking-[0.35em] text-white/35">
                  {label}
                </p>
                <p className="mt-4 text-5xl font-semibold tracking-[-0.06em] text-white/90">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function BubbleNode({
  label,
  value,
  size = "h-52 w-52",
  index = 0,
  main = false,
  className = "",
  style,
}: {
  label: string;
  value: string;
  size?: string;
  index?: number;
  main?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <motion.div
      animate={{ y: [0, index % 2 === 0 ? -9 : 9, 0] }}
      transition={{ duration: main ? 6 : 5.5 + index * 0.35, repeat: Infinity, ease: "easeInOut" }}
      className={className}
      style={style}
    >
      <div
        className={`relative flex ${size} items-center justify-center rounded-full border border-cyan-100/18 bg-[radial-gradient(circle_at_34%_28%,rgba(175,235,255,0.16),rgba(1,44,59,0.58)_40%,rgba(2,4,7,0.95)_76%)] shadow-[0_0_90px_rgba(56,189,248,0.11)]`}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: main ? 46 : 38 + index * 3, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 rounded-full"
        >
          <div className="absolute inset-3 rounded-full border border-cyan-100/12" />
          <div className="absolute left-1/2 top-1/2 h-[1px] w-[135%] -translate-x-1/2 -translate-y-1/2 rotate-12 bg-gradient-to-r from-transparent via-cyan-100/16 to-transparent" />
        </motion.div>

        <div className="relative z-10 px-4 text-center">
          <p className={main ? "text-sm text-white/48" : "text-xs leading-tight text-white/50"}>
            {label}
          </p>
          <p className={main ? "mt-2 text-5xl font-semibold tracking-[-0.06em]" : "mt-1 text-2xl font-semibold tracking-[-0.04em]"}>
            {value}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function SectionSocial() {
  const items = [
    ["@OnchainEdge", "2m", "$NOVA smart money accumulation is accelerating. Top wallets are not selling.", "Conviction Spike"],
    ["@WalletScope", "6m", "Contract mentions rising while holder distribution remains stable.", "Social Momentum"],
    ["@AlphaTrace", "11m", "Early buyer cluster detected. Moderate insider risk but strong retention.", "Risk Signal"],
    ["@NarrativeFlow", "18m", "AI agent tokens gaining attention across smart money feeds.", "Narrative Shift"],
  ];

  return (
    <section className="relative z-10 min-h-screen px-6 py-36">
      <div className="mx-auto grid max-w-7xl items-center gap-20 md:grid-cols-2">
        <motion.div {...reveal}>
          <p className="mb-6 text-xs uppercase tracking-[0.45em] text-cyan-100/45">
            Social Intelligence
          </p>
          <h2 className="text-5xl font-semibold leading-[1] tracking-[-0.065em] md:text-7xl">
            Track hype before
            <br />
            it becomes <span className={headingGradient}>consensus.</span>
          </h2>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-white/45">
            NovaOS connects social mentions, contract discussions and narrative
            acceleration with onchain conviction signals.
          </p>
        </motion.div>

        <motion.div
          {...reveal}
          transition={{ duration: 1, delay: 0.15 }}
          className="relative"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(1,44,59,0.45),transparent_55%)]" />
          <div className="relative flex flex-col gap-6">
            {items.map(([user, time, text, tag], index) => (
              <motion.div
                key={user}
                initial={{ opacity: 0, x: 40, filter: "blur(12px)" }}
                whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                viewport={{ once: true }}
                animate={{ y: [0, index % 2 === 0 ? -4 : 4, 0] }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
              >
                <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 backdrop-blur-2xl">
                  <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-cyan-900/20 blur-3xl" />
                  <div className="relative flex items-start justify-between gap-6">
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full border border-cyan-100/15 bg-[radial-gradient(circle_at_34%_28%,rgba(175,235,255,0.18),rgba(1,44,59,0.62)_42%,rgba(2,4,7,0.95)_76%)]" />
                        <div>
                          <p className="text-sm font-medium text-white/80">
                            {user}
                          </p>
                          <p className="text-xs text-white/32">{time} ago</p>
                        </div>
                      </div>
                      <p className="mt-5 max-w-md leading-relaxed text-white/52">
                        {text}
                      </p>
                    </div>
                    <div className="shrink-0 rounded-full border border-cyan-100/10 bg-cyan-100/[0.035] px-3 py-1 text-xs text-cyan-100/60">
                      {tag}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function SectionTerminal() {
  return (
    <section className="relative z-10 min-h-screen px-6 py-36">
      <div className="mx-auto grid max-w-7xl items-center gap-20 md:grid-cols-2">
        <motion.div {...reveal}>
          <p className="mb-6 text-xs uppercase tracking-[0.45em] text-cyan-100/45">
            AI Terminal
          </p>
          <h2 className="text-5xl font-semibold leading-[1] tracking-[-0.065em] md:text-7xl">
            Turn signals into
            <br />
            an explainable <span className={headingGradient}>thesis.</span>
          </h2>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-white/45">
            NovaOS converts wallet activity, social momentum and market
            structure into a clear AI-generated conviction thesis.
          </p>
        </motion.div>

        <motion.div
          {...reveal}
          transition={{ duration: 1, delay: 0.15 }}
          className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-2xl"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(1,44,59,0.45),transparent_55%)]" />
          <div className="relative rounded-[2rem] border border-white/10 bg-black/30 p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/80">
                  NovaOS Terminal
                </p>
                <p className="text-xs text-white/32">
                  Conviction Engine active
                </p>
              </div>
              <div className="rounded-full border border-cyan-100/10 bg-cyan-100/[0.035] px-3 py-1 text-xs text-cyan-100/60">
                Live Analysis
              </div>
            </div>

            <div className="space-y-4 font-mono text-sm">
              {[
                "Analyzing token: $NOVA",
                "Tracking smart money inflows...",
                "Holder stability improving",
                "Early buyer cluster detected",
                "Social momentum rising",
                "Generating AI conviction thesis...",
              ].map((line, index) => (
                <motion.div
                  key={line}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: index * 0.16 }}
                  className="flex items-center gap-3 text-white/48"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-100/60" />
                  <span>{line}</span>
                </motion.div>
              ))}
            </div>

            <div className="mt-8 rounded-3xl border border-cyan-100/10 bg-cyan-100/[0.025] p-5">
              <p className="mb-3 text-xs uppercase tracking-[0.3em] text-cyan-100/45">
                AI Thesis
              </p>
              <p className="leading-relaxed text-white/60">
                Smart money accumulation remains strong while long-term holders
                continue to hold. Insider risk is moderate due to clustered
                early wallets, but overall conviction remains favorable.
              </p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {[
                ["Conviction Score", "91/100"],
                ["Smart Money", "Strong"],
                ["Insider Risk", "Moderate"],
                ["Narrative Momentum", "Rising"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"
                >
                  <p className="text-xs text-white/35">{label}</p>
                  <p className="mt-2 text-xl font-semibold tracking-[-0.04em]">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function SectionMultichain() {
  const chains = [
    ["Ethereum", "Ξ", "Deep liquidity, institutional flows and mature wallet behavior."],
    ["Base", "●", "Fast-growing onchain activity and active smart money rotation."],
    ["Mantle", "✺", "Native ecosystem support for the Turing Test Hackathon submission."],
    ["Solana", "≋", "High-speed degen flow, meme markets and real-time social momentum."],
  ];

  return (
    <section className="relative z-10 min-h-screen px-6 py-36">
      <div className="mx-auto max-w-7xl">
        <motion.div {...reveal} className="mx-auto max-w-3xl text-center">
          <p className="mb-6 text-xs uppercase tracking-[0.45em] text-cyan-100/45">
            Multi-chain Intelligence
          </p>
          <h2 className="text-5xl font-semibold leading-[1] tracking-[-0.065em] md:text-7xl">
            One system.
            <br />
            Multiple <span className={headingGradient}>markets.</span>
          </h2>
          <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-white/45">
            NovaOS unifies onchain data across major ecosystems, turning
            fragmented liquidity into one conviction layer.
          </p>
        </motion.div>

        <div className="relative mt-24 grid gap-6 md:grid-cols-4">
          {chains.map(([name, logo, text], index) => (
            <motion.div
              key={name}
              initial={{ opacity: 0, y: 35, filter: "blur(12px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true, margin: "-120px" }}
              transition={{ duration: 0.8, delay: index * 0.12 }}
              className="group relative overflow-hidden rounded-[2rem] border border-cyan-100/12 bg-white/[0.025] p-8 text-center backdrop-blur-2xl"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(1,44,59,0.42),transparent_58%)] opacity-70" />
              <div className="relative">
                <div className="mx-auto mb-10 flex h-24 w-24 items-center justify-center rounded-full border border-cyan-100/20 bg-[radial-gradient(circle_at_34%_28%,rgba(175,235,255,0.18),rgba(1,44,59,0.62)_42%,rgba(2,4,7,0.95)_76%)] shadow-[0_0_70px_rgba(56,189,248,0.1)]">
                  <span className="relative z-10 text-4xl font-semibold tracking-[-0.06em] text-white/90">
                    {logo}
                  </span>
                </div>
                <h3 className="text-3xl font-semibold tracking-[-0.05em]">
                  {name}
                </h3>
                <div className="mx-auto my-5 h-[1px] w-24 bg-gradient-to-r from-transparent via-cyan-100/45 to-transparent" />
                <p className="mx-auto max-w-[15rem] leading-relaxed text-white/42">
                  {text}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SectionFinal() {
  return (
    <section className="relative z-10 px-6 py-40">
      <div className="mx-auto max-w-6xl text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, filter: "blur(18px)" }}
          whileInView={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-160px" }}
          transition={{ duration: 1.1 }}
          className="relative overflow-hidden rounded-[3rem] border border-white/10 bg-white/[0.025] px-8 py-28 backdrop-blur-2xl"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(1,44,59,0.58),transparent_48%),radial-gradient(circle_at_30%_80%,rgba(25,9,38,0.28),transparent_40%)]" />

          <div className="relative">
            <p className="mb-6 text-xs uppercase tracking-[0.45em] text-cyan-100/45">
              Start Analyzing
            </p>
            <h2 className="text-5xl font-semibold leading-[1] tracking-[-0.065em] md:text-7xl">
              See what smart
              <br />
              capital sees.
            </h2>
            <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-white/45">
              Launch NovaOS and turn fragmented blockchain data into a clear,
              explainable conviction thesis.
            </p>

            <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
              <button className="rounded-full bg-cyan-100 px-8 py-4 text-sm font-semibold text-black shadow-[0_0_70px_rgba(125,211,252,0.16)] transition duration-300 hover:scale-[1.025] hover:bg-white">
                Launch NovaOS
              </button>
              <button className="rounded-full border border-white/10 bg-white/[0.03] px-8 py-4 text-sm font-semibold text-white/70 backdrop-blur-xl transition duration-300 hover:border-cyan-100/20 hover:bg-white/[0.06] hover:text-white">
                View Roadmap
              </button>
            </div>
          </div>
        </motion.div>

        <footer className="mt-10 flex flex-col items-center justify-between gap-4 text-xs text-white/30 md:flex-row">
          <p>© 2026 NovaOS. Built for onchain intelligence.</p>
          <div className="flex gap-6">
            <a href="#" className="transition hover:text-white/60">Docs</a>
            <a href="#" className="transition hover:text-white/60">Terminal</a>
            <a href="#" className="transition hover:text-white/60">Roadmap</a>
          </div>
        </footer>
      </div>
    </section>
  );
}