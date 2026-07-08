package com.example.offlinemessenger.entity;

import javax.persistence.*;
import java.time.LocalDateTime;
import java.util.concurrent.ThreadLocalRandom;

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

    // 프로필 생성 시 아바타는 이름/닉네임과 무관하게 완전히 무작위로 배정한다
    // (성이나 이름 글자 기반으로 정해지지 않도록, 미리 준비된 20개 세트 중에서 임의로 하나를 고른다).
    public static final String[] AVATAR_KEYS = {
            "av1", "av2", "av3", "av4", "av5", "av6", "av7", "av8", "av9", "av10",
            "av11", "av12", "av13", "av14", "av15", "av16", "av17", "av18", "av19", "av20"
    };

    public AppUser(String loginId, String passwordHash, String displayName) {
        this.loginId = loginId;
        this.passwordHash = passwordHash;
        this.displayName = displayName;
        this.avatarKey = randomAvatarKey();
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    private static String randomAvatarKey() {
        return AVATAR_KEYS[ThreadLocalRandom.current().nextInt(AVATAR_KEYS.length)];
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
