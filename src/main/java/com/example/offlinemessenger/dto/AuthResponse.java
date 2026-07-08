package com.example.offlinemessenger.dto;

public class AuthResponse {
    private Long userId;
    private String loginId;
    private String displayName;
    private String avatarKey;
    private String token;

    public AuthResponse(Long userId, String loginId, String displayName, String token) {
        this(userId, loginId, displayName, com.example.offlinemessenger.entity.AppUser.AVATAR_KEYS[0], token);
    }

    public AuthResponse(Long userId, String loginId, String displayName, String avatarKey, String token) {
        this.userId = userId;
        this.loginId = loginId;
        this.displayName = displayName;
        this.avatarKey = avatarKey;
        this.token = token;
    }

    public Long getUserId() { return userId; }
    public String getLoginId() { return loginId; }
    public String getDisplayName() { return displayName; }
    public String getAvatarKey() { return avatarKey; }
    public String getToken() { return token; }
}
