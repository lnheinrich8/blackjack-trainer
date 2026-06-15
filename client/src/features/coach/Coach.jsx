// The Coach page: a chat with the local-LLM coach. Each message sends the whole
// conversation plus the freshly computed bet analysis (betAnalysis.js), so the
// model answers grounded in the player's Testing-mode stats. The server is
// stateless — it prepends the system prompt + facts and replays the conversation.

import { useState, useRef, useEffect } from "react";
import { analyzeBets } from "../stats/betAnalysis";
import { postCoachChat } from "../../api/client";

function Coach({ betStats }) {
    const [messages, setMessages] = useState([]); // { role: "user" | "assistant", content }
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [atBottom, setAtBottom] = useState(true);
    const scrollRef = useRef(null);

    // Keep the transcript pinned to the latest message — but only when the user is
    // already at the bottom, so scrolling up to read earlier turns isn't yanked
    // back down when a new message arrives.
    useEffect(() => {
        if (!atBottom) return;
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [messages, loading, atBottom]);

    // Track whether we're at (near) the bottom, to toggle the jump-to-latest button.
    const handleScroll = () => {
        const el = scrollRef.current;
        if (!el) return;
        setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
    };

    const scrollToBottom = () => {
        const el = scrollRef.current;
        if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    };

    const send = async (e) => {
        e.preventDefault();
        const text = input.trim();
        if (!text || loading) return;

        const next = [...messages, { role: "user", content: text }];
        setMessages(next);
        setInput("");
        setError("");
        setLoading(true);
        try {
            // Recompute each turn so the coach always sees the latest stats.
            const analysis = analyzeBets(betStats.history);
            const res = await postCoachChat(analysis, next);
            setMessages([...next, { role: "assistant", content: res.reply }]);
        } catch (err) {
            const msg =
                err?.response?.data?.message ??
                "Couldn't reach the coach. Make sure the server and Ollama are running.";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="coach-page">
            <div className="coach__chat" ref={scrollRef} onScroll={handleScroll}>
                <div className="coach__inner coach__thread">
                    {messages.length === 0 && (
                        <div className="coach__placeholder">
                            <p className="coach__placeholder-lead">
                                Ask anything about your blackjack betting.
                            </p>
                            <p className="coach__examples">
                                “How’s my bet ramp?” · “What should I fix first?” · “When
                                should I spread my bets up?”
                            </p>
                        </div>
                    )}

                    {messages.map((m, i) => (
                        <div key={i} className={`coach__msg coach__msg--${m.role}`}>
                            {m.content}
                        </div>
                    ))}

                    {loading && (
                        <div className="coach__msg coach__msg--assistant coach__msg--pending">
                            Thinking…
                        </div>
                    )}
                </div>
            </div>

            {!atBottom && (
                <button
                    type="button"
                    className="coach__scrolldown"
                    onClick={scrollToBottom}
                    aria-label="Scroll to latest"
                >
                    ↓
                </button>
            )}

            <div className="coach__inner">
                {error && <p className="coach__error">{error}</p>}

                <form className="coach__composer" onSubmit={send}>
                    <input
                        className="coach__input"
                        type="text"
                        value={input}
                        placeholder="Message your coach…"
                        onChange={(e) => setInput(e.target.value)}
                    />
                    <button
                        className="coach__send"
                        type="submit"
                        disabled={loading || !input.trim()}
                        aria-label="Send"
                    >
                        ↑
                    </button>
                </form>
            </div>
        </div>
    );
}

export default Coach;
