package com.example.server.web;

import com.example.server.service.CoachService;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Coaching chat endpoint. The client posts the conversation so far plus its freshly
 * computed bet analysis; the service grounds the analysis into the system prompt,
 * appends the conversation, asks the local model, and returns the assistant reply.
 */
@RestController
@RequestMapping("/api/coach")
public class CoachController {

    private final CoachService coachService;

    public CoachController(CoachService coachService) {
        this.coachService = coachService;
    }

    @PostMapping("/chat")
    public CoachResponse chat(@RequestBody CoachChatRequest request) {
        return coachService.chat(request);
    }
}
