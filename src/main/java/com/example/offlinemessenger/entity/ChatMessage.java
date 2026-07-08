package com.example.offlinemessenger.entity;

import javax.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Entity
@Table(indexes = {
        @Index(name = "idx_message_room_time", columnList = "roomId,createdAt"),
        @Index(name = "idx_message_room_id", columnList = "roomId,id")
})
public class ChatMessage {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long roomId;
    private Long senderUserId;
    private String senderDisplayName;

    @Enumerated(EnumType.STRING)
    private MessageType type;

    @Column(length = 4000)
    private String content;

    private String originalFileName;
    private String storedFileName;
    private Long fileSize;
    private LocalDateTime createdAt;

    // "@닉네임" 멘션으로 지목된 사용자 ID들을 콤마로 구분해 저장한다(예: "3,10").
    // 카카오톡처럼 멘션된 사람에게는 알림 설정과 무관하게 항상 알림을 띄워야 하므로,
    // 클라이언트가 이 목록만 보고 판단할 수 있도록 메시지에 함께 실어 보낸다.
    @Column(length = 500)
    private String mentionedUserIdsCsv;

    public ChatMessage() {}

    public static ChatMessage text(Long roomId, Long senderUserId, String senderDisplayName, String content) {
        ChatMessage m = new ChatMessage();
        m.roomId = roomId;
        m.senderUserId = senderUserId;
        m.senderDisplayName = senderDisplayName;
        m.type = MessageType.TEXT;
        m.content = content;
        m.createdAt = LocalDateTime.now();
        return m;
    }

    public static ChatMessage system(Long roomId, String content) {
        ChatMessage m = new ChatMessage();
        m.roomId = roomId;
        m.senderUserId = 0L;
        m.senderDisplayName = "SYSTEM";
        m.type = MessageType.SYSTEM;
        m.content = content;
        m.createdAt = LocalDateTime.now();
        return m;
    }

    public static ChatMessage file(Long roomId, Long senderUserId, String senderDisplayName, String originalFileName, String storedFileName, Long fileSize) {
        ChatMessage m = new ChatMessage();
        m.roomId = roomId;
        m.senderUserId = senderUserId;
        m.senderDisplayName = senderDisplayName;
        m.type = MessageType.FILE;
        m.content = originalFileName;
        m.originalFileName = originalFileName;
        m.storedFileName = storedFileName;
        m.fileSize = fileSize;
        m.createdAt = LocalDateTime.now();
        return m;
    }

    public Long getId() { return id; }
    public Long getRoomId() { return roomId; }
    public Long getSenderUserId() { return senderUserId; }
    public String getSenderDisplayName() { return senderDisplayName; }
    public MessageType getType() { return type; }
    public String getContent() { return content; }
    public String getOriginalFileName() { return originalFileName; }
    public String getStoredFileName() { return storedFileName; }
    public Long getFileSize() { return fileSize; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    public List<Long> getMentionedUserIds() {
        if (mentionedUserIdsCsv == null || mentionedUserIdsCsv.trim().isEmpty()) return Collections.emptyList();
        List<Long> ids = new ArrayList<>();
        for (String part : mentionedUserIdsCsv.split(",")) {
            String trimmed = part.trim();
            if (!trimmed.isEmpty()) {
                try { ids.add(Long.parseLong(trimmed)); } catch (NumberFormatException ignore) { /* skip malformed */ }
            }
        }
        return ids;
    }

    public void setMentionedUserIds(List<Long> mentionedUserIds) {
        this.mentionedUserIdsCsv = (mentionedUserIds == null || mentionedUserIds.isEmpty())
                ? null
                : mentionedUserIds.stream().map(String::valueOf).collect(Collectors.joining(","));
    }

    public void setId(Long id) { this.id = id; }
    public void setRoomId(Long roomId) { this.roomId = roomId; }
    public void setSenderUserId(Long senderUserId) { this.senderUserId = senderUserId; }
    public void setSenderDisplayName(String senderDisplayName) { this.senderDisplayName = senderDisplayName; }
    public void setType(MessageType type) { this.type = type; }
    public void setContent(String content) { this.content = content; }
    public void setOriginalFileName(String originalFileName) { this.originalFileName = originalFileName; }
    public void setStoredFileName(String storedFileName) { this.storedFileName = storedFileName; }
    public void setFileSize(Long fileSize) { this.fileSize = fileSize; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
