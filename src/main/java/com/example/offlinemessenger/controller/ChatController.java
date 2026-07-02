package com.example.offlinemessenger.controller;

import com.example.offlinemessenger.dto.SendMessageRequest;
import com.example.offlinemessenger.entity.AppUser;
import com.example.offlinemessenger.entity.ChatMessage;
import com.example.offlinemessenger.service.AuthService;
import com.example.offlinemessenger.service.ChatService;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

@Controller
public class ChatController {
    private final AuthService authService;
    private final ChatService chatService;

    public ChatController(AuthService authService, ChatService chatService) {
        this.authService = authService;
        this.chatService = chatService;
    }

    @MessageMapping("/chat.send")
    public ChatMessage send(SendMessageRequest req) {
        AppUser user = authService.requireUser(req.getToken());
        return chatService.sendText(req.getRoomId(), user, req.getContent());
    }
}
