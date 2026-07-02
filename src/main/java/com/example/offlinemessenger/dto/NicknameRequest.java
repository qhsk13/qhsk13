package com.example.offlinemessenger.dto;

public class NicknameRequest {
    private String displayName;
    private String avatarKey;
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public String getAvatarKey() { return avatarKey; }
    public void setAvatarKey(String avatarKey) { this.avatarKey = avatarKey; }
}
