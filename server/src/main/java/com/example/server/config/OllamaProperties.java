package com.example.server.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Ollama connection + generation settings, bound from the `ollama.*` keys in
 * application.properties (relaxed binding maps ollama.base-url -> baseUrl). No API
 * key — the coach talks to a local Ollama server over plain HTTP.
 */
@ConfigurationProperties(prefix = "ollama")
public record OllamaProperties(
        String baseUrl,
        String model,
        double temperature,
        int timeoutMs) {}
