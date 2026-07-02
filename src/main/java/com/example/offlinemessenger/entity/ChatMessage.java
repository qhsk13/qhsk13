package com.example.offlinemessenger.entity;

import javax.persistence.*;
import java.time.LocalDateTime;

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
