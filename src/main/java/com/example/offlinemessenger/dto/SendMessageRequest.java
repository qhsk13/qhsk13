package com.example.offlinemessenger.dto;

public class SendMessageRequest {
    private Long roomId;
    private String token;
    private String content;

    public Long getRoomId() { return roomId; }
    public String getToken() { return token; }
    public String getContent() { return content; }
    public void setRoomId(Long roomId) { this.roomId = roomId; }
    public void setToken(String token) { this.token = token; }
    public void setContent(String content) { this.content = content; }
}
