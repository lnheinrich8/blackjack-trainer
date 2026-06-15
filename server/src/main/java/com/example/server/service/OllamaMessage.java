package com.example.server.service;

/** One message in an Ollama chat exchange. role is "system", "user", or "assistant". */
public record OllamaMessage(String role, String content) {}
