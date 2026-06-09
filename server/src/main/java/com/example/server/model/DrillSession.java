package com.example.server.model;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class DrillSession {

    private final DrillConfig config;
    private final List<Card> sequence;
    private final List<GuessResult> results;

    public DrillSession(DrillConfig config, List<Card> sequence) {
        this.config = config;
        this.sequence = List.copyOf(sequence); // immutable defensive copy
        this.results = new ArrayList<>();
    }

    public void addResult(GuessResult result) {
        results.add(result);
    }

    public DrillConfig getConfig() {
        return config;
    }

    public List<Card> getSequence() {
        return sequence; // already immutable
    }

    public List<GuessResult> getResults() {
        return Collections.unmodifiableList(results);
    }

    public int totalGuesses() {
        return results.size();
    }

    public int correctGuesses() {
        int correctCount = 0;
        for (GuessResult result : results) {
            if (result.isCorrect()) {
                correctCount++;
            }
        }
        return correctCount;
    }

    public double accuracy() {
        if (totalGuesses() == 0) {
            return 0.0;
        }
        return (double) correctGuesses() / totalGuesses();
    }
}
