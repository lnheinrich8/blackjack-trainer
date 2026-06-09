package com.example.server.web;
import com.example.server.model.Card;

import java.util.List;

public record GradeRequest(List<Card> sequence, int guessedCount) {}
