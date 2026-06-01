package com.smartlearn.service;

import com.smartlearn.entity.User;
import com.smartlearn.repository.UserRepository;
import com.smartlearn.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService implements UserDetailsService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuthenticationManager authManager;

    @Override
    public UserDetails loadUserByUsername(String email)
            throws UsernameNotFoundException {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException(
                        "User not found: " + email));

        return org.springframework.security.core.userdetails.User.builder()
                .username(user.getEmail())
                .password(user.getPassword())
                .roles(user.getRole().name())
                .build();
    }

    public AuthResponse register(RegisterRequest req) {
        if (userRepository.existsByEmail(req.email())) {
            throw new IllegalArgumentException("Email already registered");
        }

        User user = User.builder()
                .name(req.name())
                .email(req.email())
                .password(passwordEncoder.encode(req.password()))
                .build();

        user = userRepository.save(user);
        String token = jwtUtil.generateToken(
                loadUserByUsername(user.getEmail()));
        return new AuthResponse(token, user.getEmail(), 
                user.getName(), user.getId());
    }

    public AuthResponse login(LoginRequest req) {
        authManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        req.email(), req.password()));

        User user = userRepository.findByEmail(req.email()).orElseThrow();
        String token = jwtUtil.generateToken(
                loadUserByUsername(user.getEmail()));
        return new AuthResponse(token, user.getEmail(), 
                user.getName(), user.getId());
    }

    // Records (no need for separate DTO files)
    public record RegisterRequest(String name, String email, String password) {}
    public record LoginRequest(String email, String password) {}
    public record AuthResponse(String token, String email, 
                               String name, Long userId) {}
}