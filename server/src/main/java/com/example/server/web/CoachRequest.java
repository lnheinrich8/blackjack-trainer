package com.example.server.web;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

/**
 * The player's bet analysis, posted by the client. Mirrors analyzeBets() in the
 * client's betAnalysis.js: { hands, unit, session, perShoe[], perTc[] }. Every
 * number is already computed by the client — the server only narrates it. Unknown
 * fields are ignored so the client can add metrics without breaking the server.
 *
 * Nullable JSON numbers are boxed (Double / Integer); fields that are always
 * present stay primitive.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record CoachRequest(
        int hands,
        Integer unit, // null when there's no tracked history (analyzeBets returns just { hands: 0 })
        Session session,
        List<ShoeStat> perShoe,
        List<TcStat> perTc) {

    /** Session-wide totals, grades, risk discipline, and the leak list. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Session(
            int totalWagered,
            int net,
            double roi,
            Double spread,
            Double correlation,
            Grade ramp,
            Grade results,
            Grade overall,
            boolean graded,
            double avgUnits,
            double maxUnits,
            double winRate,
            Double avgBetPctBankroll,
            Double maxBetPctBankroll,
            int leakCount,
            List<Leak> leaks) {}

    /** A 0–100 sub-score and its letter grade (grade is null until enough hands). */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Grade(int score, String grade) {}

    /** A bet that fought the count. type is "big-bet-low-count" or "min-bet-high-count". */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Leak(
            String type,
            Integer shoe,
            double tc,
            int bet,
            double units,
            double severity) {}

    /** How the player ramped within one physical shoe. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ShoeStat(
            int shoe,
            int rounds,
            Double ramp,
            double peakTc,
            int betAtPeakTc,
            double unitsAtPeakTc,
            double minUnits,
            double maxUnits,
            Double spreadUnits,
            int wagered,
            int net,
            double roi,
            Double deepestPenetration) {}

    /** Per true-count bucket: average bet in units, its spread, and win rate. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record TcStat(
            String id,
            String label,
            int rounds,
            double avgUnits,
            double unitsStdDev,
            double winRate,
            int net) {}
}
