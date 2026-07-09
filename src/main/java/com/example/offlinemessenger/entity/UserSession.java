package com.example.offlinemessenger.entity;

import javax.persistence.*;
import java.time.LocalDateTime;

/**
 * 로그인 세션 토큰을 사용자 1명당 여러 개 저장하기 위한 엔티티.
 * 예전에는 AppUser.sessionToken 칼럼 하나에만 토큰을 저장해서, 새로 로그인(예: 브라우저 확장)하면
 * 기존 토큰(예: 웹 브라우저)이 덮어써져 다른 곳에서 로그아웃되는 문제가 있었다.
 * 로그인/회원가입 시마다 새 UserSession 행을 추가하고 기존 토큰은 건드리지 않음으로써,
 * 웹과 확장 프로그램(그 외 여러 기기/탭)이 동시에 로그인 상태를 유지할 수 있도록 한다.
 */
@Entity
@Table(indexes = {
        @Index(name = "idx_user_session_token", columnList = "token", unique = true),
        @Index(name = "idx_user_session_user_id", columnList = "userId")
})
public class UserSession {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false, unique = true)
    private String token;

    private LocalDateTime createdAt;
    private LocalDateTime lastSeenAt;

    public UserSession() {}

    public UserSession(Long userId, String token) {
        this.userId = userId;
        this.token = token;
        this.createdAt = LocalDateTime.now();
        this.lastSeenAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public String getToken() { return token; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getLastSeenAt() { return lastSeenAt; }

    public void setId(Long id) { this.id = id; }
    public void setUserId(Long userId) { this.userId = userId; }
    public void setToken(String token) { this.token = token; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public void setLastSeenAt(LocalDateTime lastSeenAt) { this.lastSeenAt = lastSeenAt; }
}
