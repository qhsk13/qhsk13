package com.example.offlinemessenger.controller;

import com.example.offlinemessenger.entity.AppUser;
import com.example.offlinemessenger.entity.ChatMessage;
import com.example.offlinemessenger.service.AuthService;
import com.example.offlinemessenger.service.ChatService;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.util.UriUtils;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;

@RestController
@RequestMapping("/api/files")
public class FileController {
    private final AuthService authService;
    private final ChatService chatService;

    public FileController(AuthService authService, ChatService chatService) {
        this.authService = authService;
        this.chatService = chatService;
    }

    @PostMapping
    public ChatMessage upload(@RequestHeader("X-Auth-Token") String token,
                              @RequestParam Long roomId,
                              @RequestParam MultipartFile file) throws Exception {
        AppUser user = authService.requireUser(token);
        return chatService.saveFileMessage(roomId, user, file);
    }

    @GetMapping("/{messageId}")
    public ResponseEntity<Resource> download(@PathVariable Long messageId) throws Exception {
        ChatMessage msg = chatService.findMessage(messageId)
                .orElseThrow(() -> new IllegalArgumentException("파일 메시지를 찾을 수 없습니다."));

        Path path = chatService.getUploadPath(msg.getStoredFileName());
        Resource resource = new UrlResource(path.toUri());
        String encoded = UriUtils.encode(msg.getOriginalFileName(), StandardCharsets.UTF_8);

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encoded)
                .body(resource);
    }
}
