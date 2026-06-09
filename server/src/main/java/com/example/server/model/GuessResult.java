package com.example.server.model;

public record GuessResult(int guessedCount, int correctCount) {

    public boolean isCorrect() {
        return guessedCount == correctCount;
    }
}
