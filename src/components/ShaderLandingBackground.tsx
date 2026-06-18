"use client";

import { ShaderGradient, ShaderGradientCanvas } from "shadergradient";
import type { ComponentType } from "react";

const UntypedShaderGradient = ShaderGradient as unknown as ComponentType<Record<string, unknown>>;

export default function ShaderLandingBackground() {
  return (
    <div
      className="shader-landing-background fixed inset-0 z-0 pointer-events-none overflow-hidden bg-black"
      style={{
        filter: "contrast(1.18) saturate(0.82) brightness(0.92)",
      }}
    >
      <ShaderGradientCanvas
        fov={45}
        pixelDensity={1}
        style={{
          height: "100%",
          width: "100%",
        }}
      >
        <UntypedShaderGradient
          animate="on"
          axesHelper="off"
          bgColor1="#000000"
          bgColor2="#000000"
          brightness={1.2}
          cAzimuthAngle={172}
          cDistance={2.86}
          cPolarAngle={74}
          cameraZoom={1}
          color1="#0F171C"
          color2="#0F171C"
          color3="#CAC4B0"
          destination="onCanvas"
          embedMode="off"
          envPreset="city"
          format="gif"
          fov={45}
          frameRate={10}
          gizmoHelper="hide"
          grain="off"
          lightType="3d"
          pixelDensity={1}
          positionX={0}
          positionY={0.5}
          positionZ={0}
          range="disabled"
          rangeEnd={40}
          rangeStart={0}
          reflection={0.1}
          rotationX={0}
          rotationY={0}
          rotationZ={-90}
          shader="defaults"
          type="waterPlane"
          uAmplitude={0}
          uDensity={1}
          uFrequency={5.5}
          uSpeed={0.02}
          uStrength={3}
          uTime={0.2}
          wireframe={false}
        />
      </ShaderGradientCanvas>
      <div
        className="fixed inset-0 z-[2] pointer-events-none opacity-[0.34] mix-blend-multiply"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(0,0,0,0.82) 1.05px, transparent 1.25px)",
          backgroundSize: "4.2px 4.2px",
        }}
      />
      <div
        className="fixed inset-0 z-[3] pointer-events-none opacity-[0.18] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.05' numOctaves='5' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E\")",
          backgroundSize: "140px 140px",
        }}
      />
      <div
        className="fixed inset-0 z-[4] pointer-events-none opacity-[0.04] mix-blend-soft-light"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, rgba(255,255,255,0.14) 1px, transparent 1px)",
          backgroundSize: "100% 5px",
        }}
      />
      <div className="fixed inset-0 z-[5] pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.16)_42%,rgba(0,0,0,0.76)_100%)]" />
    </div>
  );
}
