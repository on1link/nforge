// ============================================================
// Neural Forge — src/components/SpacedRepetition.tsx
// Flashcard review UI — SM-2 quality buttons, streak counter,
// session progress bar, retention stats.
// ============================================================

import React, { useCallback, useEffect, useState } from "react";
import type { SrCard } from "../api";
import * as api from "../api";
import { C, F, bar, btn, col_, fill, glassCard, grid, h1, row } from "../tokens";

// ── SM-2 quality labels ───────────────────────────────────────────────────────
const QUALITIES = [
  { q: 0, label: "Blackout", sub: "No recall", col: "#ff2050", key: "1" },
  { q: 1, label: "Wrong", sub: "Incorrect", col: "#ff4060", key: "2" },
  { q: 2, label: "Hard miss", sub: "Wrong + hint", col: "#ff6b35", key: "3" },
  { q: 3, label: "Hard", sub: "Correct w/ effort", col: C.gold, key: "4" },
  { q: 4, label: "Good", sub: "Correct, slight hesitation", col: C.accent, key: "5" },
  { q: 5, label: "Perfect", sub: "Instant recall", col: C.green, key: "6" },
];

const PATH_COL: Record<string, string> = { mle: C.mle, de: C.de, ds: C.ds };

interface SessionStats {
  reviewed: number;
  correct: number;
  again: number;
  avgQuality: number;
  qualities: number[];
}

export default function SpacedRepetition() {
  const [cards, setCards] = useState<SrCard[]>([]);
  const [cardIdx, setCardIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [stats, setStats] = useState<SessionStats>({
    reviewed: 0, correct: 0, again: 0, avgQuality: 0, qualities: [],
  });
  const [srMeta, setSrMeta] = useState<any>(null);
  const [flashCol, setFlashCol] = useState<string | null>(null);

  // ── Load due cards on mount ─────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [dueCards, meta] = await Promise.all([
          api.srGetDue(30),
          api.srStats(),
        ]);
        setCards(dueCards);
        setSrMeta(meta);
      } catch (e) {
        // Dev mode — use mock cards
        setCards(MOCK_CARDS);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        if (!revealed) { setRevealed(true); return; }
      }
      if (revealed && !submitting) {
        const q = QUALITIES.find(x => x.key === e.key);
        if (q) handleQuality(q.q);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [revealed, submitting, cards, cardIdx]);

  const currentCard = cards[cardIdx] ?? null;

  const handleQuality = useCallback(async (quality: number) => {
    if (!currentCard || submitting) return;
    setSubmitting(true);

    const col = QUALITIES.find(q => q.q === quality)?.col ?? C.gold;
    setFlashCol(col);
    setTimeout(() => setFlashCol(null), 300);

    try {
      const result = await api.srSubmitReview(currentCard.id, quality);

      setStats(prev => {
        const qs = [...prev.qualities, quality];
        return {
          reviewed: prev.reviewed + 1,
          correct: prev.correct + (quality >= 3 ? 1 : 0),
          again: prev.again + (result.again ? 1 : 0),
          avgQuality: qs.reduce((a, b) => a + b, 0) / qs.length,
          qualities: qs,
        };
      });

      if (result.again) {
        // Re-insert at end of queue
        setCards(prev => [...prev, { ...currentCard }]);
      }

      const next = cardIdx + 1;
      if (next >= cards.length && !result.again) {
        setDone(true);
      } else {
        setCardIdx(next);
        setRevealed(false);
      }
    } catch (e) {
      console.error("Review submit failed:", e);
    } finally {
      setSubmitting(false);
    }
  }, [currentCard, submitting, cardIdx, cards]);

  const pct = cards.length > 0 ? (cardIdx / cards.length) * 100 : 0;

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400 }}>
        <div style={{ fontFamily: F.mono, color: C.muted, letterSpacing: 3 }}>LOADING CARDS…</div>
      </div>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (!loading && cards.length === 0) {
    return (
      <div className="nf-view" style={col_(18)}>
        <div>
          <div style={{ fontFamily: F.mono, color: C.purple, fontSize: 10, letterSpacing: 4, marginBottom: 4 }}>
            // SPACED REPETITION
          </div>
          <h1 style={h1}>Review</h1>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 80, gap: 20 }}>
          <div style={{ fontSize: 64 }}>🎉</div>
          <div style={{ fontFamily: F.display, fontSize: 24, fontWeight: 700, color: C.green, letterSpacing: 2 }}>
            ALL CAUGHT UP
          </div>
          <div style={{ fontFamily: F.body, fontSize: 14, color: C.muted, textAlign: "center", lineHeight: 1.8 }}>
            No cards due today. Level up skills to create new cards,<br />
            or come back tomorrow for your scheduled reviews.
          </div>
          {srMeta && (
            <div style={{ ...row(20), flexWrap: "wrap", justifyContent: "center", marginTop: 16 }}>
              {[
                { v: srMeta.total_cards, l: "Total Cards", col: C.accent },
                { v: srMeta.total_reviews, l: "All-time Reviews", col: C.purple },
                { v: srMeta.retention, l: "Retention", col: C.green },
                { v: srMeta.avg_ease_factor.toFixed(2), l: "Avg EF", col: C.gold },
              ].map(({ v, l, col }) => (
                <div key={l} style={{ ...glassCard(col), textAlign: "center", padding: "14px 20px", minWidth: 110 }}>
                  <div style={{ fontFamily: F.mono, fontSize: 22, color: col, fontWeight: 700 }}>{v}</div>
                  <div style={{ fontFamily: F.display, fontSize: 9, color: C.muted, letterSpacing: 2, marginTop: 3, textTransform: "uppercase" }}>{l}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Session complete ─────────────────────────────────────────────────────────
  if (done) {
    const retention = stats.reviewed > 0 ? Math.round((stats.correct / stats.reviewed) * 100) : 0;
    return (
      <div className="nf-view" style={col_(18)}>
        <div>
          <div style={{ fontFamily: F.mono, color: C.purple, fontSize: 10, letterSpacing: 4, marginBottom: 4 }}>
            // SPACED REPETITION
          </div>
          <h1 style={h1}>Session Complete</h1>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28, padding: "40px 0" }}>
          <div style={{ fontSize: 60, animation: "nf-bounce 1s ease infinite" }}>
            {retention >= 90 ? "🏆" : retention >= 70 ? "⭐" : "💪"}
          </div>
          <div style={{ fontFamily: F.display, fontSize: 28, fontWeight: 700, letterSpacing: 3, color: retention >= 90 ? C.green : retention >= 70 ? C.gold : C.accent }}>
            {retention >= 90 ? "EXCELLENT RECALL" : retention >= 70 ? "GOOD SESSION" : "KEEP PRACTISING"}
          </div>
          <div style={{ ...grid(4, 14), width: "100%", maxWidth: 600 }}>
            {[
              { v: stats.reviewed, l: "Reviewed", col: C.accent },
              { v: stats.correct, l: "Correct", col: C.green },
              { v: `${retention}%`, l: "Retention", col: retention >= 80 ? C.green : C.gold },
              { v: stats.again, l: "Review Again", col: C.red },
            ].map(({ v, l, col }) => (
              <div key={l} style={{ ...glassCard(col), textAlign: "center", padding: "16px 10px" }}>
                <div style={{ fontFamily: F.mono, fontSize: 26, color: col, fontWeight: 700, lineHeight: 1 }}>{v}</div>
                <div style={{ fontFamily: F.display, fontSize: 9, color: C.muted, letterSpacing: 2, marginTop: 4, textTransform: "uppercase" }}>{l}</div>
              </div>
            ))}
          </div>
          {/* Quality distribution bar */}
          <div style={{ width: "100%", maxWidth: 500 }}>
            <div style={{ fontFamily: F.display, fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 10, textAlign: "center" }}>
              QUALITY DISTRIBUTION
            </div>
            <div style={{ display: "flex", height: 32, borderRadius: 8, overflow: "hidden", gap: 2 }}>
              {QUALITIES.map(q => {
                const count = stats.qualities.filter(x => x === q.q).length;
                const pct = stats.reviewed > 0 ? (count / stats.reviewed) * 100 : 0;
                return pct > 0 ? (
                  <div key={q.q} title={`${q.label}: ${count}`} style={{
                    width: `${pct}%`,
                    background: q.col,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: F.mono,
                    fontSize: 10,
                    color: "#000",
                    fontWeight: 700,
                    borderRadius: 4,
                    opacity: 0.9,
                  }}>
                    {count > 0 && count}
                  </div>
                ) : null;
              })}
            </div>
            <div style={{ ...row(), justifyContent: "space-between", marginTop: 8 }}>
              <span style={{ fontFamily: F.display, fontSize: 9, color: C.red }}>Hard / Missed</span>
              <span style={{ fontFamily: F.display, fontSize: 9, color: C.green }}>Perfect Recall</span>
            </div>
          </div>
          <button
            onClick={() => { setDone(false); setCardIdx(0); setRevealed(false); setStats({ reviewed: 0, correct: 0, again: 0, avgQuality: 0, qualities: [] }); }}
            style={{ ...btn(C.accent), fontSize: 14, padding: "12px 28px" }}>
            ↩ Review Again
          </button>
        </div>
      </div>
    );
  }

  // ── Active review ────────────────────────────────────────────────────────────
  const card_ = currentCard!;
  const pathCol = PATH_COL[card_.path_id] ?? C.accent;
  const [nodeName, nodeIcon] = resolveNodeMeta(card_.node_id);

  return (
    <div className="nf-view" style={col_(18)}>

      {/* Header */}
      <div style={{ ...row(), justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontFamily: F.mono, color: C.purple, fontSize: 10, letterSpacing: 4, marginBottom: 4 }}>
            // SPACED REPETITION
          </div>
          <h1 style={h1}>Review</h1>
        </div>
        <div style={{ ...row(12), flexWrap: "wrap" }}>
          <span style={tag_(C.purple)}>📅 {cards.length} due today</span>
          <span style={tag_(C.gold)}>⭐ {stats.reviewed} done</span>
          {srMeta && <span style={tag_(C.green)}>🧠 {srMeta.retention} retention</span>}
        </div>
      </div>

      {/* Session progress */}
      <div style={{ ...bar, height: 8 }}>
        <div style={fill(pct, C.purple, 8)} />
        <div style={{ position: "absolute", right: 0, top: -18, fontFamily: F.mono, fontSize: 9, color: C.muted }}>
          {cardIdx}/{cards.length}
        </div>
      </div>

      {/* ── FLASHCARD ──────────────────────────────────────────────────────── */}
      <div style={{
        ...glassCard(pathCol),
        position: "relative",
        minHeight: 320,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 40px",
        textAlign: "center",
        overflow: "hidden",
        transition: "background 0.2s ease",
        background: flashCol ? `${flashCol}18` : undefined,
        cursor: revealed ? "default" : "pointer",
      }}
        onClick={() => !revealed && setRevealed(true)}
      >
        {/* Background grid decoration */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.03,
          backgroundImage: `repeating-linear-gradient(0deg,${pathCol} 0,${pathCol} 1px,transparent 1px,transparent 30px),repeating-linear-gradient(90deg,${pathCol} 0,${pathCol} 1px,transparent 1px,transparent 30px)`,
          pointerEvents: "none"
        }} />

        {/* Card meta */}
        <div style={{ ...row(8), marginBottom: 20, flexWrap: "wrap", justifyContent: "center" }}>
          <span style={tag_(pathCol, true)}>{card_.path_id.toUpperCase()}</span>
          <span style={tag_(pathCol, true)}>{nodeIcon} {nodeName}</span>
          <span style={tag_(C.muted, true)}>EF {card_.ease_factor.toFixed(2)}</span>
          <span style={tag_(C.muted, true)}>interval {card_.interval}d</span>
        </div>

        {/* Question */}
        <div style={{ fontFamily: F.display, fontSize: 11, color: C.muted, letterSpacing: 3, marginBottom: 16 }}>
          QUESTION
        </div>
        <div style={{ fontFamily: F.body, fontSize: 18, lineHeight: 1.8, color: C.text, maxWidth: 640, marginBottom: 24 }}>
          {getCardQuestion(card_)}
        </div>

        {/* Answer reveal */}
        {!revealed ? (
          <div style={{ fontFamily: F.display, fontSize: 12, color: C.muted, letterSpacing: 2, animation: "nf-pulse 2s ease-in-out infinite" }}>
            SPACE / CLICK TO REVEAL
          </div>
        ) : (
          <>
            <div style={{ width: "100%", maxWidth: 640, height: 1, background: `${pathCol}33`, margin: "0 auto 24px" }} />
            <div style={{ fontFamily: F.display, fontSize: 11, color: pathCol, letterSpacing: 3, marginBottom: 14 }}>
              ANSWER
            </div>
            <div style={{ fontFamily: F.body, fontSize: 16, lineHeight: 1.9, color: C.text2, maxWidth: 640 }}>
              {getCardAnswer(card_)}
            </div>
          </>
        )}
      </div>

      {/* ── Quality buttons ─────────────────────────────────────────────────── */}
      {revealed && (
        <div style={{ animation: "nf-fadein 0.2s ease" }}>
          <div style={{ fontFamily: F.display, fontSize: 10, color: C.muted, letterSpacing: 2, textAlign: "center", marginBottom: 12 }}>
            HOW WELL DID YOU RECALL?  <span style={{ color: C.dim }}>(keys 1–6)</span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            {QUALITIES.map(q => (
              <button key={q.q}
                onClick={() => handleQuality(q.q)}
                disabled={submitting}
                style={{
                  padding: "14px 18px",
                  minWidth: 100,
                  borderRadius: 10,
                  border: `2px solid ${q.col}55`,
                  background: `${q.col}18`,
                  color: q.col,
                  cursor: submitting ? "not-allowed" : "pointer",
                  fontFamily: F.display,
                  fontWeight: 700,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  transition: "all 0.15s ease",
                  boxShadow: "none",
                  opacity: submitting ? 0.5 : 1,
                }}
                onMouseEnter={e => { if (!submitting) (e.currentTarget as HTMLElement).style.background = `${q.col}35`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${q.col}18`; }}
              >
                <span style={{ fontSize: 18 }}>{QUALITY_ICONS[q.q]}</span>
                <span style={{ fontSize: 12, letterSpacing: 1 }}>{q.label}</span>
                <span style={{ fontSize: 9, color: `${q.col}99`, letterSpacing: 0.5 }}>{q.sub}</span>
                <span style={{ fontSize: 9, color: C.muted, fontFamily: F.mono }}>key {q.key}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tip */}
      <div style={{ fontFamily: F.body, fontSize: 11, color: C.muted, textAlign: "center", lineHeight: 1.8 }}>
        Be honest — the algorithm works best with accurate ratings.{" "}
        <span style={{ color: C.purple }}>Grade 3 or higher</span> advances the card.
        Grade 0–2 resets to tomorrow.
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const QUALITY_ICONS = ["💀", "✗", "😬", "😅", "✓", "⚡"];

function resolveNodeMeta(nodeId: string): [string, string] {
  const map: Record<string, [string, string]> = {
    python: ["Python", "🐍"], git: ["Git & Linux", "🐧"],
    numpy: ["NumPy", "🔢"], linalg: ["Lin. Algebra", "📐"],
    stats: ["Statistics", "📊"], mlbasics: ["ML Concepts", "📚"],
    pytorch: ["PyTorch", "🔥"], sklearn: ["Scikit-learn", "🤖"],
    nn: ["Neural Nets", "🧠"], cuda: ["CUDA/GPU", "⚡"],
    transformers: ["Transformers", "🤗"], mlops: ["MLOps", "🐳"],
    distrib: ["Distributed", "🖥"], k8s: ["K8s/Cloud", "☁"],
  };
  return map[nodeId] ?? [nodeId, "⬡"];
}

function getCardQuestion(card: SrCard): string {
  const qs: Record<string, string> = {
    python: "What is the difference between a list and a tuple in Python? When would you use each?",
    git: "Explain git rebase vs git merge. What are the tradeoffs?",
    numpy: "How does NumPy broadcasting work? Give an example with incompatible shapes.",
    linalg: "What is the geometric interpretation of the dot product? What does a negative dot product mean?",
    stats: "Explain the Central Limit Theorem and why it matters for ML.",
    mlbasics: "What is the bias-variance tradeoff? How does it relate to underfitting and overfitting?",
    pytorch: "What is the difference between .detach() and torch.no_grad()? When do you use each?",
    sklearn: "What does sklearn's Pipeline do and why is it important for preventing data leakage?",
    nn: "Explain vanishing gradients. What causes them and how do modern architectures address this?",
    cuda: "What is a CUDA kernel? How does thread/block/grid hierarchy map to parallelism?",
    transformers: "Explain self-attention. How is it computed and what does the attention matrix represent?",
    mlops: "What is model drift? How would you detect and respond to it in production?",
  };
  return qs[card.node_id] ?? `Explain the key concepts and practical applications of ${resolveNodeMeta(card.node_id)[0]}.`;
}

function getCardAnswer(card: SrCard): string {
  const as: Record<string, string> = {
    python: "Lists are mutable sequences; tuples are immutable. Use tuples for heterogeneous data that shouldn't change (e.g., RGB colours, coordinates) and as dict keys. Use lists when you need to append/modify. Tuples are faster and use less memory.",
    git: "Merge preserves history with a merge commit (non-destructive, safe for public branches). Rebase rewrites commits onto a new base (cleaner history, never use on shared branches). Rule: merge for feature → main, rebase for keeping feature branch up-to-date.",
    numpy: "Broadcasting applies operations on arrays of different shapes by virtually expanding the smaller array along dimensions of size 1. Rule: shapes are compatible if each dimension is equal or one of them is 1 — evaluated right-to-left. (3,4) + (4,) works; (3,4) + (3,) requires reshape.",
    linalg: "Dot product = |A||B|cos(θ). It measures projection of one vector onto another. Positive → acute angle (similar direction). Zero → orthogonal. Negative → obtuse angle (opposite directions). Core of attention mechanisms and cosine similarity.",
    stats: "CLT: the mean of n i.i.d. samples approaches a normal distribution as n→∞, regardless of the original distribution. Critical for ML because it justifies using Gaussian assumptions, validates bootstrapping, and underlies hypothesis testing even with non-normal data.",
    mlbasics: "Bias = error from wrong assumptions (underfitting — model too simple). Variance = error from sensitivity to training data (overfitting — model too complex). Tradeoff: reducing bias increases variance and vice versa. Regularisation, ensembles, and cross-validation manage this.",
    pytorch: ".detach() creates a new tensor that shares storage but is removed from the computation graph (gradient flows stop). torch.no_grad() disables gradient tracking for all operations in the block. Use .detach() to extract a tensor for non-grad use; use no_grad() for inference to save memory.",
    sklearn: "Pipeline chains preprocessing + model steps, ensuring transformers are fit only on training data. Without it, fitting a scaler on all data before train/test split leaks test statistics into training, giving overly optimistic cross-validation scores.",
    nn: "When gradients are multiplied through many layers with small weights (<1), they shrink exponentially → early layers learn extremely slowly. Solutions: ReLU activations (gradient=1 for positive), batch normalisation (normalises layer inputs), residual connections (gradient highway), careful initialisation (Xavier/He).",
    cuda: "A CUDA kernel is a GPU function executed by thousands of threads in parallel. Threads are grouped into blocks, blocks into grids. Each thread gets a unique ID to determine which data element to process. Warps (32 threads) execute in lockstep — divergent branches cause serialisation.",
    transformers: "For each position, compute Q, K, V matrices. Attention(Q,K,V) = softmax(QKᵀ/√d_k)V. The attention matrix (n×n) shows how much each token attends to every other token. Multi-head allows attending to different representation subspaces simultaneously. Complexity: O(n²d).",
    mlops: "Model drift: data distribution shifts after deployment (data drift) or the relationship between features and target changes (concept drift). Detect with: monitoring input feature statistics, tracking prediction distributions, periodic evaluation against labelled samples. Respond with: retraining triggers, shadow models, A/B testing.",
  };
  return as[card.node_id] ?? `Review the documentation, implement a small example, and explain it using the Feynman technique. Aim to recall it without notes.`;
}

// Mock cards for dev mode
const MOCK_CARDS: SrCard[] = [
  { id: "c1", user_id: "default", node_id: "pytorch", path_id: "mle", ease_factor: 2.5, interval: 1, repetitions: 0, due_date: "today" },
  { id: "c2", user_id: "default", node_id: "transformers", path_id: "mle", ease_factor: 2.3, interval: 3, repetitions: 2, due_date: "today" },
  { id: "c3", user_id: "default", node_id: "stats", path_id: "mle", ease_factor: 2.7, interval: 7, repetitions: 4, due_date: "today" },
  { id: "c4", user_id: "default", node_id: "nn", path_id: "mle", ease_factor: 2.1, interval: 1, repetitions: 1, due_date: "today" },
];

// Re-export token helpers needed
function tag_(col: string, sm?: boolean): React.CSSProperties {
  return {
    padding: sm ? "1px 6px" : "2px 9px", borderRadius: 4, background: `${col}1e`, color: col,
    fontSize: sm ? 10 : 11, fontWeight: 700, letterSpacing: 0.8, fontFamily: F.display,
    whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 3
  };
}


