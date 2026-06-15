package com.example.server.service;

import java.util.List;

/**
 * Request body for Ollama's POST /api/chat. stream=false makes Ollama return the
 * whole completion in a single response (simpler than streaming for now). The
 * field names must match Ollama's JSON exactly.
 */
public record OllamaChatRequest(
        String model,
        List<OllamaMessage> messages,
        boolean stream,
        Options options) {

    /** Generation knobs Ollama understands; we only need temperature so far. */
    public record Options(double temperature) {}
}
