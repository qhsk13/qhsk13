package com.example.offlinemessenger.dto;

import com.example.offlinemessenger.entity.RoomType;
import java.time.LocalDateTime;

public class ChatRoomSummary {
    private Long id;
    private String name;
    private RoomType type;
    private Long createdByUserId;
    private LocalDateTime createdAt;

    public ChatRoomSummary(Long id, String name, RoomType type, Long createdByUserId, LocalDateTime createdAt) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.createdByUserId = createdByUserId;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public RoomType getType() { return type; }
    public Long getCreatedByUserId() { return createdByUserId; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
