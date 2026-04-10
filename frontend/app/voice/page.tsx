"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Volume2, Zap, Bot, MessageSquare } from "lucide-react";
import Link from "next/link";
import { sendChat } from "@/lib/api";

interface Turn {
  role: "user" | "assistant";
  text: string;
}

// Extend window type for SpeechRecognition (not in TS DOM lib by default)
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SpeechRecognition: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webkitSpeechRecognition: any;
  }
}

export default function VoicePage() {
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState<"idle" | "listening" | "processing">("idle");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [interimText, setInterimText] = useState("");
  const [supported, setSupported] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) setSupported(false);
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, interimText]);

  const speak = useCallback((text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.rate = 1.05;
      utt.pitch = 1;
      window.speechSynthesis.speak(utt);
    }
  }, []);

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setStatus("listening");
      setInterimText("");
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setInterimText(interim);
      if (final) {
        setInterimText("");
        handleUserSpeech(final.trim());
      }
    };

    recognition.onerror = () => {
      setStatus("idle");
      setActive(false);
    };

    recognition.onend = () => {
      setInterimText("");
      if (active) {
        // Auto-restart while still active
        try { recognition.start(); } catch { /* already started */ }
      }
    };

    recognitionRef.current = recognition;
    try { recognition.start(); } catch { /* already running */ }
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleUserSpeech(text: string) {
    if (!text) return;
    setTurns(t => [...t, { role: "user", text }]);
    setStatus("processing");

    try {
      const history = turns.map(t => ({ role: t.role === "user" ? "user" : "assistant", content: t.text }));
      const res = await sendChat(text, history);
      const reply = res.message;
      setTurns(t => [...t, { role: "assistant", text: reply }]);
      speak(reply);
    } catch {
      const errMsg = "Sorry, I couldn't process that. Please try again.";
      setTurns(t => [...t, { role: "assistant", text: errMsg }]);
      speak(errMsg);
    } finally {
      setStatus(active ? "listening" : "idle");
    }
  }

  function toggle() {
    if (active) {
      // Stop
      recognitionRef.current?.stop();
      recognitionRef.current?.abort();
      window.speechSynthesis?.cancel();
      recognitionRef.current = null;
      setActive(false);
      setStatus("idle");
      setInterimText("");
    } else {
      // Start
      setActive(true);
      startListening();
    }
  }

  // Start listening after active becomes true
  useEffect(() => {
    if (active && !recognitionRef.current) {
      startListening();
    }
  }, [active, startListening]);

  return (
    <div className="max-w-2xl mx-auto flex flex-col items-center min-h-[70vh] space-y-6">
      {/* Section header + sub-tabs */}
      <div className="w-full">
        <h1 className="font-sans text-xl font-bold text-text-primary mb-3">Practice with AI</h1>
        <div className="flex gap-1 p-1 bg-white/5 rounded-input w-fit border border-border">
          <Link href="/chat"
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors">
            <MessageSquare className="w-3.5 h-3.5" /> Chat
          </Link>
          <Link href="/voice"
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-medium bg-accent/20 text-accent border border-accent/30 transition-colors">
            <Mic className="w-3.5 h-3.5" /> Voice
          </Link>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <h2 className="font-sans text-lg font-semibold text-text-primary mb-1">Voice Assistant</h2>
        <p className="text-text-secondary text-sm">
          {supported
            ? "Speak to SKILLFORGE — powered by your browser's speech recognition"
            : "Voice not supported in this browser. Use Chrome or Edge."}
        </p>
      </motion.div>

      {/* Mic button with ripple */}
      <div className="relative flex items-center justify-center py-4">
        {active && (
          <>
            {[1, 2, 3].map(i => (
              <motion.div
                key={i}
                className="absolute rounded-full border border-accent/30"
                initial={{ width: 80, height: 80, opacity: 0.6 }}
                animate={{ width: 80 + i * 50, height: 80 + i * 50, opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.4, ease: "easeOut" }}
              />
            ))}
          </>
        )}
        <motion.button
          onClick={toggle}
          whileTap={{ scale: 0.94 }}
          disabled={!supported}
          className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all disabled:opacity-40 ${
            active
              ? "bg-red-500/20 border-2 border-red-500/60"
              : "bg-accent/20 border-2 border-accent/50 hover:bg-accent/30"
          }`}
        >
          {active ? (
            <MicOff className="w-8 h-8 text-red-400" />
          ) : (
            <Mic className="w-8 h-8 text-accent" />
          )}
        </motion.button>
      </div>

      {/* Status */}
      <AnimatePresence mode="wait">
        <motion.div
          key={status}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="flex items-center gap-2 text-sm h-6"
        >
          {status === "idle" && <span className="text-text-muted">Tap to start speaking</span>}
          {status === "listening" && (
            <>
              <motion.div
                className="w-2 h-2 rounded-full bg-red-400"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              <span className="text-red-400">
                Listening{interimText ? `: "${interimText}"` : "..."}
              </span>
            </>
          )}
          {status === "processing" && (
            <>
              <Zap className="w-4 h-4 text-accent animate-pulse" />
              <span className="text-accent">SKILLFORGE is thinking...</span>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Conversation transcript */}
      {turns.length > 0 && (
        <div className="w-full glass-card p-4 space-y-3 max-h-72 overflow-y-auto">
          <div className="flex items-center gap-2 mb-1">
            <Volume2 className="w-3.5 h-3.5 text-text-secondary" />
            <span className="text-xs text-text-muted uppercase tracking-wider">Conversation</span>
          </div>
          {turns.map((t, i) => (
            <div key={i} className={`flex gap-2 ${t.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                t.role === "assistant" ? "bg-accent/20" : "bg-secondary/20"
              }`}>
                {t.role === "assistant"
                  ? <Bot className="w-3 h-3 text-accent" />
                  : <Mic className="w-3 h-3 text-secondary" />}
              </div>
              <p className={`text-sm leading-relaxed px-3 py-2 rounded-card max-w-[85%] ${
                t.role === "assistant"
                  ? "text-text-primary bg-white/5"
                  : "text-text-primary bg-secondary/10 border border-secondary/20"
              }`}>
                {t.text}
              </p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      <p className="text-text-muted text-xs text-center max-w-xs">
        Your speech is transcribed locally by your browser — audio is not uploaded or stored.
        SKILLFORGE reads responses aloud using your system voice.
      </p>
    </div>
  );
}
