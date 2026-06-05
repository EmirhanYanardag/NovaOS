"use client";

import { useMemo, useState } from "react";

export type HolderBubbleMapNode = {
  address: string;
  shortAddress: string;
  activityScore?: number;
  category?: string;
  clusterColor?: string;
  clusterLabels: string[];
  concentrationScore?: number;
  influence: number;
  ownership: number;
  ownershipText: string;
  rank: number;
  relationshipGroupIds: string[];
  riskContribution: number;
  size?: number;
};

type HolderBubbleMapCluster = {
  colorKey?: string;
  id: string;
  label: string;
  nodeAddresses: string[];
  riskLevel?: string;
};

type HolderBubbleMapProps = {
  clusters: HolderBubbleMapCluster[];
  nodes: HolderBubbleMapNode[];
  onSelectWallet: (node: HolderBubbleMapNode) => void;
  selectedWallet: HolderBubbleMapNode | null;
  showLabels: boolean;
  showLines: boolean;
  tokenLogoUrl?: string;
  tokenSymbol: string;
};

type BubbleColor = {
  dot: string;
  fill: string;
  glow: string;
  key: string;
  line: string;
  stroke: string;
};

type PositionedBubble = HolderBubbleMapNode & {
  anchor?: { x: number; y: number };
  color: BubbleColor;
  diameter: number;
  groupId?: string;
  radius: number;
  x: number;
  y: number;
};

const WIDTH = 1000;
const HEIGHT = 680;
const CENTER = { x: 500, y: 340 };
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const MIN_X = 45;
const MAX_X = 955;
const MIN_Y = 45;
const MAX_Y = 635;

const GROUP_COLORS: BubbleColor[] = [
  color("cyan", "34,211,238"),
  color("amber", "249,115,22"),
  color("violet", "168,85,247"),
  color("blue", "96,165,250"),
  color("rose", "251,113,133"),
  color("emerald", "52,211,153"),
];

const COLOR_ALIASES: Record<string, string> = {
  blue: "blue",
  cyan: "cyan",
  gray: "isolated",
  green: "emerald",
  purple: "violet",
  red: "rose",
};

const ISOLATED_COLOR: BubbleColor = {
  dot: "rgba(148,163,184,0.58)",
  fill: "rgba(148,163,184,0.055)",
  glow: "drop-shadow(0 0 6px rgba(148,163,184,0.08))",
  key: "isolated",
  line: "rgba(148,163,184,0.12)",
  stroke: "rgba(203,213,225,0.26)",
};

export default function HolderBubbleMap({
  clusters,
  nodes,
  onSelectWallet,
  selectedWallet,
  showLabels,
  showLines,
  tokenLogoUrl,
  tokenSymbol,
}: HolderBubbleMapProps) {
  const [hoveredAddress, setHoveredAddress] = useState<string | null>(null);
  const { bubbles, links } = useMemo(
    () => buildHolderBubbleDistribution(nodes, clusters),
    [nodes, clusters]
  );
  const hoveredNode = hoveredAddress
    ? bubbles.find((bubble) => bubble.address === hoveredAddress)
    : undefined;
  const activeGroupIds =
    hoveredNode?.relationshipGroupIds.length
      ? hoveredNode.relationshipGroupIds
      : selectedWallet?.relationshipGroupIds || [];

  if (nodes.length === 0) {
    return (
      <div className="relative flex h-[680px] w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#05070b] px-8 text-center">
        <div>
          <p className="text-lg font-medium tracking-[-0.04em] text-white/72">
            Holder Bubble Map requires analyzed holder data.
          </p>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-white/38">
            NovaOS will render the holder map after real holder rows are available.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[680px] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#05070b] shadow-[0_28px_110px_rgba(0,0,0,0.34)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(34,211,238,0.065),transparent_32%),radial-gradient(circle_at_78%_62%,rgba(249,115,22,0.055),transparent_30%),radial-gradient(circle_at_48%_86%,rgba(148,163,184,0.035),transparent_34%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.007)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.007)_1px,transparent_1px)] bg-[size:84px_84px]" />

      <svg
        aria-label={`${tokenSymbol} holder bubble map`}
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      >
        {showLines &&
          links.map((link) => {
            const active = activeGroupIds.includes(link.groupId);
            return (
              <line
                key={link.id}
                opacity={active ? 0.28 : 0.12}
                stroke={link.color.line}
                strokeLinecap="round"
                strokeWidth="1.1"
                x1={link.from.x}
                x2={link.to.x}
                y1={link.from.y}
                y2={link.to.y}
              />
            );
          })}

        {bubbles.map((bubble) => {
          const selected = selectedWallet?.address === bubble.address;
          const hovered = hoveredAddress === bubble.address;
          const related =
            activeGroupIds.length > 0 &&
            bubble.relationshipGroupIds.some((id) => activeGroupIds.includes(id));
          const dimmedByFocus = activeGroupIds.length > 0 && !selected && !hovered && !related;
          const opacity = dimmedByFocus ? 0.32 : 1;
          const scale = hovered ? 1.08 : selected ? 1.04 : 1;
          const showWalletLabel =
            selected || hovered || (showLabels && bubble.rank <= 3);

          return (
            <g key={bubble.address}>
              {bubble.groupId === undefined && bubble.riskContribution >= 70 && (
                <circle
                  cx={bubble.x}
                  cy={bubble.y}
                  fill="none"
                  opacity={opacity * 0.62}
                  r={(bubble.diameter / 2) * scale + 4}
                  stroke="rgba(248,113,113,0.34)"
                  strokeWidth="1"
                />
              )}
              <g
                aria-label={`Inspect ${bubble.shortAddress}`}
                className="cursor-pointer outline-none"
                onClick={() => onSelectWallet(bubble)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectWallet(bubble);
                  }
                }}
                onMouseEnter={() => setHoveredAddress(bubble.address)}
                onMouseLeave={() => setHoveredAddress(null)}
                role="button"
                tabIndex={0}
              >
                <title>
                  {`#${bubble.rank} ${bubble.shortAddress} - ${
                    bubble.ownershipText || "ownership unavailable"
                  }`}
                </title>
                <circle
                  cx={bubble.x}
                  cy={bubble.y}
                  fill={bubble.color.fill}
                  opacity={opacity}
                  r={(bubble.diameter / 2) * scale}
                  stroke={
                    selected
                      ? "rgba(240,253,255,0.95)"
                      : hovered || related
                        ? bubble.color.stroke.replace("0.62", "0.82")
                        : bubble.color.stroke
                  }
                  strokeWidth={selected ? 2.6 : hovered ? 2.1 : bubble.groupId ? 1.55 : 1.15}
                  style={{
                    filter: selected || hovered || related ? bubble.color.glow : "none",
                    transition: "opacity 160ms ease, r 160ms ease, stroke 160ms ease",
                  }}
                />
                <circle
                  cx={bubble.x + bubble.diameter * 0.18}
                  cy={bubble.y + bubble.diameter * 0.18}
                  fill={behaviorDotColor(bubble)}
                  opacity={opacity * 0.72}
                  pointerEvents="none"
                  r={Math.max(2.2, bubble.diameter * 0.055)}
                />
              </g>
              {showWalletLabel && (
                <text
                  fill="rgba(235,250,255,0.62)"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  fontSize="11"
                  pointerEvents="none"
                  textAnchor="middle"
                  x={bubble.x}
                  y={bubble.y + bubble.diameter / 2 + 15}
                >
                  {bubble.shortAddress}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="pointer-events-none absolute left-5 top-5 z-20 flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-2 backdrop-blur-xl">
        {tokenLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={tokenSymbol} className="h-7 w-7 rounded-full object-cover" src={tokenLogoUrl} />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-cyan-100/14 bg-cyan-100/[0.04] text-xs font-semibold text-cyan-100/72">
            {tokenSymbol.replace("$", "").slice(0, 2)}
          </span>
        )}
        <span className="text-xs font-medium text-white/46">{tokenSymbol}</span>
      </div>
    </div>
  );
}

function buildHolderBubbleDistribution(
  nodes: HolderBubbleMapNode[],
  clusters: HolderBubbleMapCluster[]
) {
  const sorted = [...nodes].sort((a, b) => a.rank - b.rank || b.influence - a.influence);
  const nodeByAddress = new Map(sorted.map((node) => [node.address, node]));
  const groups = clusters
    .filter((cluster) => cluster.id !== "isolated-holders")
    .map((cluster) => ({
      ...cluster,
      nodeAddresses: cluster.nodeAddresses.filter((address) => nodeByAddress.has(address)),
    }))
    .filter((cluster) => cluster.nodeAddresses.length > 1);
  const groupColor = new Map(groups.map((group, index) => [group.id, colorForGroup(group, index)]));
  const primaryGroup = choosePrimaryGroups(sorted, groups);
  const majorNodes = sorted.filter(isMajorHolder);
  const majorIndex = new Map(majorNodes.map((node, index) => [node.address, index]));
  const isolatedNodes = sorted.filter((node) => !primaryGroup.has(node.address) && !isMajorHolder(node));
  const isolatedIndex = new Map(isolatedNodes.map((node, index) => [node.address, index]));
  const anchors = buildGroupAnchors(groups, sorted, primaryGroup);

  const positioned = sorted.map((node) => {
    const groupId = primaryGroup.get(node.address);
    const anchor = groupId ? anchors.get(groupId) : undefined;
    const diameter = bubbleDiameter(node, sorted.length);
    const position = groupId
      ? connectedPosition(node, groupId, groups, anchor || CENTER)
      : isMajorHolder(node)
        ? majorPosition(node, majorIndex.get(node.address) || 0, majorNodes.length)
        : isolatedPosition(node, isolatedIndex.get(node.address) || 0, isolatedNodes.length);

    return {
      ...node,
      anchor,
      color: groupId ? groupColor.get(groupId) || GROUP_COLORS[0] : ISOLATED_COLOR,
      diameter,
      groupId,
      radius: diameter / 2,
      x: position.x,
      y: position.y,
    };
  });

  const bubbles = resolveCollisions(positioned);
  const bubbleByAddress = new Map(bubbles.map((bubble) => [bubble.address, bubble]));
  const links = groups.flatMap((group) => {
    const members = group.nodeAddresses
      .map((address) => bubbleByAddress.get(address))
      .filter((bubble): bubble is PositionedBubble => Boolean(bubble));
    if (members.length < 2) return [];
    const hub = [...members].sort((a, b) => b.influence - a.influence || a.rank - b.rank)[0];
    const color = groupColor.get(group.id) || GROUP_COLORS[0];
    return members
      .filter((member) => member.address !== hub.address)
      .map((member) => ({
        color,
        from: hub,
        groupId: group.id,
        id: `${group.id}-${hub.address}-${member.address}`,
        to: member,
      }));
  });

  return { bubbles, links };
}

function buildGroupAnchors(
  groups: HolderBubbleMapCluster[],
  nodes: HolderBubbleMapNode[],
  primaryGroup: Map<string, string>
) {
  const rankedGroups = groups
    .map((group) => {
      const members = nodes.filter((node) => primaryGroup.get(node.address) === group.id);
      const bestRank = Math.min(...members.map((member) => member.rank));
      return { bestRank, group, members };
    })
    .filter((item) => item.members.length > 1)
    .sort((a, b) => a.bestRank - b.bestRank || b.members.length - a.members.length);

  return new Map(
    rankedGroups.map(({ bestRank, group, members }, index) => {
      const hash = hashToNumber(group.id);
      const anchorZones = [
        { x: 520, y: 184 },
        { x: 735, y: 392 },
        { x: 306, y: 508 },
        { x: 235, y: 226 },
        { x: 842, y: 164 },
        { x: 592, y: 548 },
      ];
      const zone = anchorZones[index % anchorZones.length];
      const rankPull = bestRank <= 5 ? -20 : 0;
      return [
        group.id,
        {
          x: clamp(zone.x + signedJitter(hash, 7) * 74, 105, 895),
          y: clamp(
            zone.y + signedJitter(hash, 13) * 58 + rankPull + Math.min(24, members.length * 2),
            88,
            592
          ),
        },
      ] as const;
    })
  );
}

function connectedPosition(
  node: HolderBubbleMapNode,
  groupId: string,
  groups: HolderBubbleMapCluster[],
  anchor: { x: number; y: number }
) {
  const members = groups.find((group) => group.id === groupId)?.nodeAddresses || [];
  const index = Math.max(0, members.indexOf(node.address));
  const hash = hashToNumber(node.address);
  const angle = index * GOLDEN_ANGLE + signedJitter(hash, 12) * 0.9;
  const cloud = clamp(30 + Math.sqrt(index + 1) * 18 + unsignedJitter(hash, 28), 28, 112);
  const x = anchor.x + Math.cos(angle) * cloud;
  const y = anchor.y + Math.sin(angle) * cloud * 0.8;

  return {
    x,
    y,
  };
}

function majorPosition(node: HolderBubbleMapNode, index: number, total: number) {
  const hash = hashToNumber(node.address);
  const anchorZones = [
    { x: 420, y: 292 },
    { x: 612, y: 270 },
    { x: 370, y: 410 },
    { x: 646, y: 430 },
    { x: 500, y: 206 },
    { x: 498, y: 514 },
  ];
  const zone = anchorZones[index % anchorZones.length];
  const totalShift = total <= 2 ? 42 : 0;

  return {
    x: zone.x + signedJitter(hash, 9) * (58 + totalShift),
    y: zone.y + signedJitter(hash, 15) * 46,
  };
}

function isolatedPosition(node: HolderBubbleMapNode, index: number, total: number) {
  const hash = hashToNumber(node.address);
  const columnCount = total <= 12 ? 4 : 6;
  const row = Math.floor(index / columnCount);
  const column = index % columnCount;
  const xStep = WIDTH / (columnCount + 1);
  const baseX = xStep * (column + 1);
  const baseY = 88 + ((row * (total <= 12 ? 112 : 92) + unsignedJitter(hash, 74)) % 540);

  return {
    x: baseX + signedJitter(hash, 5) * 78,
    y: baseY + signedJitter(hash, 11) * 44,
  };
}

function resolveCollisions(nodes: PositionedBubble[]) {
  const resolved = nodes.map((node) => ({ ...node }));

  for (let pass = 0; pass < 110; pass += 1) {
    for (let index = 0; index < resolved.length; index += 1) {
      const node = resolved[index];

      for (let nextIndex = index + 1; nextIndex < resolved.length; nextIndex += 1) {
        const other = resolved[nextIndex];
        const dx = other.x - node.x;
        const dy = other.y - node.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 0.1;
        const minDistance = node.radius + other.radius + 8;
        if (distance >= minDistance) continue;

        const push = (minDistance - distance) * 0.52;
        const nx = dx / distance;
        const ny = dy / distance;
        node.x -= nx * push;
        node.y -= ny * push;
        other.x += nx * push;
        other.y += ny * push;
      }

      if (node.anchor) {
        node.x += (node.anchor.x - node.x) * 0.008;
        node.y += (node.anchor.y - node.y) * 0.008;
      }

      node.x = clamp(node.x, MIN_X + node.radius, MAX_X - node.radius);
      node.y = clamp(node.y, MIN_Y + node.radius, MAX_Y - node.radius);
    }
  }

  return resolved;
}

function choosePrimaryGroups(
  nodes: HolderBubbleMapNode[],
  groups: HolderBubbleMapCluster[]
) {
  const groupSize = new Map(groups.map((group) => [group.id, group.nodeAddresses.length]));
  const groupOrder = new Map(groups.map((group, index) => [group.id, index]));
  const result = new Map<string, string>();

  nodes.forEach((node) => {
    const groupId = node.relationshipGroupIds
      .filter((id) => groupSize.has(id))
      .sort((a, b) => {
        const sizeDelta = (groupSize.get(b) || 0) - (groupSize.get(a) || 0);
        if (sizeDelta !== 0) return sizeDelta;
        return (groupOrder.get(a) || 0) - (groupOrder.get(b) || 0);
      })[0];
    if (groupId) result.set(node.address, groupId);
  });

  return result;
}

function bubbleDiameter(node: HolderBubbleMapNode, holderCount: number) {
  const radius =
    node.ownership > 0
      ? clamp(8 + Math.sqrt(node.ownership) * 12, 8, 56)
      : rankFallbackRadius(node.rank, holderCount);

  return radius * 2;
}

function isMajorHolder(node: HolderBubbleMapNode) {
  return node.rank <= 5 || node.ownership >= 1;
}

function behaviorDotColor(node: PositionedBubble) {
  if ((node.activityScore || 0) >= 70) return "rgba(125,211,252,0.72)";
  if ((node.concentrationScore || 0) >= 70 || node.riskContribution >= 70) {
    return "rgba(248,113,113,0.68)";
  }
  if (node.category === "fresh") return "rgba(147,197,253,0.64)";
  return node.color.dot;
}

function rankFallbackRadius(rank: number, holderCount: number) {
  const sparseBoost = holderCount <= 15 ? 2 : 0;
  if (rank <= 1) return 36 + sparseBoost;
  if (rank <= 3) return 30 + sparseBoost;
  if (rank <= 10) return 23 + sparseBoost;
  if (rank <= 25) return 17 + sparseBoost;
  return 10 + sparseBoost;
}

function colorForGroup(cluster: HolderBubbleMapCluster, index: number) {
  const key = cluster.colorKey ? COLOR_ALIASES[cluster.colorKey] || cluster.colorKey : "";
  return GROUP_COLORS.find((item) => item.key === key) || GROUP_COLORS[index % GROUP_COLORS.length];
}

function color(key: string, rgb: string): BubbleColor {
  return {
    dot: `rgba(${rgb},0.72)`,
    fill: `rgba(${rgb},0.12)`,
    glow: `drop-shadow(0 0 13px rgba(${rgb},0.2))`,
    key,
    line: `rgba(${rgb},0.34)`,
    stroke: `rgba(${rgb},0.62)`,
  };
}

function hashToNumber(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function unsignedJitter(hash: number, range: number) {
  return range <= 0 ? 0 : hash % range;
}

function signedJitter(hash: number, shift: number) {
  return (((hash >>> shift) % 200) - 100) / 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
