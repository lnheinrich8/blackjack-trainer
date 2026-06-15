package com.example.server.service;

import com.example.server.web.CoachChatRequest;
import com.example.server.web.CoachRequest;
import com.example.server.web.CoachResponse;

import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StreamUtils;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Turns the client's deterministic bet analysis into grounded coaching prose. The
 * model never computes anything: buildFacts() lays out the already-computed
 * numbers and the system prompt forbids the model from inventing more. This is the
 * guardrail that keeps a small local model honest.
 */
@Service
public class CoachService {

    private final OllamaClient ollama;
    private final String systemPrompt;

    public CoachService(OllamaClient ollama) {
        this.ollama = ollama;
        this.systemPrompt = loadSystemPrompt();
    }

    /**
     * Answer a coaching chat turn. The base system prompt is augmented with the
     * player's current bet-strategy facts (so the model can answer grounded in
     * their stats), then the whole conversation is replayed to the model and its
     * reply returned. Stateless — the client sends the full history each time.
     */
    public CoachResponse chat(CoachChatRequest req) {
        String system = systemPrompt
                + "\n\n---\nThe player's current bet-strategy data:\n\n"
                + factsFor(req == null ? null : req.analysis());

        List<OllamaMessage> messages = new ArrayList<>();
        messages.add(new OllamaMessage("system", system));
        if (req != null && req.messages() != null) {
            for (CoachChatRequest.Turn turn : req.messages()) {
                messages.add(new OllamaMessage(turn.role(), turn.content()));
            }
        }

        String reply = ollama.chat(messages);
        return new CoachResponse(reply);
    }

    // The grounded facts block, or a note when there's nothing tracked yet. Built
    // for any non-null session (buildFacts spells thin/ungraded data as "n/a").
    private String factsFor(CoachRequest analysis) {
        if (analysis == null || analysis.session() == null) {
            return "The player has no tracked Testing-mode betting data yet. Answer "
                    + "general blackjack, card-counting, and bet-sizing questions, and "
                    + "encourage them to play some Testing-mode hands so you can analyze "
                    + "their actual betting.";
        }
        return buildFacts(analysis);
    }

    // Load the system prompt + static knowledge from the classpath once at startup,
    // so it can be tuned without touching code or rebuilding the client.
    private String loadSystemPrompt() {
        try {
            return StreamUtils.copyToString(
                    new ClassPathResource("coach-system-prompt.txt").getInputStream(),
                    StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException("Could not load coach-system-prompt.txt", e);
        }
    }

    /**
     * Format the analysis into a compact, labeled facts block for the prompt.
     * Deterministic, read-only: every value comes straight from the request (the
     * client already computed it). Labeled lines beat raw JSON for a small model,
     * and nullable metrics are spelled out as "n/a" rather than dropped silently.
     */
    private String buildFacts(CoachRequest req) {
        CoachRequest.Session s = req.session();
        StringBuilder sb = new StringBuilder();

        sb.append("SESSION (").append(req.hands()).append(" hands, unit $")
                .append(req.unit()).append(")\n");
        sb.append("- Bet/count correlation: ").append(num(s.correlation()))
                .append(" (ramp ").append(grade(s.ramp())).append(")\n");
        sb.append("- ROI: ").append(pct(s.roi())).append(" (results ")
                .append(grade(s.results())).append("), net ").append(money(s.net()))
                .append(" over ").append(money(s.totalWagered())).append(" wagered\n");
        sb.append("- Bet spread: ").append(s.spread() == null ? "n/a" : (num(s.spread()) + "x"))
                .append(", avg ").append(units(s.avgUnits()))
                .append(", max ").append(units(s.maxUnits())).append("\n");
        sb.append("- Bankroll risk per bet: avg ").append(pct(s.avgBetPctBankroll()))
                .append(", max ").append(pct(s.maxBetPctBankroll())).append("\n");
        sb.append("- Win rate: ").append(pct(s.winRate())).append("\n");
        sb.append("- Overall grade: ").append(grade(s.overall())).append("\n");

        sb.append("\nLEAKS (").append(s.leakCount()).append(" total");
        if (s.leaks() == null || s.leaks().isEmpty()) {
            sb.append("): none\n");
        } else {
            sb.append(s.leaks().size() < s.leakCount() ? ", worst shown):\n" : "):\n");
            for (CoachRequest.Leak leak : s.leaks()) {
                sb.append("- ").append(leak.type()).append(" at TC ").append(num(leak.tc()))
                        .append(": bet ").append(units(leak.units()))
                        .append(" (").append(money(leak.bet())).append(")\n");
            }
        }

        sb.append("\nPER TRUE COUNT (avg bet in units +/- spread, win rate):\n");
        for (CoachRequest.TcStat tc : req.perTc()) {
            if (tc.rounds() == 0) continue; // skip counts the player never saw
            sb.append("- ").append(tc.label()).append(": ").append(units(tc.avgUnits()))
                    .append(" +/- ").append(num(tc.unitsStdDev()))
                    .append(", ").append(pct(tc.winRate())).append(" win")
                    .append(" (").append(tc.rounds()).append(" hands)\n");
        }

        if (req.perShoe() != null && !req.perShoe().isEmpty()) {
            sb.append("\nPER SHOE (ramp, bet at peak count, spread, ROI):\n");
            for (CoachRequest.ShoeStat shoe : req.perShoe()) {
                sb.append("- shoe ").append(shoe.shoe()).append(" (")
                        .append(shoe.rounds()).append(" hands): ramp ").append(num(shoe.ramp()))
                        .append(", peak TC ").append(num(shoe.peakTc()))
                        .append(" bet ").append(units(shoe.unitsAtPeakTc()))
                        .append(", spread ")
                        .append(shoe.spreadUnits() == null ? "n/a" : (num(shoe.spreadUnits()) + "x"))
                        .append(", ROI ").append(pct(shoe.roi())).append("\n");
            }
        }

        return sb.toString();
    }

    // --- formatting helpers (null-safe; keep the facts block tidy and consistent) ---

    private static String grade(CoachRequest.Grade g) {
        if (g == null) return "n/a";
        return (g.grade() == null ? "ungraded" : g.grade()) + " " + g.score() + "/100";
    }

    private static String num(Double d) {
        return d == null ? "n/a" : String.valueOf(d);
    }

    private static String units(double u) {
        return u + "u";
    }

    private static String pct(Double d) {
        return d == null ? "n/a" : Math.round(d * 100) + "%";
    }

    private static String money(int dollars) {
        return (dollars < 0 ? "-$" + (-dollars) : "$" + dollars);
    }
}
