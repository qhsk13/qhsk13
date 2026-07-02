package com.example.offlinemessenger.dto;

public class AuthRequest {
    private String loginId;
    private String password;
    private String displayName;

    public String getLoginId() { return loginId; }
    public String getPassword() { return password; }
    public String getDisplayName() { return displayName; }
    public void setLoginId(String loginId) { this.loginId = loginId; }
    public void setPassword(String password) { this.password = password; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
}
