package com.example.offlinemessenger.entity;

import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(indexes = {
        @Index(name = "idx_user_login_id", columnList = "loginId", unique = true),
        @Index(name = "idx_user_token", columnList = "sessionToken", unique = true)
})
public class AppUser {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable=false, unique=true)
    private String loginId;

    @Column(nullable=false)
    private String passwordHash;

    @Column(nullable=false)
    private String displayName;

    private String avatarKey;

    @Column(unique=true)
    private String sessionToken;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public AppUser() {}

    public AppUser(String loginId, String passwordHash, String displayName) {
        this.loginId = loginId;
        this.passwordHash = passwordHash;
        this.displayName = displayName;
        this.avatarKey = defaultAvatarKey(displayName == null || displayName.trim().isEmpty() ? loginId : displayName);
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    private String defaultAvatarKey(String seed) {
        String[] keys = {"aurora", "mint", "violet", "peach", "sky", "mono"};
        int index = (String.valueOf(seed).hashCode() & 0x7fffffff) % keys.length;
        return keys[index];
    }

    public Long getId() { return id; }
    public String getLoginId() { return loginId; }
    public String getPasswordHash() { return passwordHash; }
    public String getDisplayName() { return displayName; }
    public String getAvatarKey() { return avatarKey; }
    public String getSessionToken() { return sessionToken; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }

    public void setId(Long id) { this.id = id; }
    public void setLoginId(String loginId) { this.loginId = loginId; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public void setAvatarKey(String avatarKey) { this.avatarKey = avatarKey; }
    public void setSessionToken(String sessionToken) { this.sessionToken = sessionToken; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
