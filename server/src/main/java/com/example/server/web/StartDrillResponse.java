package com.example.server.web;
import com.example.server.model.Card;

import java.util.List;

public record StartDrillResponse(List<Card> sequence) {}
