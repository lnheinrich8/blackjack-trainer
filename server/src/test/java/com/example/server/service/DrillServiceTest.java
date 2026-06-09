package com.example.server.service;

import com.example.server.model.Card;
import com.example.server.model.DrillConfig;
import com.example.server.model.DrillSession;
import com.example.server.model.GuessResult;
import com.example.server.model.Rank;
import com.example.server.model.Suit;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DrillServiceTest {

    private final DrillService service = new DrillService();

    // ---- startDrill ----

    @Test
    void startDrillDealsRequestedNumberOfCards() {
        DrillSession session = service.startDrill(new DrillConfig(1, 10));
        assertEquals(10, session.getSequence().size());
    }

    @Test
    void startDrillKeepsTheConfigOnTheSession() {
        DrillConfig config = new DrillConfig(6, 20);
        DrillSession session = service.startDrill(config);
        assertEquals(config, session.getConfig());
    }

    @Test
    void startDrillCanDealAnEntireShoe() {
        // Upper boundary: exactly shoe-sized request is allowed.
        DrillSession session = service.startDrill(new DrillConfig(1, 52));
        assertEquals(52, session.getSequence().size());
    }

    @Test
    void startDrillRejectsFewerThanOneDeck() {
        assertThrows(IllegalArgumentException.class,
                () -> service.startDrill(new DrillConfig(0, 5)));
    }

    @Test
    void startDrillRejectsFewerThanOneCard() {
        assertThrows(IllegalArgumentException.class,
                () -> service.startDrill(new DrillConfig(1, 0)));
    }

    @Test
    void startDrillRejectsMoreCardsThanExist() {
        // One deck holds 52 cards, so 53 is one too many.
        assertThrows(IllegalArgumentException.class,
                () -> service.startDrill(new DrillConfig(1, 53)));
    }

    // ---- gradeGuess ----

    @Test
    void gradeGuessRecomputesTheRunningCount() {
        // +1, -1, 0, +1  ->  running count of 1
        List<Card> sequence = List.of(
                new Card(Rank.FIVE, Suit.HEARTS),   // +1
                new Card(Rank.KING, Suit.SPADES),   // -1
                new Card(Rank.EIGHT, Suit.CLUBS),   //  0
                new Card(Rank.TWO, Suit.DIAMONDS)   // +1
        );
        GuessResult result = service.gradeGuess(sequence, 1);
        assertEquals(1, result.correctCount());
    }

    @Test
    void gradeGuessMarksAMatchingGuessCorrect() {
        List<Card> sequence = List.of(
                new Card(Rank.FOUR, Suit.HEARTS),   // +1
                new Card(Rank.SIX, Suit.SPADES)     // +1
        );
        GuessResult result = service.gradeGuess(sequence, 2);
        assertEquals(2, result.guessedCount());
        assertEquals(2, result.correctCount());
        assertTrue(result.isCorrect());
    }

    @Test
    void gradeGuessMarksAWrongGuessIncorrect() {
        List<Card> sequence = List.of(
                new Card(Rank.TEN, Suit.HEARTS)     // -1
        );
        GuessResult result = service.gradeGuess(sequence, 3);
        assertEquals(3, result.guessedCount());
        assertEquals(-1, result.correctCount());
        assertFalse(result.isCorrect());
    }

    @Test
    void gradeGuessOnAnEmptySequenceIsZero() {
        GuessResult result = service.gradeGuess(List.of(), 0);
        assertEquals(0, result.correctCount());
        assertTrue(result.isCorrect());
    }
}
