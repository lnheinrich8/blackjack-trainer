package com.example.server.service;

import com.example.server.config.OllamaProperties;

import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Duration;
import java.util.List;

/**
 * Thin wrapper over a local Ollama server's chat API. No API key — it posts to
 * Ollama on localhost over plain HTTP. The only entry point is {@link #chat}; the
 * model name and temperature come from {@link OllamaProperties} so callers just
 * hand over the conversation.
 */
@Component
public class OllamaClient {

    private final RestClient restClient;
    private final OllamaProperties props;

    public OllamaClient(OllamaProperties props) {
        this.props = props;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        // Connect stays short so a missing Ollama fails fast; the read timeout is
        // generous because local model inference can take several seconds.
        factory.setConnectTimeout(Duration.ofSeconds(3));
        factory.setReadTimeout(Duration.ofMillis(props.timeoutMs()));
        this.restClient = RestClient.builder()
                .baseUrl(props.baseUrl())
                .requestFactory(factory)
                .build();
    }

    /**
     * Send a chat exchange to Ollama and return the assistant's reply text.
     *
     * TODO (left for you to implement): POST an {@link OllamaChatRequest} built
     * from {@code props.model()}, the given {@code messages}, {@code stream=false}
     * and an {@link OllamaChatRequest.Options} carrying {@code props.temperature()}
     * to "/api/chat" via {@code restClient}, deserialize the
     * {@link OllamaChatResponse}, and return {@code response.message().content()}.
     * A connection failure should surface as a RestClientException (handled as a
     * 503 by GlobalExceptionHandler).
     */
    public String chat(List<OllamaMessage> messages) {
        OllamaChatRequest body = new OllamaChatRequest(
                props.model(),
                messages,
                false,
                new OllamaChatRequest.Options(props.temperature()));

        OllamaChatResponse response = restClient.post()
                .uri("/api/chat")
                .body(body)
                .retrieve()
                .body(OllamaChatResponse.class);

        if (response == null || response.message() == null) {
            throw new RestClientException("Ollama returned an empty response");
        }
        return response.message().content();
    }
}
