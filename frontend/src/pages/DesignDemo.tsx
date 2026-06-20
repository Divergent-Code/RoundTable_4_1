import { useState } from "react";

type Mode = "manuscript" | "iron";

export default function DesignDemo() {
  const [mode, setMode] = useState<Mode>("manuscript");

  return (
    <div
      data-mode={mode}
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--rt-bg)",
        color: "var(--rt-ink-on-dark)",
        fontFamily: "var(--rt-font-body)",
        transition: "background-color var(--rt-ease-mode), color var(--rt-ease-mode)",
      }}
    >
      {/* ── Header ── */}
      <header
        style={{
          borderBottom: "1px solid var(--rt-border)",
          padding: "var(--rt-space-6) var(--rt-space-8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "var(--rt-surface)",
          transition: "background-color var(--rt-ease-mode), border-color var(--rt-ease-mode)",
        }}
      >
        <div>
          <h1
            className="rt-display"
            style={{
              fontFamily: "var(--rt-font-display)",
              fontSize: "var(--rt-text-2xl)",
              fontStyle: "italic",
              color: "var(--rt-gold)",
              margin: 0,
              lineHeight: 1,
              transition: "color var(--rt-ease-mode)",
            }}
          >
            Living Record
          </h1>
          <p className="rt-label" style={{ marginTop: 4 }}>
            Design System — Phase 1 Review
          </p>
        </div>

        {/* Mode toggle */}
        <div style={{ display: "flex", gap: "var(--rt-space-2)", alignItems: "center" }}>
          <span className="rt-label" style={{ marginRight: 8 }}>Mode:</span>
          <button
            className="rt-btn rt-btn-ghost"
            onClick={() => setMode("manuscript")}
            style={{
              borderColor: mode === "manuscript" ? "var(--rt-gold)" : undefined,
              color: mode === "manuscript" ? "var(--rt-gold)" : undefined,
            }}
          >
            Manuscript
          </button>
          <button
            className="rt-btn rt-btn-ghost"
            onClick={() => setMode("iron")}
            style={{
              borderColor: mode === "iron" ? "var(--rt-gold)" : undefined,
              color: mode === "iron" ? "var(--rt-gold)" : undefined,
            }}
          >
            Iron &amp; Rivets
          </button>
        </div>
      </header>

      <main style={{ padding: "var(--rt-space-8)", maxWidth: 960, margin: "0 auto" }}>

        {/* ── Mode indicator ── */}
        <div style={{ marginBottom: "var(--rt-space-8)" }}>
          <div className="rt-card rt-grain rt-animate-unfurl">
            <p className="rt-label" style={{ marginBottom: 4 }}>Active Mode</p>
            <p style={{
              fontFamily: "var(--rt-font-display)",
              fontSize: "var(--rt-text-xl)",
              fontStyle: "italic",
              color: "var(--rt-gold)",
              margin: 0,
            }}>
              {mode === "manuscript" ? "Manuscript — Exploration" : "Iron & Rivets — Combat"}
            </p>
            <p style={{
              fontFamily: "var(--rt-font-body)",
              fontSize: "var(--rt-text-sm)",
              color: "var(--rt-ink-on-dark-muted)",
              marginTop: "var(--rt-space-2)",
            }}>
              {mode === "manuscript"
                ? "Warm parchment surfaces, serif prose type, aged ink accents. Used during world exploration, NPC dialogue, and campaign narrative."
                : "Cold steel surfaces, monospace tactical type, forge-fire accents. Used during combat initiative, dice resolution, and HP tracking."}
            </p>
          </div>
        </div>

        <div className="rt-rule-ornate" />

        {/* ── Typography ── */}
        <Section title="Typography">
          <div style={{ display: "grid", gap: "var(--rt-space-6)" }}>
            <TypeSpec
              label="Display — IM Fell English"
              sample="The Dragon Awakens at Dawn"
              style={{
                fontFamily: "var(--rt-font-display)",
                fontSize: "var(--rt-text-3xl)",
                fontStyle: "italic",
                color: "var(--rt-ink-on-dark)",
                lineHeight: 1.15,
              }}
            />
            <TypeSpec
              label="Body — Crimson Pro"
              sample="You descend the moss-slicked stairs into the chamber below. The torchlight catches the glint of something golden half-buried in the silt."
              style={{
                fontFamily: "var(--rt-font-body)",
                fontSize: "var(--rt-text-lg)",
                color: "var(--rt-ink-on-dark)",
                lineHeight: 1.7,
              }}
            />
            <TypeSpec
              label="Mono — JetBrains Mono"
              sample="INIT_ROUND=1 | HP 42/58 | AC 16 | TURN: Elara Nightwhisper"
              style={{
                fontFamily: "var(--rt-font-mono)",
                fontSize: "var(--rt-text-sm)",
                color: "var(--rt-teal)",
                letterSpacing: "0.04em",
              }}
            />
            <TypeSpec
              label="Label / Tag"
              style={{ fontFamily: "var(--rt-font-mono)" }}
            >
              <span className="rt-label">Chapter III — The Whispering Keep</span>
            </TypeSpec>
          </div>
        </Section>

        <div className="rt-rule" />

        {/* ── Color palette ── */}
        <Section title="Color Palette">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "var(--rt-space-4)" }}>
            <Swatch label="Background"   cssVar="--rt-bg" />
            <Swatch label="Surface"      cssVar="--rt-surface" />
            <Swatch label="Surface +"    cssVar="--rt-surface-raised" />
            <Swatch label="Paper"        cssVar="--rt-paper" textVar="--rt-ink" />
            <Swatch label="Parchment"    cssVar="--rt-parchment" textVar="--rt-ink" />
            <Swatch label="Gold"         cssVar="--rt-gold" textVar="--rt-ink" />
            <Swatch label="Gold Dim"     cssVar="--rt-gold-dim" />
            <Swatch label="Crimson"      cssVar="--rt-crimson" />
            <Swatch label="Teal"         cssVar="--rt-teal" textVar="--rt-ink" />
            <Swatch label="Teal Dim"     cssVar="--rt-teal-dim" />
            <Swatch label="Border"       cssVar="--rt-border" />
            <Swatch label="Border Light" cssVar="--rt-border-light" />
          </div>
        </Section>

        <div className="rt-rule" />

        {/* ── Buttons ── */}
        <Section title="Buttons">
          <div style={{ display: "flex", gap: "var(--rt-space-4)", flexWrap: "wrap", alignItems: "center" }}>
            <button className="rt-btn rt-btn-primary">Primary Action</button>
            <button className="rt-btn rt-btn-ghost">Secondary</button>
            <button className="rt-btn rt-btn-danger">Danger</button>
          </div>
          <p style={{
            fontFamily: "var(--rt-font-mono)",
            fontSize: "var(--rt-text-xs)",
            color: "var(--rt-ink-faint)",
            marginTop: "var(--rt-space-4)",
          }}>
            Classes: <code>rt-btn rt-btn-primary</code> | <code>rt-btn rt-btn-ghost</code> | <code>rt-btn rt-btn-danger</code>
          </p>
        </Section>

        <div className="rt-rule" />

        {/* ── Cards ── */}
        <Section title="Cards & Surfaces">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--rt-space-4)" }}>
            <div className="rt-card">
              <p className="rt-label" style={{ marginBottom: "var(--rt-space-2)" }}>Entity Card</p>
              <p style={{ fontFamily: "var(--rt-font-display)", fontSize: "var(--rt-text-lg)", fontStyle: "italic", margin: 0 }}>
                Elara Nightwhisper
              </p>
              <p style={{ fontFamily: "var(--rt-font-mono)", fontSize: "var(--rt-text-xs)", color: "var(--rt-ink-muted)", marginTop: 4 }}>
                HIGH ELF WIZARD · LVL 5
              </p>
              <hr className="rt-rule" style={{ margin: "var(--rt-space-4) 0" }} />
              <p style={{ fontFamily: "var(--rt-font-mono)", fontSize: "var(--rt-text-sm)", color: "var(--rt-teal)" }}>
                HP 32/32 &nbsp;·&nbsp; AC 13 &nbsp;·&nbsp; SPD 30ft
              </p>
            </div>
            <div className="rt-card rt-grain">
              <p className="rt-label" style={{ marginBottom: "var(--rt-space-2)" }}>Grain Overlay</p>
              <p style={{ fontFamily: "var(--rt-font-body)", fontSize: "var(--rt-text-base)", color: "var(--rt-ink-on-dark-muted)", margin: 0 }}>
                This card has <code className="rt-mono">.rt-grain</code> applied — subtle noise texture via CSS SVG filter. Visible at low opacity on both modes.
              </p>
            </div>
          </div>
        </Section>

        <div className="rt-rule" />

        {/* ── Dividers ── */}
        <Section title="Dividers">
          <p className="rt-label" style={{ marginBottom: "var(--rt-space-3)" }}>Standard rule (.rt-rule)</p>
          <hr className="rt-rule" style={{ margin: "0 0 var(--rt-space-6)" }} />
          <p className="rt-label" style={{ marginBottom: "var(--rt-space-3)" }}>Ornate rule (.rt-rule-ornate)</p>
          <hr className="rt-rule-ornate" style={{ margin: 0 }} />
        </Section>

        <div className="rt-rule" />

        {/* ── Animations ── */}
        <Section title="Animations">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--rt-space-4)" }}>
            <AnimDemo label="rt-animate-unfurl" className="rt-animate-unfurl rt-card">
              Panel unfurl — content entering the viewport
            </AnimDemo>
            <AnimDemo label="rt-animate-flicker" className="rt-animate-flicker rt-card">
              Flicker-in — mode switch, lantern effect
            </AnimDemo>
          </div>
        </Section>

        <div className="rt-rule" />

        {/* ── Token reference ── */}
        <Section title="Token Reference">
          <div style={{ overflowX: "auto" }}>
            <table style={{
              width: "100%",
              borderCollapse: "collapse",
              fontFamily: "var(--rt-font-mono)",
              fontSize: "var(--rt-text-xs)",
            }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--rt-border-light)" }}>
                  {["Token", "Manuscript", "Iron & Rivets"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "var(--rt-space-2) var(--rt-space-3)", color: "var(--rt-ink-faint)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["--rt-bg",             "#13100c", "#0a0c0e"],
                  ["--rt-paper",          "#f0e6cf", "#1c2430"],
                  ["--rt-gold",           "#c9a84c", "#e8920a"],
                  ["--rt-crimson",        "#8b1f1f", "#c0392b"],
                  ["--rt-teal",           "#2e7d6a", "#1abc9c"],
                  ["--rt-font-display",   "IM Fell English", "IM Fell English"],
                  ["--rt-font-body",      "Crimson Pro", "Crimson Pro"],
                  ["--rt-font-mono",      "JetBrains Mono", "JetBrains Mono"],
                  ["--rt-ease-mode",      "600ms cubic-bezier(…)", "600ms cubic-bezier(…)"],
                ].map(([token, ms, iron]) => (
                  <tr key={token} style={{ borderBottom: "1px solid var(--rt-border)" }}>
                    <td style={{ padding: "var(--rt-space-2) var(--rt-space-3)", color: "var(--rt-teal)" }}>{token}</td>
                    <td style={{ padding: "var(--rt-space-2) var(--rt-space-3)", color: "var(--rt-ink-on-dark-muted)" }}>{ms}</td>
                    <td style={{ padding: "var(--rt-space-2) var(--rt-space-3)", color: "var(--rt-ink-on-dark-muted)" }}>{iron}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <div style={{ height: "var(--rt-space-16)" }} />
      </main>
    </div>
  );
}

/* ── Internal helper components ───────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: "var(--rt-space-8)" }}>
      <h2 className="rt-label" style={{ marginBottom: "var(--rt-space-6)", fontSize: "var(--rt-text-xs)" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function TypeSpec({
  label,
  sample,
  style,
  children,
}: {
  label: string;
  sample?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <p className="rt-label" style={{ marginBottom: "var(--rt-space-2)" }}>{label}</p>
      {children ?? <p style={{ margin: 0, ...style }}>{sample}</p>}
    </div>
  );
}

function Swatch({ label, cssVar, textVar }: { label: string; cssVar: string; textVar?: string }) {
  return (
    <div>
      <div
        style={{
          height: 56,
          borderRadius: "var(--rt-radius-md)",
          backgroundColor: `var(${cssVar})`,
          border: "1px solid var(--rt-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{
          fontFamily: "var(--rt-font-mono)",
          fontSize: "0.65rem",
          color: textVar ? `var(${textVar})` : "var(--rt-ink-on-dark-muted)",
          letterSpacing: "0.06em",
        }}>
          {cssVar}
        </span>
      </div>
      <p className="rt-label" style={{ marginTop: 6, fontSize: "0.65rem" }}>{label}</p>
    </div>
  );
}

function AnimDemo({ label, className, children }: { label: string; className: string; children: React.ReactNode }) {
  const [key, setKey] = useState(0);
  return (
    <div>
      <p className="rt-label" style={{ marginBottom: "var(--rt-space-2)" }}>{label}</p>
      <div key={key} className={className} style={{ cursor: "pointer" }} onClick={() => setKey(k => k + 1)}>
        <p style={{ fontFamily: "var(--rt-font-body)", fontSize: "var(--rt-text-sm)", margin: 0, color: "var(--rt-ink-on-dark-muted)" }}>
          {children}
        </p>
        <p style={{ fontFamily: "var(--rt-font-mono)", fontSize: "var(--rt-text-xs)", color: "var(--rt-gold)", marginTop: "var(--rt-space-2)" }}>
          Click to replay
        </p>
      </div>
    </div>
  );
}
