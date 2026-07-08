package com.example.offlinemessenger.dto;

public class UserSummary {
    private Long userId;
    private String loginId;
    private String displayName;
    private String avatarKey;

    public UserSummary(Long userId, String loginId, String displayName) {
        this(userId, loginId, displayName, com.example.offlinemessenger.entity.AppUser.AVATAR_KEYS[0]);
    }

    public UserSummary(Long userId, String loginId, String displayName, String avatarKey) {
        this.userId = userId;
        this.loginId = loginId;
        this.displayName = displayName;
        this.avatarKey = avatarKey;
    }

    public Long getUserId() { return userId; }
    public String getLoginId() { return loginId; }
    public String getDisplayName() { return displayName; }
    public String getAvatarKey() { return avatarKey; }
}
