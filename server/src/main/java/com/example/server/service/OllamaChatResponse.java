package com.example.server.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * The non-streamed response from Ollama's /api/chat. Ollama returns many extra
 * timing/metadata fields (model, created_at, total_duration, eval_count, …) we
 * don't use, so unknown properties are ignored to keep deserialization robust.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record OllamaChatResponse(OllamaMessage message, boolean done) {}
