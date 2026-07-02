package com.example.offlinemessenger.entity;

import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(indexes = {
        @Index(name = "idx_room_member_room_user", columnList = "roomId,userId")
})
public class RoomMember {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long roomId;
    private Long userId;
    private String displayRoomName;
    private LocalDateTime joinedAt;
    private LocalDateTime leftAt;
    private boolean active;

    public RoomMember() {}

    public RoomMember(Long roomId, Long userId) {
        this.roomId = roomId;
        this.userId = userId;
        this.joinedAt = LocalDateTime.now();
        this.active = true;
    }

    public Long getId() { return id; }
    public Long getRoomId() { return roomId; }
    public Long getUserId() { return userId; }
    public String getDisplayRoomName() { return displayRoomName; }
    public LocalDateTime getJoinedAt() { return joinedAt; }
    public LocalDateTime getLeftAt() { return leftAt; }
    public boolean isActive() { return active; }

    public void setId(Long id) { this.id = id; }
    public void setRoomId(Long roomId) { this.roomId = roomId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public void setDisplayRoomName(String displayRoomName) { this.displayRoomName = displayRoomName; }
    public void setJoinedAt(LocalDateTime joinedAt) { this.joinedAt = joinedAt; }
    public void setLeftAt(LocalDateTime leftAt) { this.leftAt = leftAt; }
    public void setActive(boolean active) { this.active = active; }
}
