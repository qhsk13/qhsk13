package com.example.offlinemessenger.controller;

import com.example.offlinemessenger.dto.*;
import com.example.offlinemessenger.service.AuthService;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public AuthResponse register(@RequestBody AuthRequest req) {
        return authService.register(req);
    }

    @PostMapping("/login")
    public AuthResponse login(@RequestBody AuthRequest req) {
        return authService.login(req);
    }

    @GetMapping("/me")
    public AuthResponse me(@RequestHeader("X-Auth-Token") String token) {
        return authService.me(token);
    }


    @GetMapping("/users")
    public List<UserSummary> users(@RequestHeader("X-Auth-Token") String token,
                                   @RequestParam(value = "q", required = false) String q) {
        return authService.searchUsers(token, q);
    }

    @PutMapping("/nickname")
    public AuthResponse nickname(@RequestHeader("X-Auth-Token") String token, @RequestBody NicknameRequest req) {
        return authService.updateProfile(token, req.getDisplayName(), req.getAvatarKey());
    }
}
