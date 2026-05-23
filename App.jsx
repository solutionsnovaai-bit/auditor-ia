import { useState, useRef, useEffect, useCallback } from "react";

// ─── PROMPTS ───────────────────────────────────────────────────────────────────

const ANALYSIS_PROMPT = `Você é um especialista em análise de conversas de vendas e atendimento ao cliente. Analise este áudio de uma ligação de um agente de voz IA da empresa de purificadores de água.

CONTEXTO: A empresa usa um agente de voz IA para contatar clientes. O problema é que muitos clientes não querem agendar demonstrações, muitos já não têm mais purificadores dessa marca, e mesmo quando a IA oferece demonstração, manutenção de outras marcas, ou outras soluções, os clientes recusam.

Analise profundamente e retorne APENAS um JSON válido (sem markdown, sem \`\`\`, apenas o JSON puro) com esta estrutura exata:
{
  "conversionScore": <número de 0 a 100>,
  "duration": "<duração estimada ex: 2m 30s>",
  "customerEmotion": "<emoção principal: Defensivo | Irritado | Curioso | Desinteressado | Neutro | Receptivo>",
  "emotionIntensity": <número de 0 a 100>,
  "agentFlaw": "<principal falha do agente em 1 frase>",
  "mainObjection": "<principal objeção do cliente em 1 frase>",
  "metrics": {
    "interruptionCount": <número>,
    "silenceMoments": <número>,
    "speechRateDifference": "<ex: +30% acelerado | equilibrado | -15% lento>",
    "empathyScore": <número de 0 a 100>
  },
  "keyMoments": [
    {
      "timestamp": "<ex: 00:45>",
      "type": "<falha | objecao | oportunidade>",
      "description": "<o que aconteceu>",
      "fix": "<o que deveria ter sido feito>"
    }
  ],
  "sentimentTimeline": [
    {"time": "<ex: 0:00>", "score": <-100 a 100>}
  ],
  "actionPlan": [
    "<ação concreta de melhoria 1>",
    "<ação concreta de melhoria 2>",
    "<ação concreta de melhoria 3>",
    "<ação concreta de melhoria 4>"
  ],
  "scriptSuggestion": "<uma sugestão de frase ou abordagem que o agente deveria ter usado no momento crítico da ligação>",
  "summary": "<resumo executivo da ligação em 2-3 frases>"
}

Seja preciso, direto e focado em melhorias reais para aumentar a conversão.`;

const WHATSAPP_PROMPT = `Você é um especialista em análise de conversas de vendas via WhatsApp/chat. Analise este texto de conversa de um agente IA da empresa de purificadores de água.

CONTEXTO: A empresa usa um agente IA para contatar clientes via WhatsApp. O problema é que muitos clientes não querem agendar demonstrações.

Analise profundamente e retorne APENAS um JSON válido com esta estrutura exata:
{
  "conversionScore": <número de 0 a 100>,
  "customerEmotion": "<emoção principal: Defensivo | Irritado | Curioso | Desinteressado | Neutro | Receptivo>",
  "emotionIntensity": <número de 0 a 100>,
  "agentFlaw": "<principal falha do agente em 1 frase>",
  "mainObjection": "<principal objeção do cliente em 1 frase>",
  "metrics": {
    "responseTime": "<análise do tempo de resposta>",
    "messageCount": <número de mensagens>,
    "empathyScore": <número de 0 a 100>,
    "clarityScore": <número de 0 a 100>
  },
  "keyMoments": [
    {
      "type": "<falha | objecao | oportunidade>",
      "description": "<o que aconteceu>",
      "fix": "<o que deveria ter sido feito>"
    }
  ],
  "actionPlan": [
    "<ação concreta de melhoria 1>",
    "<ação concreta de melhoria 2>",
    "<ação concreta de melhoria 3>",
    "<ação concreta de melhoria 4>"
  ],
  "scriptSuggestion": "<uma sugestão de mensagem que o agente deveria ter enviado no momento crítico>",
  "summary": "<resumo executivo da conversa em 2-3 frases>"
}`;

const SOCIAL_PROMPT = `Você é um especialista em análise de comentários em redes sociais. Analise estes comentários sobre a empresa de purificadores de água.

Analise profundamente e retorne APENAS um JSON válido com esta estrutura exata:
{
  "overallSentiment": <-100 a 100>,
  "sentimentLabel": "<Muito Negativo | Negativo | Neutro | Positivo | Muito Positivo>",
  "totalComments": <número estimado>,
  "mainThemes": [
    {"theme": "<tema>", "frequency": <0-100>, "sentiment": <-100 a 100>}
  ],
  "topComplaints": ["<reclamação 1>", "<reclamação 2>", "<reclamação 3>"],
  "topPraises": ["<elogio 1>", "<elogio 2>"],
  "actionPlan": [
    "<ação de melhoria 1>",
    "<ação de melhoria 2>",
    "<ação de melhoria 3>"
  ],
  "urgentIssues": "<problemas que precisam de atenção imediata>",
  "summary": "<resumo executivo em 2-3 frases>"
}`;

// ─── WAVEFORM ─────────────────────────────────────────────────────────────────

function WaveformCanvas({ isAnalyzing }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);

    const drawWave = (w, h, amp, freq, phase, color, lw) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.lineCap = "round";
      const cy = h / 2;
      for (let x = 0; x < w; x++) {
        const env = Math.sin((x / w) * Math.PI);
        const y = cy + Math.sin(x * freq + phase) * amp * env;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    const render = () => {
      const w = canvas.width / window.devicePixelRatio;
      const h = canvas.height / window.devicePixelRatio;
      ctx.clearRect(0, 0, w, h);
      const phase = phaseRef.current;
      if (isAnalyzing) {
        phaseRef.current += 0.07;
        drawWave(w, h, 24, 0.03, phase, "rgba(0,240,255,0.25)", 1.5);
        drawWave(w, h, 16, 0.045, -phase * 1.3, "rgba(26,75,255,0.4)", 2);
        drawWave(w, h, 10, 0.06, phase * 0.8, "rgba(0,240,255,0.7)", 2.5);
      } else {
        phaseRef.current += 0.012;
        drawWave(w, h, 5, 0.015, phase, "rgba(0,240,255,0.15)", 1.5);
        drawWave(w, h, 3, 0.02, -phase, "rgba(26,75,255,0.15)", 1.5);
      }
      animRef.current = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [isAnalyzing]);

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />;
}

// ─── SCORE RING ───────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 80, color = "#00F0FF" }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={6} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 1.2s ease" }}
      />
      <text
        x={size / 2} y={size / 2}
        textAnchor="middle" dominantBaseline="central"
        fill="white" fontSize={size * 0.22} fontWeight="700"
        style={{ transform: "rotate(90deg)", transformOrigin: `${size / 2}px ${size / 2}px`, fontFamily: "Syne, sans-serif" }}
      >
        {score}
      </text>
    </svg>
  );
}

// ─── SENTIMENT BAR ────────────────────────────────────────────────────────────

function SentimentBar({ timeline }) {
  if (!timeline || timeline.length === 0) return null;
  const max = 100;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 48, width: "100%" }}>
      {timeline.map((point, i) => {
        const val = Math.max(-100, Math.min(100, point.score || 0));
        const positive = val >= 0;
        const h = Math.abs(val) / max * 100;
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "center" }}>
            {positive ? (
              <>
                <div style={{ flex: 1 }} />
                <div style={{ width: "100%", height: `${h}%`, maxHeight: "50%", background: "#10B981", borderRadius: "3px 3px 0 0", minHeight: 2 }} />
              </>
            ) : (
              <>
                <div style={{ width: "100%", height: `${h}%`, maxHeight: "50%", background: "#EF4444", borderRadius: "0 0 3px 3px", minHeight: 2 }} />
                <div style={{ flex: 1 }} />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function AuditorIA() {
  const [theme, setTheme] = useState("dark");
  const [activeTab, setActiveTab] = useState("ligacao");
  const [appState, setAppState] = useState("idle");
  const [file, setFile] = useState(null);
  const [textInput, setTextInput] = useState("");
  const [isDrag, setIsDrag] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [report, setReport] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const fileRef = useRef(null);
  const progressRef = useRef(null);
  const stepRef = useRef(null);

  const dark = theme === "dark";

  const STEPS_LIGACAO = [
    "Isolando canais de frequência de áudio...",
    "Gemini mapeando tom emocional do cliente...",
    "Identificando falhas no script da IA de voz...",
    "Gerando plano de ação e melhorias...",
  ];
  const STEPS_WHATSAPP = [
    "Processando histórico da conversa...",
    "Analisando tom e intenção do cliente...",
    "Mapeando oportunidades perdidas...",
    "Gerando plano de ação...",
  ];
  const STEPS_SOCIAL = [
    "Processando comentários...",
    "Identificando temas recorrentes...",
    "Calculando sentimento geral...",
    "Gerando insights de reputação...",
  ];

  const steps = activeTab === "ligacao" ? STEPS_LIGACAO : activeTab === "whatsapp" ? STEPS_WHATSAPP : STEPS_SOCIAL;

  const startProgress = useCallback(() => {
    setProgress(0);
    setStepIdx(0);
    let p = 0;
    progressRef.current = setInterval(() => {
      p += 0.8;
      if (p >= 95) { clearInterval(progressRef.current); p = 95; }
      setProgress(Math.round(p));
    }, 40);
    let s = 0;
    stepRef.current = setInterval(() => {
      s++;
      if (s < steps.length) setStepIdx(s);
      else clearInterval(stepRef.current);
    }, 1400);
  }, [steps]);

  const stopProgress = useCallback(() => {
    clearInterval(progressRef.current);
    clearInterval(stepRef.current);
    setProgress(100);
  }, []);

  const toBase64 = (file) =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result.split(",")[1]);
      r.onerror = () => rej(new Error("Leitura falhou"));
      r.readAsDataURL(file);
    });

  const analyze = useCallback(async () => {
    setAppState("processing");
    setErrorMsg("");
    startProgress();

    try {
      let requestBody;

      if (activeTab === "ligacao") {
        // Áudio → Gemini (único que suporta multimodal)
        const b64 = await toBase64(file);
        const mimeType = file.type || "audio/mpeg";
        requestBody = {
          provider: "gemini",
          model: "gemini-2.0-flash",
          contents: [{
            parts: [
              { text: ANALYSIS_PROMPT },
              { inline_data: { mime_type: mimeType, data: b64 } },
            ],
          }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
        };
      } else {
        // Texto → Groq (rápido e free)
        const basePrompt = activeTab === "whatsapp" ? WHATSAPP_PROMPT : SOCIAL_PROMPT;
        requestBody = {
          provider: "groq",
          prompt: `${basePrompt}\n\nTexto para analisar:\n${textInput}`,
        };
      }

      // Chama o proxy seguro — as API keys ficam no servidor
      const resp = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData?.error || `Erro ${resp.status}`);
      }

      const data = await resp.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

      let parsed;
      try {
        const clean = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        parsed = JSON.parse(clean);
      } catch {
        const match = rawText.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
        else throw new Error("Resposta inválida do Gemini");
      }

      stopProgress();
      setTimeout(() => {
        setReport(parsed);
        setAppState("completed");
      }, 400);
    } catch (err) {
      stopProgress();
      setErrorMsg(err.message || "Erro inesperado na análise");
      setAppState("error");
    }
  }, [activeTab, file, textInput, startProgress, stopProgress]);

  const reset = () => {
    setAppState("idle");
    setFile(null);
    setTextInput("");
    setReport(null);
    setErrorMsg("");
    setProgress(0);
    setStepIdx(0);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDrag(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("audio/")) setFile(f);
  };

  // ─── STYLES ──────────────────────────────────────────────────────────────────

  const bg = dark ? "#0a0a0f" : "#f5f7fa";
  const surface = dark ? "#0f0f1a" : "#ffffff";
  const surface2 = dark ? "#16162a" : "#f0f2f7";
  const border = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)";
  const text = dark ? "#ffffff" : "#0a0a1a";
  const textMuted = dark ? "#94a3b8" : "#64748b";
  const cyan = "#00F0FF";
  const blue = "#1A4BFF";

  const cardStyle = {
    background: surface,
    border: `1px solid ${border}`,
    borderRadius: 16,
    padding: "16px",
    marginBottom: 12,
  };

  const tabStyle = (active) => ({
    flex: 1,
    padding: "12px 8px",
    borderRadius: 12,
    border: active ? `1px solid ${cyan}` : `1px solid ${border}`,
    background: active ? (dark ? "rgba(0,240,255,0.08)" : "rgba(0,240,255,0.06)") : "transparent",
    color: active ? cyan : textMuted,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.06em",
    transition: "all 0.2s",
    fontFamily: "Syne, sans-serif",
  });

  const severityColor = (type) =>
    type === "falha" ? "#EF4444" : type === "objecao" ? "#F59E0B" : "#10B981";

  const scoreColor = (score) =>
    score >= 70 ? "#10B981" : score >= 45 ? "#F59E0B" : "#EF4444";

  // ─── RENDER ──────────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: "100vh",
      background: bg,
      color: text,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      paddingBottom: 40,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Syne:wght@700;800&display=swap" rel="stylesheet" />

      {/* HEADER */}
      <div style={{ width: "100%", maxWidth: 480, padding: "28px 20px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <div style={{ width: "100%", display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={() => setTheme(dark ? "light" : "dark")}
            style={{
              background: surface2, border: `1px solid ${border}`,
              borderRadius: 20, padding: "6px 14px", cursor: "pointer",
              color: textMuted, fontSize: 12, fontWeight: 500,
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {dark ? "☀️ Modo Claro" : "🌙 Modo Escuro"}
          </button>
        </div>

        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: dark ? "rgba(0,240,255,0.06)" : "rgba(0,240,255,0.08)",
          border: "1px solid rgba(0,240,255,0.2)",
          borderRadius: 20, padding: "6px 14px",
          fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
          color: cyan, fontFamily: "Syne, sans-serif",
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: cyan, animation: "pulse 2s infinite", display: "inline-block" }} />
          NOVA AI SOLUTIONS — AUDIT ENGINE
        </div>

        <div style={{ textAlign: "center" }}>
          <h1 style={{
            fontFamily: "Syne, sans-serif", fontSize: 44, fontWeight: 800,
            letterSpacing: "-0.02em", margin: 0, lineHeight: 1, color: text,
          }}>
            AUDITOR
            <span style={{ background: "linear-gradient(135deg, #00F0FF, #1A4BFF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              .IA
            </span>
          </h1>
          <p style={{ color: textMuted, fontSize: 13, marginTop: 10, lineHeight: 1.6, maxWidth: 320, margin: "10px auto 0" }}>
            Auditoria multimodal de ligações, conversas no WhatsApp e comentários em redes sociais — em segundos.
          </p>
        </div>

        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          background: dark ? "rgba(16,185,129,0.06)" : "rgba(16,185,129,0.08)",
          border: "1px solid rgba(16,185,129,0.2)",
          borderRadius: 20, padding: "5px 12px",
          fontSize: 11, fontWeight: 600, color: "#10B981",
          fontFamily: "Syne, sans-serif", letterSpacing: "0.08em",
        }}>
          ✦ ANÁLISE VIA GEMINI PRO MULTIMODAL API
        </div>

        <div style={{ display: "flex", gap: 8, width: "100%", marginTop: 4 }}>
          {[
            { id: "ligacao", icon: "📞", label: "LIGAÇÃO", sub: "VOZ IA" },
            { id: "whatsapp", icon: "💬", label: "WHATSAPP", sub: "AGENTE IA" },
            { id: "social", icon: "#", label: "SOCIAL", sub: "COMENTÁRIOS" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => { if (appState === "idle") setActiveTab(t.id); }}
              style={tabStyle(activeTab === t.id)}
            >
              <span style={{ fontSize: 18 }}>{t.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 700 }}>{t.label}</span>
              <span style={{ fontSize: 9, opacity: 0.7, fontWeight: 500 }}>{t.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* MAIN */}
      <div style={{ width: "100%", maxWidth: 480, padding: "16px 20px 0" }}>

        {/* IDLE */}
        {appState === "idle" && (
          <div>
            {activeTab === "ligacao" && (
              <div
                onDragEnter={() => setIsDrag(true)}
                onDragOver={(e) => { e.preventDefault(); setIsDrag(true); }}
                onDragLeave={() => setIsDrag(false)}
                onDrop={handleDrop}
                style={{
                  ...cardStyle,
                  border: `2px dashed ${isDrag || file ? cyan : border}`,
                  background: isDrag ? (dark ? "rgba(0,240,255,0.04)" : "rgba(0,240,255,0.03)") : surface,
                  textAlign: "center", padding: "28px 20px",
                  position: "relative", overflow: "hidden",
                  cursor: "pointer", transition: "all 0.2s",
                }}
                onClick={() => !file && fileRef.current?.click()}
              >
                <div style={{ position: "absolute", inset: 0, opacity: 0.4 }}>
                  <WaveformCanvas isAnalyzing={false} />
                </div>
                <input
                  ref={fileRef} type="file" accept="audio/*,.mp3,.wav"
                  style={{ display: "none" }}
                  onChange={(e) => setFile(e.target.files[0])}
                />
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: "50%",
                    background: file ? "rgba(16,185,129,0.15)" : "rgba(0,240,255,0.1)",
                    border: `1px solid ${file ? "#10B981" : "rgba(0,240,255,0.3)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 14px", fontSize: 24,
                  }}>
                    {file ? "✓" : "⬆"}
                  </div>
                  <p style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 15, margin: "0 0 6px", color: text }}>
                    {file ? file.name : "Arraste sua gravação aqui"}
                  </p>
                  <p style={{ color: textMuted, fontSize: 12, margin: "0 0 18px" }}>
                    {file
                      ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
                      : <span>Formatos aceitos: <span style={{ color: cyan }}>.mp3 / .wav</span></span>
                    }
                  </p>
                  {file ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setFile(null); }}
                        style={{
                          flex: 1, padding: "11px", borderRadius: 10,
                          background: "transparent", border: `1px solid ${border}`,
                          color: textMuted, cursor: "pointer", fontSize: 13, fontWeight: 600,
                        }}
                      >
                        Trocar
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); analyze(); }}
                        style={{
                          flex: 2, padding: "11px", borderRadius: 10,
                          background: "linear-gradient(135deg, #1A4BFF, #00F0FF)",
                          border: "none", color: "#fff", cursor: "pointer",
                          fontSize: 13, fontWeight: 700, fontFamily: "Syne, sans-serif",
                          letterSpacing: "0.04em",
                        }}
                      >
                        ⚡ Analisar Agora
                      </button>
                    </div>
                  ) : (
                    <button
                      style={{
                        padding: "12px 28px", borderRadius: 10,
                        background: "linear-gradient(135deg, #1A4BFF, #00F0FF)",
                        border: "none", color: "#fff", cursor: "pointer",
                        fontSize: 13, fontWeight: 700, fontFamily: "Syne, sans-serif",
                        display: "flex", alignItems: "center", gap: 8, margin: "0 auto",
                        letterSpacing: "0.04em",
                      }}
                      onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                    >
                      🎵 Selecionar Áudio
                    </button>
                  )}
                </div>
              </div>
            )}

            {(activeTab === "whatsapp" || activeTab === "social") && (
              <div style={cardStyle}>
                <p style={{ color: textMuted, fontSize: 12, marginBottom: 10, fontWeight: 500 }}>
                  {activeTab === "whatsapp"
                    ? "Cole o histórico da conversa do WhatsApp:"
                    : "Cole os comentários das redes sociais:"}
                </p>
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={
                    activeTab === "whatsapp"
                      ? "Cliente: Olá, recebi uma ligação sobre purificadores...\nAgente IA: Olá! Sou da Europa Purificadores..."
                      : "Comentário 1: Péssimo atendimento...\nComentário 2: Ótimo produto, recomendo!"
                  }
                  style={{
                    width: "100%", minHeight: 180, padding: "12px",
                    background: surface2, border: `1px solid ${border}`,
                    borderRadius: 10, color: text, fontSize: 13,
                    fontFamily: "'Plus Jakarta Sans', sans-serif", resize: "vertical",
                    outline: "none", boxSizing: "border-box", lineHeight: 1.6,
                  }}
                />
                <button
                  onClick={analyze}
                  disabled={!textInput.trim()}
                  style={{
                    width: "100%", marginTop: 12, padding: "13px",
                    borderRadius: 10, border: "none",
                    background: textInput.trim()
                      ? "linear-gradient(135deg, #1A4BFF, #00F0FF)"
                      : (dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"),
                    color: textInput.trim() ? "#fff" : textMuted,
                    cursor: textInput.trim() ? "pointer" : "not-allowed",
                    fontSize: 13, fontWeight: 700,
                    fontFamily: "Syne, sans-serif", letterSpacing: "0.04em",
                  }}
                >
                  ⚡ Analisar Agora
                </button>
              </div>
            )}
          </div>
        )}

        {/* PROCESSING */}
        {appState === "processing" && (
          <div style={{ ...cardStyle, textAlign: "center", padding: "32px 20px" }}>
            <div style={{ height: 72, marginBottom: 20, position: "relative" }}>
              <WaveformCanvas isAnalyzing={true} />
            </div>
            <p style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 16, color: cyan, margin: "0 0 6px" }}>
              Analisando com Gemini Pro...
            </p>
            <p style={{ color: textMuted, fontSize: 12, margin: "0 0 20px", minHeight: 18 }}>
              {steps[stepIdx]}
            </p>
            <div style={{ background: surface2, borderRadius: 8, height: 6, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 8,
                background: "linear-gradient(90deg, #1A4BFF, #00F0FF)",
                width: `${progress}%`, transition: "width 0.3s ease",
              }} />
            </div>
            <p style={{ color: textMuted, fontSize: 11, marginTop: 8, fontFamily: "monospace" }}>
              {progress}%
            </p>
          </div>
        )}

        {/* ERROR */}
        {appState === "error" && (
          <div style={{ ...cardStyle, border: "1px solid rgba(239,68,68,0.3)", textAlign: "center", padding: "28px 20px" }}>
            <p style={{ fontSize: 32, margin: "0 0 12px" }}>⚠️</p>
            <p style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 15, color: "#EF4444", margin: "0 0 8px" }}>
              Erro na Análise
            </p>
            <p style={{ color: textMuted, fontSize: 13, margin: "0 0 20px" }}>{errorMsg}</p>
            <button
              onClick={reset}
              style={{
                padding: "11px 24px", borderRadius: 10,
                background: "linear-gradient(135deg, #1A4BFF, #00F0FF)",
                border: "none", color: "#fff", cursor: "pointer",
                fontSize: 13, fontWeight: 700, fontFamily: "Syne, sans-serif",
              }}
            >
              Tentar Novamente
            </button>
          </div>
        )}

        {/* COMPLETED */}
        {appState === "completed" && report && (
          <div>
            {/* LIGAÇÃO report */}
            {activeTab === "ligacao" && (
              <>
                <div style={{ ...cardStyle, border: "1px solid rgba(0,240,255,0.2)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                    <ScoreRing score={report.conversionScore || 0} color={scoreColor(report.conversionScore || 0)} />
                    <div style={{ textAlign: "right" }}>
                      <div style={{
                        display: "inline-block", padding: "4px 10px", borderRadius: 20,
                        background: `${scoreColor(report.conversionScore || 0)}15`,
                        border: `1px solid ${scoreColor(report.conversionScore || 0)}40`,
                        color: scoreColor(report.conversionScore || 0),
                        fontSize: 11, fontWeight: 700, fontFamily: "Syne, sans-serif", marginBottom: 8,
                      }}>
                        {report.customerEmotion}
                      </div>
                      <p style={{ fontSize: 12, color: textMuted, margin: 0, maxWidth: 160, textAlign: "right" }}>
                        {report.duration}
                      </p>
                    </div>
                  </div>
                  <div style={{
                    background: dark ? "rgba(239,68,68,0.05)" : "rgba(239,68,68,0.04)",
                    border: "1px solid rgba(239,68,68,0.15)",
                    borderRadius: 10, padding: "10px 12px", marginBottom: 12,
                  }}>
                    <p style={{ fontSize: 10, color: "#EF4444", fontFamily: "monospace", margin: "0 0 3px", textTransform: "uppercase" }}>Gargalo Crítico</p>
                    <p style={{ fontSize: 13, color: text, margin: 0 }}>{report.agentFlaw}</p>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    {[
                      { label: "Interrupções", val: `${report.metrics?.interruptionCount || 0}x`, color: "#EF4444" },
                      { label: "Silêncios", val: `${report.metrics?.silenceMoments || 0}x`, color: text },
                      { label: "Ritmo", val: report.metrics?.speechRateDifference || "—", color: cyan },
                    ].map((m) => (
                      <div key={m.label} style={{ background: surface2, borderRadius: 8, padding: "8px 6px", textAlign: "center" }}>
                        <p style={{ fontSize: 9, color: textMuted, margin: "0 0 3px", textTransform: "uppercase", fontFamily: "monospace" }}>{m.label}</p>
                        <p style={{ fontSize: 12, fontWeight: 700, color: m.color, margin: 0, fontFamily: "Syne, sans-serif" }}>{m.val}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {report.summary && (
                  <div style={cardStyle}>
                    <p style={{ fontSize: 10, color: cyan, fontFamily: "monospace", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Resumo Executivo</p>
                    <p style={{ fontSize: 13, color: textMuted, margin: 0, lineHeight: 1.65 }}>{report.summary}</p>
                  </div>
                )}

                {report.sentimentTimeline?.length > 0 && (
                  <div style={cardStyle}>
                    <p style={{ fontSize: 10, color: cyan, fontFamily: "monospace", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Timeline de Sentimento do Cliente
                    </p>
                    <SentimentBar timeline={report.sentimentTimeline} />
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                      <span style={{ fontSize: 10, color: textMuted, fontFamily: "monospace" }}>Início</span>
                      <span style={{ fontSize: 10, color: textMuted, fontFamily: "monospace" }}>Fim</span>
                    </div>
                    <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: "#10B981" }} />
                        <span style={{ fontSize: 10, color: textMuted }}>Positivo</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: "#EF4444" }} />
                        <span style={{ fontSize: 10, color: textMuted }}>Negativo</span>
                      </div>
                    </div>
                  </div>
                )}

                {report.keyMoments?.length > 0 && (
                  <div>
                    <p style={{ fontSize: 10, color: cyan, fontFamily: "monospace", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Momentos-Chave ({report.keyMoments.length})
                    </p>
                    {report.keyMoments.map((m, i) => (
                      <div key={i} style={{ ...cardStyle, marginBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          {m.timestamp && (
                            <span style={{ fontSize: 10, fontFamily: "monospace", color: textMuted, background: surface2, padding: "2px 8px", borderRadius: 4 }}>
                              {m.timestamp}
                            </span>
                          )}
                          <span style={{
                            fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                            color: severityColor(m.type),
                            background: `${severityColor(m.type)}15`,
                            padding: "2px 8px", borderRadius: 4,
                          }}>
                            {m.type}
                          </span>
                        </div>
                        <p style={{ fontSize: 13, color: textMuted, margin: "0 0 8px", lineHeight: 1.5 }}>
                          <span style={{ color: text, fontWeight: 500 }}>O que ocorreu: </span>{m.description}
                        </p>
                        <div style={{ background: dark ? "rgba(0,240,255,0.05)" : "rgba(0,240,255,0.04)", border: "1px solid rgba(0,240,255,0.15)", borderRadius: 8, padding: "8px 10px" }}>
                          <p style={{ fontSize: 10, color: cyan, fontFamily: "monospace", margin: "0 0 3px", textTransform: "uppercase" }}>Correção</p>
                          <p style={{ fontSize: 12, color: dark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.75)", margin: 0 }}>{m.fix}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {report.scriptSuggestion && (
                  <div style={{ ...cardStyle, border: "1px solid rgba(26,75,255,0.3)", background: dark ? "rgba(26,75,255,0.06)" : "rgba(26,75,255,0.03)" }}>
                    <p style={{ fontSize: 10, color: blue, fontFamily: "monospace", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      💡 Sugestão de Script para Próximas Ligações
                    </p>
                    <p style={{ fontSize: 13, color: text, margin: 0, lineHeight: 1.65, fontStyle: "italic" }}>
                      "{report.scriptSuggestion}"
                    </p>
                  </div>
                )}

                <div style={{ ...cardStyle, background: dark ? "linear-gradient(135deg, rgba(26,75,255,0.08), rgba(0,240,255,0.04))" : surface, border: "1px solid rgba(26,75,255,0.25)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 18 }}>⚡</span>
                    <p style={{ fontSize: 13, fontWeight: 700, fontFamily: "Syne, sans-serif", margin: 0, color: text }}>
                      Plano de Ação — Melhoria de Conversão
                    </p>
                  </div>
                  {report.actionPlan?.map((action, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                        background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, color: "#10B981", fontWeight: 700,
                      }}>✓</div>
                      <p style={{ fontSize: 13, color: dark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.75)", margin: 0, lineHeight: 1.55 }}>{action}</p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* WHATSAPP report */}
            {activeTab === "whatsapp" && (
              <>
                <div style={{ ...cardStyle, border: "1px solid rgba(0,240,255,0.2)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <ScoreRing score={report.conversionScore || 0} color={scoreColor(report.conversionScore || 0)} />
                    <div style={{
                      padding: "4px 10px", borderRadius: 20,
                      background: `${scoreColor(report.conversionScore || 0)}15`,
                      border: `1px solid ${scoreColor(report.conversionScore || 0)}40`,
                      color: scoreColor(report.conversionScore || 0), fontSize: 11, fontWeight: 700,
                    }}>
                      {report.customerEmotion}
                    </div>
                  </div>
                  {report.summary && <p style={{ fontSize: 13, color: textMuted, lineHeight: 1.65, margin: 0 }}>{report.summary}</p>}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                  {[
                    { label: "Mensagens", val: report.metrics?.messageCount || "—" },
                    { label: "Empatia", val: `${report.metrics?.empathyScore || 0}/100` },
                    { label: "Clareza", val: `${report.metrics?.clarityScore || 0}/100` },
                    { label: "Tempo Resp.", val: report.metrics?.responseTime || "—" },
                  ].map((m) => (
                    <div key={m.label} style={{ ...cardStyle, margin: 0, textAlign: "center" }}>
                      <p style={{ fontSize: 9, color: textMuted, margin: "0 0 4px", textTransform: "uppercase", fontFamily: "monospace" }}>{m.label}</p>
                      <p style={{ fontSize: 14, fontWeight: 700, color: cyan, margin: 0, fontFamily: "Syne, sans-serif" }}>{m.val}</p>
                    </div>
                  ))}
                </div>

                {report.keyMoments?.map((m, i) => (
                  <div key={i} style={{ ...cardStyle, marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: severityColor(m.type), background: `${severityColor(m.type)}15`, padding: "2px 8px", borderRadius: 4 }}>{m.type}</span>
                    <p style={{ fontSize: 13, color: textMuted, margin: "8px 0", lineHeight: 1.5 }}>{m.description}</p>
                    <div style={{ background: dark ? "rgba(0,240,255,0.05)" : "rgba(0,240,255,0.04)", border: "1px solid rgba(0,240,255,0.15)", borderRadius: 8, padding: "8px 10px" }}>
                      <p style={{ fontSize: 12, color: dark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.75)", margin: 0 }}>{m.fix}</p>
                    </div>
                  </div>
                ))}

                {report.scriptSuggestion && (
                  <div style={{ ...cardStyle, border: "1px solid rgba(26,75,255,0.3)", background: dark ? "rgba(26,75,255,0.06)" : "rgba(26,75,255,0.03)" }}>
                    <p style={{ fontSize: 10, color: blue, fontFamily: "monospace", margin: "0 0 8px", textTransform: "uppercase" }}>💬 Mensagem Sugerida</p>
                    <p style={{ fontSize: 13, color: text, margin: 0, fontStyle: "italic" }}>"{report.scriptSuggestion}"</p>
                  </div>
                )}

                <div style={{ ...cardStyle, background: dark ? "linear-gradient(135deg, rgba(26,75,255,0.08), rgba(0,240,255,0.04))" : surface, border: "1px solid rgba(26,75,255,0.25)" }}>
                  <p style={{ fontSize: 13, fontWeight: 700, fontFamily: "Syne, sans-serif", margin: "0 0 12px" }}>⚡ Plano de Ação</p>
                  {report.actionPlan?.map((a, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                      <span style={{ color: "#10B981", fontSize: 14, flexShrink: 0 }}>✓</span>
                      <p style={{ fontSize: 13, color: textMuted, margin: 0, lineHeight: 1.55 }}>{a}</p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* SOCIAL report */}
            {activeTab === "social" && (
              <>
                <div style={{ ...cardStyle, border: "1px solid rgba(0,240,255,0.2)" }}>
                  <p style={{ fontSize: 10, color: cyan, fontFamily: "monospace", margin: "0 0 8px", textTransform: "uppercase" }}>Sentimento Geral</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <ScoreRing
                      score={Math.max(0, Math.min(100, Math.round((report.overallSentiment + 100) / 2)))}
                      color={report.overallSentiment > 20 ? "#10B981" : report.overallSentiment > -20 ? "#F59E0B" : "#EF4444"}
                    />
                    <div>
                      <p style={{ fontSize: 16, fontWeight: 700, fontFamily: "Syne, sans-serif", margin: "0 0 4px" }}>{report.sentimentLabel}</p>
                      <p style={{ fontSize: 12, color: textMuted, margin: 0 }}>{report.totalComments} comentários analisados</p>
                    </div>
                  </div>
                  {report.summary && <p style={{ fontSize: 13, color: textMuted, margin: "12px 0 0", lineHeight: 1.65 }}>{report.summary}</p>}
                </div>

                {report.topComplaints?.length > 0 && (
                  <div style={{ ...cardStyle, border: "1px solid rgba(239,68,68,0.2)" }}>
                    <p style={{ fontSize: 10, color: "#EF4444", fontFamily: "monospace", margin: "0 0 10px", textTransform: "uppercase" }}>Principais Reclamações</p>
                    {report.topComplaints.map((c, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                        <span style={{ color: "#EF4444" }}>✕</span>
                        <p style={{ fontSize: 13, color: textMuted, margin: 0 }}>{c}</p>
                      </div>
                    ))}
                  </div>
                )}

                {report.topPraises?.length > 0 && (
                  <div style={{ ...cardStyle, border: "1px solid rgba(16,185,129,0.2)" }}>
                    <p style={{ fontSize: 10, color: "#10B981", fontFamily: "monospace", margin: "0 0 10px", textTransform: "uppercase" }}>Pontos Positivos</p>
                    {report.topPraises.map((p, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                        <span style={{ color: "#10B981" }}>✓</span>
                        <p style={{ fontSize: 13, color: textMuted, margin: 0 }}>{p}</p>
                      </div>
                    ))}
                  </div>
                )}

                {report.urgentIssues && (
                  <div style={{ ...cardStyle, border: "1px solid rgba(245,158,11,0.3)", background: dark ? "rgba(245,158,11,0.04)" : surface }}>
                    <p style={{ fontSize: 10, color: "#F59E0B", fontFamily: "monospace", margin: "0 0 8px", textTransform: "uppercase" }}>⚠ Problemas Urgentes</p>
                    <p style={{ fontSize: 13, color: text, margin: 0 }}>{report.urgentIssues}</p>
                  </div>
                )}

                <div style={{ ...cardStyle, background: dark ? "linear-gradient(135deg, rgba(26,75,255,0.08), rgba(0,240,255,0.04))" : surface, border: "1px solid rgba(26,75,255,0.25)" }}>
                  <p style={{ fontSize: 13, fontWeight: 700, fontFamily: "Syne, sans-serif", margin: "0 0 12px" }}>⚡ Plano de Ação</p>
                  {report.actionPlan?.map((a, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                      <span style={{ color: "#10B981", fontSize: 14, flexShrink: 0 }}>✓</span>
                      <p style={{ fontSize: 13, color: textMuted, margin: 0, lineHeight: 1.55 }}>{a}</p>
                    </div>
                  ))}
                </div>
              </>
            )}

            <button
              onClick={reset}
              style={{
                width: "100%", padding: "12px", borderRadius: 10, marginTop: 4,
                background: surface, border: `1px solid ${border}`,
                color: textMuted, cursor: "pointer", fontSize: 13, fontWeight: 600,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              🔄 Analisar Outra
            </button>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div style={{ marginTop: 32, textAlign: "center", padding: "0 20px" }}>
        <p style={{ fontSize: 11, color: textMuted, margin: "0 0 4px" }}>
          © 2026 Nova AI Solutions. Todos os direitos reservados.
        </p>
        <p style={{ fontSize: 9, color: dark ? "rgba(0,240,255,0.3)" : "rgba(26,75,255,0.4)", margin: 0, fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Engine Calibrator v2.0 // Audit Engine
        </p>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
