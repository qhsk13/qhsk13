package com.example.offlinemessenger.entity;

import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(indexes = @Index(name = "idx_room_name", columnList = "name", unique = true))
public class ChatRoom {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable=false, unique=true)
    private String name;

    @Enumerated(EnumType.STRING)
    private RoomType type;

    private Long createdByUserId;
    private LocalDateTime createdAt;

    public ChatRoom() {}

    public ChatRoom(String name, RoomType type, Long createdByUserId) {
        this.name = name;
        this.type = type;
        this.createdByUserId = createdByUserId;
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public RoomType getType() { return type; }
    public Long getCreatedByUserId() { return createdByUserId; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    public void setId(Long id) { this.id = id; }
    public void setName(String name) { this.name = name; }
    public void setType(RoomType type) { this.type = type; }
    public void setCreatedByUserId(Long createdByUserId) { this.createdByUserId = createdByUserId; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
