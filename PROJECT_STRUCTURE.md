# 프로젝트 분리 구조 - Offline Messenger

## 개요
Offline Messenger 프로젝트는 두 개의 별도 버전으로 관리됩니다:

1. **offline-messenger/** - 폐쇄망(내부/오프라인) 용
2. **offline-messenger-online/** - 온라인망 용

---

## 프로젝트 설명

### 1. offline-messenger/ (폐쇄망용 - 기본)
- **용도**: 내부 폐쇄망(오프라인 환경)에서 사용
- **특징**:
  - H2 Database (메모리 기반 기본값)
  - HSQLDB 옵션
  - 인터넷 연결 불필요
  - 최소 보안 설정 (내부망 전용)
  - 로컬 파일 시스템 기반 저장소

### 2. offline-messenger-online/ (온라인망용)
- **용도**: 온라인 환경(인터넷 연결)에서 사용
- **특징**:
  - PostgreSQL 또는 MySQL 연동 가능
  - 보안 강화 필요
  - HTTPS/SSL 지원 필요
  - 외부 네트워크 통신 지원
  - 클라우드 배포 가능

---

## 파일 구조 비교

```
offline-messenger/                    offline-messenger-online/
├── pom.xml                          ├── pom.xml (다른 artifactId)
├── src/main/java/                   ├── src/main/java/
│   └── config/                      │   └── config/
│       ├── CorsConfig.java          │       ├── CorsConfig.java (온라인 설정)
│       └── WebSocketConfig.java     │       └── WebSocketConfig.java
├── src/main/resources/              ├── src/main/resources/
│   └── application.properties       │   └── application.properties (온라인 설정)
└── README.md                        └── README.md
```

---

## 변경 사항 추적 및 반영 프로세스

### 폐쇄망 → 온라인망 적용 (일방향)
핵심 버그 수정이나 기능 개선이 폐쇄망에서 발견되면, 온라인망에도 반영:

1. **폐쇄망에서 수정 완료**
   ```
   offline-messenger/
   - 버그 수정
   - 기능 개선
   - 테스트 완료
   ```

2. **온라인망에 적용**
   ```
   offline-messenger-online/
   - 동일한 수정 사항 적용
   - 온라인 환경에 맞게 조정
   - 테스트 완료
   ```

### 온라인망 특화 기능
온라인 환경에만 필요한 기능:
- 사용자 인증 강화 (2FA, OAuth)
- API 속도 제한 (Rate Limiting)
- 분산 시스템 지원
- 클라우드 스토리지 연동

---

## 각 프로젝트 설정 파일

### 폐쇄망용 (offline-messenger)
```properties
# application.properties
spring.profiles.active=h2
spring.datasource.url=jdbc:h2:mem:testdb
server.port=8080
```

### 온라인망용 (offline-messenger-online)
```properties
# application.properties
spring.profiles.active=postgresql
spring.datasource.url=jdbc:postgresql://db-server:5432/messenger
spring.datasource.username=${DB_USER}
spring.datasource.password=${DB_PASSWORD}
server.port=8080
server.ssl.enabled=true
server.ssl.key-store=${KEYSTORE_PATH}
```

---

## 배포 전략

### 폐쇄망 배포
```bash
cd offline-messenger
mvn clean package
# offline-messenger-0.0.1-SNAPSHOT.jar 생성
```

### 온라인망 배포
```bash
cd offline-messenger-online
mvn clean package
# offline-messenger-online-0.0.1-SNAPSHOT.jar 생성
```

---

## 주의사항

⚠️ **중요**:
- **절대 하면 안 될 것**:
  - 폐쇄망 코드에 온라인 전용 보안 라이브러리 추가 (불필요)
  - 온라인망 환경 설정을 폐쇄망에 반영 (호환성 문제)

✅ **권장 사항**:
- 폐쇄망에서 버그 수정 → 온라인망으로 단방향 전파
- 각 프로젝트는 독립적인 git 브랜치 또는 별도 저장소로 관리
- 공통 핵심 로직은 필요시 공유 라이브러리로 분리 고려

---

## 통합 관리 (선택사항)

더 효율적인 관리를 위해 Maven Multi-Module 프로젝트로 변환 가능:

```
offline-messenger-parent/
├── pom.xml (부모)
├── offline-messenger-closed/
│   └── pom.xml
└── offline-messenger-online/
    └── pom.xml
```

이 경우 공통 의존성을 부모 pom에서 관리 가능합니다.

---

## 체크리스트

프로젝트 분리 후 확인 사항:

- [ ] 두 프로젝트 모두 독립적으로 빌드 가능
- [ ] offline-messenger 정상 구동 (폐쇄망)
- [ ] offline-messenger-online 정상 구동 (온라인)
- [ ] 각 프로젝트 git 분기 또는 리포지토리 생성
- [ ] 환경 설정 파일 분리 완료
- [ ] 배포 스크립트 각각 작성
- [ ] 팀 멤버들에게 프로젝트 분리 안내

