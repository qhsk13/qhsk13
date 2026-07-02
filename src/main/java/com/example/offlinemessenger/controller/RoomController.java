package com.example.offlinemessenger.controller;

import com.example.offlinemessenger.dto.*;
import com.example.offlinemessenger.entity.AppUser;
import com.example.offlinemessenger.entity.ChatMessage;
import com.example.offlinemessenger.entity.ChatRoom;
import com.example.offlinemessenger.service.AuthService;
import com.example.offlinemessenger.service.ChatService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/rooms")
public class RoomController {
    private final AuthService authService;
    private final ChatService chatService;

    public RoomController(AuthService authService, ChatService chatService) {
        this.authService = authService;
        this.chatService = chatService;
    }

    @GetMapping
    public List<ChatRoomSummary> rooms(@RequestHeader("X-Auth-Token") String token) {
        AppUser user = authService.requireUser(token);
        return chatService.visibleRooms(user);
    }

    @PostMapping
    public ChatRoom create(@RequestHeader("X-Auth-Token") String token, @RequestBody CreateRoomRequest req) {
        AppUser user = authService.requireUser(token);
        return chatService.createRoom(req, user);
    }

    @PostMapping("/{roomId}/members")
    public Object addMember(@PathVariable Long roomId, @RequestHeader("X-Auth-Token") String token, @RequestBody AddMemberRequest req) {
        AppUser user = authService.requireUser(token);
        return chatService.addMember(roomId, user, req.getLoginId());
    }

    @PutMapping("/{roomId}/name")
    public ChatRoomSummary rename(@PathVariable Long roomId,
                                  @RequestHeader("X-Auth-Token") String token,
                                  @RequestBody RenameRoomRequest req) {
        AppUser user = authService.requireUser(token);
        return chatService.renameRoom(roomId, user, req.getName());
    }

    @PostMapping("/{roomId}/leave")
    public void leave(@PathVariable Long roomId, @RequestHeader("X-Auth-Token") String token) {
        AppUser user = authService.requireUser(token);
        chatService.leave(roomId, user);
    }

    @DeleteMapping("/{roomId}")
    public void delete(@PathVariable Long roomId, @RequestHeader("X-Auth-Token") String token) {
        AppUser user = authService.requireUser(token);
        chatService.deleteRoom(roomId, user);
    }

    @GetMapping("/{roomId}/messages")
    public List<ChatMessage> history(@PathVariable Long roomId,
                                     @RequestHeader("X-Auth-Token") String token,
                                     @RequestParam(value = "limit", required = false) Integer limit,
                                     @RequestParam(value = "beforeId", required = false) Long beforeId) {
        AppUser user = authService.requireUser(token);
        return chatService.history(roomId, user, limit, beforeId);
    }

    @DeleteMapping("/{roomId}/messages/{messageId}")
    public void deleteMessage(@PathVariable Long roomId,
                              @PathVariable Long messageId,
                              @RequestHeader("X-Auth-Token") String token) {
        AppUser user = authService.requireUser(token);
        chatService.deleteMessage(roomId, messageId, user);
    }

    @GetMapping("/{roomId}/members")
    public Object members(@PathVariable Long roomId, @RequestHeader("X-Auth-Token") String token) {
        authService.requireUser(token);
        return chatService.activeMembers(roomId);
    }
}
