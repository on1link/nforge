// ============================================================
// Neural Forge — src/components/AITutor.tsx
// AI Tutor: chat with Ollama, practice problem generator,
// concept explainer, research paper ingestion
// ============================================================

import { useEffect, useRef, useState } from "react";
import type { SearchResult } from "../api";
import * as api from "../api";
import { C, F, btn, card, col_, glassCard, h1, h2, row } from "../tokens";

type Tab = "chat" | "practice" | "explain" | "papers";
type ContextType = "general" | "skill" | "vault";

const TAB_META: { id: Tab; icon: string; label: string; col: string }[] = [
  { id: "chat", icon: "💬", label: "AI Chat", col: C.accent },
  { id: "practice", icon: "⚔", label: "Practice", col: C.gold },
  { id: "explain", icon: "🔬", label: "Explain", col: C.purple },
  { id: "papers", icon: "📄", label: "Papers", col: C.teal },
];

const SKILLS = [
  { id: "pytorch", name: "PyTorch", path: "mle", level: 4 },
  { id: "transformers", name: "Transformers", path: "mle", level: 1 },
  { id: "nn", name: "Neural Nets", path: "mle", level: 1 },
  { id: "sklearn", name: "Scikit-learn", path: "mle", level: 2 },
  { id: "stats", name: "Statistics", path: "mle", level: 2 },
];

export default function AITutor() {
  const [tab, setTab] = useState<Tab>("chat");
  const [models, setModels] = useState<string[]>(["llama3"]);
  const [activeModel, setActiveModel] = useState("llama3");
  const [sidecarOk, setSidecarOk] = useState<boolean | null>(null);

  // Check sidecar on mount
  useEffect(() => {
    api.sidecarStatus().then(setSidecarOk).catch(() => setSidecarOk(false));
    api.llmListModels().then(m => { if (m.length) { setModels(m); setActiveModel(m[0]); } }).catch(() => { });
  }, []);

  return (
    <div className="nf-view" style={col_(18)}>

      {/* Header */}
      <div style={{ ...row(), justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontFamily: F.mono, color: C.accent, fontSize: 10, letterSpacing: 4, marginBottom: 4 }}>
            // AI INTELLIGENCE LAYER
          </div>
          <h1 style={h1}>AI Tutor</h1>
        </div>
        <div style={row(10)}>
          <div style={{
            ...row(8), padding: "8px 14px", borderRadius: 9,
            background: sidecarOk ? `${C.green}18` : `${C.red}18`,
            border: `1px solid ${sidecarOk ? C.green : C.red}44`,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%", background: sidecarOk ? C.green : C.red,
              boxShadow: `0 0 6px ${sidecarOk ? C.green : C.red}`,
              animation: sidecarOk ? "nf-pulse 2s ease-in-out infinite" : "none"
            }} />
            <span style={{ fontFamily: F.mono, fontSize: 10, color: sidecarOk ? C.green : C.red }}>
              {sidecarOk === null ? "checking…" : sidecarOk ? "sidecar online" : "sidecar offline"}
            </span>
          </div>
          <select
            style={{
              background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 7,
              padding: "7px 12px", color: C.text, fontFamily: F.mono, fontSize: 12, cursor: "pointer"
            }}
            value={activeModel}
            onChange={e => setActiveModel(e.target.value)}>
            {models.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* Sidecar offline warning */}
      {sidecarOk === false && (
        <div style={{ ...glassCard(C.red), padding: "14px 20px" }}>
          <div style={{ fontFamily: F.display, fontSize: 13, color: C.red, marginBottom: 8, fontWeight: 700 }}>
            ⚠ Python sidecar is not running
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 11, color: C.muted, lineHeight: 2 }}>
            <code style={{ background: C.surface, padding: "2px 8px", borderRadius: 4, color: C.gold }}>
              cd python_sidecar && uv run uvicorn main:app --port 7731
            </code>
            <br />
            Also make sure Ollama is running: <code style={{ background: C.surface, padding: "2px 6px", borderRadius: 4, color: C.accent }}>ollama serve</code>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ ...row(6), flexWrap: "wrap" }}>
        {TAB_META.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ ...btn(t.col), opacity: tab === t.id ? 1 : 0.35, background: tab === t.id ? `${t.col}22` : "transparent" }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "chat" && <ChatTab model={activeModel} />}
      {tab === "practice" && <PracticeTab model={activeModel} skills={SKILLS} />}
      {tab === "explain" && <ExplainTab model={activeModel} />}
      {tab === "papers" && <PapersTab model={activeModel} />}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// CHAT TAB
// ═════════════════════════════════════════════════════════════════════════════
function ChatTab({ model }: { model: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [contextType, setContextType] = useState<ContextType>("general");
  const [searchHits, setSearchHits] = useState<SearchResult[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setSearchHits([]);

    try {
      // If vault context, also show search hits
      if (contextType === "vault") {
        const hits = await api.searchVault(input.trim(), 3).catch(() => []);
        setSearchHits(hits);
      }

      const resp = await api.llmChat(
        [...messages, userMsg],
        sessionId,
        contextType,
        undefined,
        model,
      );
      setSessionId(resp.session_id);
      setMessages(prev => [...prev, { role: "assistant", content: resp.reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: `⚠ Error: ${String(e)}. Is Ollama running?` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={col_(14)}>
      {/* Context switcher */}
      <div style={{ ...row(8), flexWrap: "wrap" }}>
        <span style={{ fontFamily: F.display, fontSize: 10, color: C.muted, letterSpacing: 2 }}>CONTEXT:</span>
        {(["general", "skill", "vault"] as ContextType[]).map(ct => (
          <button key={ct} onClick={() => setContextType(ct)}
            style={{ ...btn(contextType === ct ? C.accent : C.muted, true), opacity: contextType === ct ? 1 : 0.4 }}>
            {ct === "general" ? "🧠 General" : ct === "skill" ? "⬡ Skill" : "📓 Vault RAG"}
          </button>
        ))}
        {contextType === "vault" && <span style={{ fontFamily: F.body, fontSize: 11, color: C.muted }}>Uses your notes as context</span>}
        {messages.length > 0 && (
          <button onClick={() => { setMessages([]); setSessionId(undefined); }}
            style={{ ...btn(C.muted, true), marginLeft: "auto" }}>
            ✕ Clear
          </button>
        )}
      </div>

      {/* Message history */}
      <div style={{
        ...card(), padding: 16, minHeight: 360, maxHeight: 480,
        overflowY: "auto", display: "flex", flexDirection: "column", gap: 14,
      }}>
        {messages.length === 0 && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, opacity: 0.5 }}>
            <div style={{ fontSize: 36 }}>🧠</div>
            <div style={{ fontFamily: F.body, fontSize: 13, color: C.muted, textAlign: "center", lineHeight: 1.8 }}>
              Ask anything about ML engineering.<br />
              {contextType === "vault" ? "Your vault notes will be used as context." : "Switch to Vault RAG to query your own notes."}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === "user" ? "flex-end" : "flex-start",
            maxWidth: "82%",
            padding: "12px 16px",
            borderRadius: m.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
            background: m.role === "user" ? `${C.accent}1e` : C.surface2,
            border: `1px solid ${m.role === "user" ? C.accent + "44" : C.border}`,
            fontFamily: F.body,
            fontSize: 13,
            lineHeight: 1.8,
            color: C.text,
            whiteSpace: "pre-wrap",
            animation: "nf-fadein 0.18s ease",
          }}>
            {m.role === "assistant" && <div style={{ fontFamily: F.mono, fontSize: 9, color: C.accent, letterSpacing: 2, marginBottom: 7 }}>AI TUTOR</div>}
            {m.content}
          </div>
        ))}
        {loading && (
          <div style={{
            alignSelf: "flex-start", padding: "12px 16px", borderRadius: "12px 12px 12px 4px",
            background: C.surface2, border: `1px solid ${C.border}`, fontFamily: F.mono, fontSize: 12, color: C.muted,
            animation: "nf-pulse 1s ease-in-out infinite"
          }}>
            thinking…
          </div>
        )}
        {searchHits.length > 0 && (
          <div style={{ alignSelf: "flex-start", maxWidth: "82%" }}>
            <div style={{ fontFamily: F.mono, fontSize: 9, color: C.teal, letterSpacing: 2, marginBottom: 6 }}>VAULT CONTEXT INJECTED</div>
            <div style={col_(5)}>
              {searchHits.map(h => (
                <div key={h.path} style={{ padding: "7px 10px", borderRadius: 7, background: `${C.teal}0a`, border: `1px solid ${C.teal}22`, fontFamily: F.body, fontSize: 11, color: C.muted }}>
                  📓 <span style={{ color: C.teal }}>{h.title}</span> — {h.chunk_text.slice(0, 80)}…
                </div>
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ ...row(10) }}>
        <textarea
          style={{
            flex: 1, background: C.surface2, border: `1px solid ${input ? C.accent + "55" : C.border}`,
            borderRadius: 9, padding: "11px 14px", color: C.text, fontFamily: F.body, fontSize: 14,
            outline: "none", resize: "none", height: 52, lineHeight: 1.6, transition: "border-color 0.2s ease"
          }}
          placeholder="Ask anything… (Shift+Enter for newline, Enter to send)"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <button onClick={send} disabled={!input.trim() || loading}
          style={{ ...btn(C.accent), padding: "14px 20px", alignSelf: "stretch", opacity: (!input.trim() || loading) ? 0.4 : 1 }}>
          {loading ? "…" : "⏎ Send"}
        </button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PRACTICE TAB
// ═════════════════════════════════════════════════════════════════════════════
function PracticeTab({ model, skills }: { model: string; skills: any[] }) {
  const [selSkill, setSelSkill] = useState(skills[0]);
  const [difficulty, setDifficulty] = useState("Medium");
  const [count, setCount] = useState(3);
  const [problems, setProblems] = useState<PracticeProblem[]>([]);
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [scores, setScores] = useState<Record<number, boolean>>({});

  const generate = async () => {
    setLoading(true);
    setProblems([]);
    setRevealed({});
    setScores({});
    try {
      const ps = await api.llmGeneratePractice({
        skill_id: selSkill.id,
        path_id: selSkill.path,
        skill_name: selSkill.name,
        level: selSkill.level,
        difficulty,
        count,
        model,
      });
      setProblems(ps);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const dc: Record<string, string> = { Easy: C.green, Medium: C.gold, Hard: C.red };
  const correct = Object.values(scores).filter(Boolean).length;

  return (
    <div style={col_(16)}>
      {/* Config bar */}
      <div style={{ ...glassCard(C.gold), padding: "16px 20px" }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontFamily: F.display, fontSize: 10, letterSpacing: 2, color: C.muted, marginBottom: 6 }}>SKILL</div>
            <select style={{ background: C.surface2, border: `1px solid ${C.gold}44`, borderRadius: 7, padding: "9px 12px", color: C.text, fontFamily: F.body, fontSize: 13, cursor: "pointer", width: "100%" }}
              onChange={e => setSelSkill(skills.find(s => s.id === e.target.value) ?? skills[0])}>
              {skills.map(s => <option key={s.id} value={s.id}>{s.name} (Lv.{s.level})</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontFamily: F.display, fontSize: 10, letterSpacing: 2, color: C.muted, marginBottom: 6 }}>DIFFICULTY</div>
            <div style={row(6)}>
              {["Easy", "Medium", "Hard"].map(d => (
                <button key={d} onClick={() => setDifficulty(d)}
                  style={{
                    padding: "9px 14px", borderRadius: 7, border: `1.5px solid ${difficulty === d ? dc[d] : C.border}`,
                    background: difficulty === d ? `${dc[d]}22` : "transparent", color: difficulty === d ? dc[d] : C.muted,
                    cursor: "pointer", fontFamily: F.display, fontSize: 12, fontWeight: 700, transition: "all 0.15s"
                  }}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontFamily: F.display, fontSize: 10, letterSpacing: 2, color: C.muted, marginBottom: 6 }}>COUNT</div>
            <div style={row(6)}>
              {[1, 3, 5].map(n => (
                <button key={n} onClick={() => setCount(n)}
                  style={{
                    padding: "9px 16px", borderRadius: 7, border: `1.5px solid ${count === n ? C.gold : C.border}`,
                    background: count === n ? `${C.gold}22` : "transparent", color: count === n ? C.gold : C.muted,
                    cursor: "pointer", fontFamily: F.mono, fontSize: 13, fontWeight: 700
                  }}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <button onClick={generate} disabled={loading}
            style={{ ...btn(C.gold), padding: "12px 22px", opacity: loading ? 0.5 : 1 }}>
            {loading ? "⏳ Generating…" : "⚡ Generate"}
          </button>
        </div>
      </div>

      {/* Score bar */}
      {problems.length > 0 && (
        <div style={{
          ...row(), justifyContent: "space-between", padding: "10px 16px", borderRadius: 9,
          background: C.surface2, border: `1px solid ${C.border}`
        }}>
          <span style={{ fontFamily: F.body, fontSize: 13, color: C.muted }}>{selSkill.name} — {difficulty}</span>
          <div style={row(8)}>
            <span style={{ fontFamily: F.mono, fontSize: 14, color: C.green, fontWeight: 700 }}>{correct}/{problems.length}</span>
            <span style={{ fontFamily: F.display, fontSize: 10, color: C.muted, letterSpacing: 1 }}>CORRECT</span>
          </div>
        </div>
      )}

      {/* Problems */}
      {loading && (
        <div style={{ textAlign: "center", padding: 48, fontFamily: F.mono, color: C.muted, animation: "nf-pulse 1s ease-in-out infinite" }}>
          Generating problems with {model}…
        </div>
      )}
      {!loading && problems.length === 0 && (
        <div style={{ textAlign: "center", padding: 48, fontFamily: F.body, fontSize: 13, color: C.muted }}>
          Configure a skill and hit Generate to create AI-powered practice problems.
        </div>
      )}
      {problems.map((p, i) => (
        <div key={i} style={{ ...card(dc[p.difficulty]), animation: "nf-fadein 0.2s ease" }}>
          <div style={{ ...row(), justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
            <div style={{ ...row(8) }}>
              <span style={{ fontFamily: F.mono, fontSize: 11, color: C.muted }}>#{i + 1}</span>
              <span style={{ fontFamily: F.display, fontSize: 11, fontWeight: 700, letterSpacing: 1, color: dc[p.difficulty] }}>
                {p.difficulty}
              </span>
            </div>
            {i in scores && (
              <span style={{ fontFamily: F.display, fontSize: 12, color: scores[i] ? C.green : C.red, fontWeight: 700 }}>
                {scores[i] ? "✓ Correct" : "✗ Incorrect"}
              </span>
            )}
          </div>

          <div style={{ fontFamily: F.body, fontSize: 15, lineHeight: 1.8, color: C.text, marginBottom: 16 }}>
            {p.question}
          </div>

          {p.hint && !revealed[i] && (
            <div style={{ fontFamily: F.body, fontSize: 11, color: C.muted, marginBottom: 12, fontStyle: "italic" }}>
              💡 Hint: {p.hint}
            </div>
          )}

          {!revealed[i] ? (
            <button onClick={() => setRevealed(r => ({ ...r, [i]: true }))}
              style={{ ...btn(dc[p.difficulty], true) }}>
              Reveal Answer
            </button>
          ) : (
            <>
              <div style={{
                padding: "14px 16px", borderRadius: 9, background: `${dc[p.difficulty]}0d`,
                border: `1px solid ${dc[p.difficulty]}33`, fontFamily: F.body, fontSize: 14,
                lineHeight: 1.85, color: C.text2, whiteSpace: "pre-wrap", marginBottom: 14
              }}>
                {p.answer}
              </div>
              {!(i in scores) && (
                <div style={row(8)}>
                  <span style={{ fontFamily: F.display, fontSize: 10, color: C.muted, letterSpacing: 1 }}>HOW DID YOU DO?</span>
                  <button onClick={() => setScores(s => ({ ...s, [i]: true }))}
                    style={{ ...btn(C.green, true) }}>✓ Got it</button>
                  <button onClick={() => setScores(s => ({ ...s, [i]: false }))}
                    style={{ ...btn(C.red, true) }}>✗ Missed it</button>
                </div>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// EXPLAIN TAB
// ═════════════════════════════════════════════════════════════════════════════
function ExplainTab({ model }: { model: string }) {
  const [concept, setConcept] = useState("");
  const [level, setLevel] = useState<"beginner" | "intermediate" | "expert">("intermediate");
  const [analogy, setAnalogy] = useState("");
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(false);
  const QUICK = ["Attention mechanism", "Backpropagation", "RLHF", "LoRA", "Transformer architecture", "Gradient descent", "Regularisation", "Batch normalisation"];

  const explain = async (c = concept) => {
    if (!c.trim()) return;
    setConcept(c);
    setLoading(true);
    setExplanation("");
    try {
      const res = await api.llmExplain(c.trim(), level, analogy || undefined, model);
      setExplanation(res.explanation);
    } catch (e) {
      setExplanation(`⚠ Error: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={col_(16)}>
      <div style={glassCard(C.purple)}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontFamily: F.display, fontSize: 10, letterSpacing: 2, color: C.muted, marginBottom: 6 }}>CONCEPT</div>
            <input style={{
              background: C.surface2, border: `1px solid ${concept ? C.purple + "55" : C.border}`,
              borderRadius: 7, padding: "9px 13px", color: C.text, fontFamily: F.body, fontSize: 14,
              outline: "none", width: "100%", boxSizing: "border-box", transition: "all 0.2s"
            }}
              placeholder="e.g. self-attention, vanishing gradients, LoRA…"
              value={concept}
              onChange={e => setConcept(e.target.value)}
              onKeyDown={e => e.key === "Enter" && explain()}
            />
          </div>
          <div>
            <div style={{ fontFamily: F.display, fontSize: 10, letterSpacing: 2, color: C.muted, marginBottom: 6 }}>DEPTH</div>
            <div style={row(6)}>
              {(["beginner", "intermediate", "expert"] as const).map(l => (
                <button key={l} onClick={() => setLevel(l)}
                  style={{
                    padding: "9px 12px", borderRadius: 7, border: `1.5px solid ${level === l ? C.purple : C.border}`,
                    background: level === l ? `${C.purple}22` : "transparent", color: level === l ? C.purple : C.muted,
                    cursor: "pointer", fontFamily: F.display, fontSize: 11, fontWeight: 700, transition: "all 0.15s",
                    textTransform: "capitalize"
                  }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div style={{ minWidth: 130 }}>
            <div style={{ fontFamily: F.display, fontSize: 10, letterSpacing: 2, color: C.muted, marginBottom: 6 }}>ANALOGY DOMAIN (optional)</div>
            <input style={{
              background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 7, padding: "9px 12px",
              color: C.text, fontFamily: F.body, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box"
            }}
              placeholder="e.g. cooking, music…"
              value={analogy}
              onChange={e => setAnalogy(e.target.value)}
            />
          </div>
          <button onClick={() => explain()} disabled={!concept.trim() || loading}
            style={{ ...btn(C.purple), padding: "12px 20px", opacity: (!concept.trim() || loading) ? 0.4 : 1 }}>
            {loading ? "⏳ Thinking…" : "🔬 Explain"}
          </button>
        </div>

        {/* Quick-fire buttons */}
        <div style={{ ...row(6), flexWrap: "wrap", marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
          <span style={{ fontFamily: F.display, fontSize: 9, color: C.muted, letterSpacing: 2 }}>QUICK:</span>
          {QUICK.map(q => (
            <button key={q} onClick={() => explain(q)}
              style={{
                padding: "4px 10px", borderRadius: 6, border: `1px solid ${C.purple}33`,
                background: "transparent", color: C.muted, cursor: "pointer",
                fontFamily: F.body, fontSize: 11, transition: "all 0.15s"
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = C.purple; (e.currentTarget as HTMLElement).style.borderColor = `${C.purple}66`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.muted; (e.currentTarget as HTMLElement).style.borderColor = `${C.purple}33`; }}>
              {q}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: 48, fontFamily: F.mono, color: C.muted, animation: "nf-pulse 1s ease-in-out infinite" }}>
          Generating explanation…
        </div>
      )}
      {explanation && (
        <div style={{ ...card(C.purple), animation: "nf-fadein 0.2s ease" }}>
          <div style={{ fontFamily: F.mono, fontSize: 9, color: C.purple, letterSpacing: 3, marginBottom: 14 }}>
            🔬 {concept.toUpperCase()} — {level.toUpperCase()} LEVEL
          </div>
          <div style={{ fontFamily: F.body, fontSize: 14, lineHeight: 1.95, color: C.text, whiteSpace: "pre-wrap" }}>
            {explanation}
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PAPERS TAB
// ═════════════════════════════════════════════════════════════════════════════
function PapersTab({ model }: { model: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [digest, setDigest] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saveVault, setSaveVault] = useState(true);

  const ingest = async () => {
    if (!file) return;
    setLoading(true);
    setDigest(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("save_to_vault", String(saveVault));
      if (model) form.append("model", model);
      const resp = await fetch("http://localhost:7731/llm/ingest/pdf", { method: "POST", body: form });
      const data = await resp.json();
      setDigest(data.digest);
    } catch (e) {
      setDigest({ error: String(e) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={col_(16)}>
      <div style={glassCard(C.teal)}>
        <h2 style={{ ...h2, color: C.teal }}>📄 Research Paper Ingestion</h2>
        <div style={{ fontFamily: F.body, fontSize: 13, color: C.muted, marginBottom: 18, lineHeight: 1.7 }}>
          Upload a PDF → extract text → LLM generates structured notes → optionally saved to your Obsidian vault.
        </div>

        {/* File drop */}
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.name.endsWith(".pdf")) setFile(f); }}
          onClick={() => document.getElementById("pdf-input")?.click()}
          style={{
            border: `2px dashed ${file ? C.teal : C.border}`, borderRadius: 12, padding: "32px 24px",
            textAlign: "center", cursor: "pointer", background: file ? `${C.teal}0a` : "transparent",
            transition: "all 0.2s ease", marginBottom: 16
          }}>
          <input id="pdf-input" type="file" accept=".pdf" style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f); }} />
          <div style={{ fontSize: 32, marginBottom: 10 }}>{file ? "📄" : "⬆"}</div>
          <div style={{ fontFamily: F.display, fontSize: 14, color: file ? C.teal : C.muted, fontWeight: 600 }}>
            {file ? file.name : "Drop PDF or click to browse"}
          </div>
          {file && <div style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, marginTop: 6 }}>
            {(file.size / 1024).toFixed(0)} KB
          </div>}
        </div>

        <div style={{ ...row(12), flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ ...row(8), cursor: "pointer", fontFamily: F.body, fontSize: 13, color: C.muted }}>
            <input type="checkbox" checked={saveVault} onChange={e => setSaveVault(e.target.checked)} style={{ accentColor: C.teal }} />
            Save structured note to Obsidian vault
          </label>
          <button onClick={ingest} disabled={!file || loading}
            style={{ ...btn(C.teal), marginLeft: "auto", opacity: (!file || loading) ? 0.4 : 1, padding: "11px 22px" }}>
            {loading ? "⏳ Processing…" : "📄 Analyse Paper"}
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: 48, fontFamily: F.mono, color: C.muted, animation: "nf-pulse 1s ease-in-out infinite" }}>
          Extracting text and generating digest…
        </div>
      )}

      {digest && !digest.error && (
        <div style={{ ...card(C.teal), animation: "nf-fadein 0.25s ease" }}>
          <div style={{ fontFamily: F.mono, fontSize: 9, color: C.teal, letterSpacing: 3, marginBottom: 16 }}>PAPER DIGEST</div>
          <div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 10 }}>
            {digest.title}
          </div>
          <div style={{ fontFamily: F.body, fontSize: 14, color: C.accent, fontStyle: "italic", marginBottom: 20, lineHeight: 1.7 }}>
            {digest.one_liner}
          </div>
          {[
            ["Problem", digest.problem],
            ["Method", digest.method],
            ["Results", digest.results],
            ["Relevance", digest.relevance],
            ["Limitations", digest.limitations],
          ].map(([l, v]) => v ? (
            <div key={l} style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: F.display, fontSize: 9, color: C.muted, letterSpacing: 2, marginBottom: 6 }}>{l}</div>
              <div style={{ fontFamily: F.body, fontSize: 13, lineHeight: 1.8, color: C.text2 }}>{v}</div>
            </div>
          ) : null)}
          {digest.contributions?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: F.display, fontSize: 9, color: C.muted, letterSpacing: 2, marginBottom: 6 }}>KEY CONTRIBUTIONS</div>
              {digest.contributions.map((c: string, i: number) => (
                <div key={i} style={{ fontFamily: F.body, fontSize: 13, color: C.text2, marginBottom: 5 }}>• {c}</div>
              ))}
            </div>
          )}
          {digest.key_concepts?.length > 0 && (
            <div style={{ ...row(6), flexWrap: "wrap", marginTop: 8 }}>
              {digest.key_concepts.map((c: string) => (
                <span key={c} style={{
                  padding: "2px 9px", borderRadius: 4, background: `${C.teal}1e`, color: C.teal,
                  fontSize: 11, fontWeight: 700, fontFamily: F.display
                }}>
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {digest?.error && (
        <div style={{ ...card(C.red), animation: "nf-fadein 0.2s ease" }}>
          ⚠ {digest.error}
        </div>
      )}
    </div>
  );
}

// Local helpers (same tokens to avoid import issues in standalone file)
// const h1 = { fontSize: 26, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" as const, fontFamily: F.display, margin: 0 };
// const h2 = { fontSize: 14, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, fontFamily: F.display, margin: "0 0 14px" };
// const row = (gap = 8): React.CSSProperties => ({ display: "flex", alignItems: "center", gap });
// const col_ = (gap = 8): React.CSSProperties => ({ display: "flex", flexDirection: "column", gap });
// const grid = (n: number, gap = 14): React.CSSProperties => ({ display: "grid", gridTemplateColumns: `repeat(${n},1fr)`, gap });
// const btn = (col: string, sm?: boolean): React.CSSProperties => ({
//   background: `${col}1a`, border: `1px solid ${col}55`, color: col, padding: sm ? "5px 11px" : "8px 18px",
//   borderRadius: 7, cursor: "pointer", fontFamily: F.display, fontSize: sm ? 11 : 13, fontWeight: 700,
//   letterSpacing: 1.2, textTransform: "uppercase" as const, display: "inline-flex", alignItems: "center",
//   gap: 5, whiteSpace: "nowrap" as const, transition: "all 0.18s ease",
// });
// const card = (col?: string): React.CSSProperties => ({
// background: C.surface, border: `1px solid ${col ? col + "33" : C.border}`, borderRadius: 12, padding: 20,
// boxShadow: col ? `0 0 30px ${col}0d` : "none",
// });
// const glassCard = (col: string): React.CSSProperties => ({
// background: `linear-gradient(135deg,${C.surface} 0%,${col}0a 100%)`,
// border: `1px solid ${col}33`, borderRadius: 12, padding: 20,
// boxShadow: `0 0 30px ${col}12, inset 0 1px 0 ${col}22`,
// });
// const bar: React.CSSProperties = { height: 6, borderRadius: 3, background: C.border, overflow: "hidden", position: "relative" };
// const fill = (pct: number, col: string, h = 6): React.CSSProperties => ({
// width: `${Math.min(100, pct)}%`, height: h, borderRadius: 3,
// background: `linear-gradient(90deg,${col}bb,${col})`, boxShadow: `0 0 8px ${col}88`,
// transition: "width 0.6s cubic-bezier(0.4,0,0.2,1)",
// });


