package com.example.server.service;
import com.example.server.model.*;

import org.springframework.stereotype.Service;
import java.util.ArrayList;
import java.util.List;

@Service
public class DrillService {

    public DrillSession startDrill(DrillConfig config) {
        if (config.numDecks() < 1)
            throw new IllegalArgumentException("Must have at least one deck");

        if (config.numCards() < 1)
            throw new IllegalArgumentException("Cannot have zero cards");

        int shoeSize = 52 * config.numDecks();
        if (config.numCards() > shoeSize)
            throw new IllegalArgumentException("Can't deal more cards than exist");

        Shoe shoe = new Shoe(config.numDecks());
        List<Card> sequence = new ArrayList<>();

        for (int i = 0; i < config.numCards(); i++) {
            sequence.add(shoe.deal());
        }

        return new DrillSession(config, sequence);
    }

    public GuessResult gradeGuess(List<Card> sequence, int guessedCount) {
        CountTracker tracker = new CountTracker();

        for (Card card : sequence) {
            tracker.record(card);
        }
        int correctCount = tracker.getRunningCount();

        return new GuessResult(guessedCount, correctCount);
    }
}
