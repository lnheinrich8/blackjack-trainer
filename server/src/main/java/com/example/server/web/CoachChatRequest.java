package com.example.server.web;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

/**
 * A coaching chat turn from the client: the conversation so far plus the player's
 * current bet analysis (so the model can answer grounded in their stats). The
 * conversation is stateless on the server — the client sends the whole history
 * each time. analysis may be null / have a null session when nothing's tracked yet.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record CoachChatRequest(CoachRequest analysis, List<Turn> messages) {

    /** One chat message. role is "user" or "assistant". */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Turn(String role, String content) {}
}
