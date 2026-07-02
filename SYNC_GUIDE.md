# 프로젝트 버전 관리 및 동기화 가이드

## 목적
두 버전(폐쇄망/온라인망)의 프로젝트를 효율적으로 관리하고, 버그 수정이나 기능 개선 사항을 적절히 공유하는 가이드입니다.

---

## 1. 프로젝트 구조 개요

```
c:\offline-messenger/                    (폐쇄망용 - 기본 버전)
├── pom.xml
├── DEPLOYMENT_GUIDE.md
├── PROJECT_STRUCTURE.md
├── .env.example
├── src/
│   └── main/
│       ├── java/
│       │   └── com/example/offlinemessenger/
│       │       ├── config/
│       │       ├── controller/
│       │       ├── service/
│       │       └── ...
│       └── resources/
│           ├── application.properties
│           ├── application-h2.properties
│           └── application-hsqldb.properties
└── ...

c:\offline-messenger-online/             (온라인망용)
├── pom.xml
├── DEPLOYMENT_GUIDE.md
├── PROJECT_STRUCTURE.md
├── .env.example
├── src/
│   └── main/
│       ├── java/
│       │   └── com/example/offlinemessenger/
│       │       ├── config/
│       │       ├── controller/
│       │       ├── service/
│       │       └── ...
│       └── resources/
│           ├── application.properties
│           ├── application-postgresql.properties
│           └── application-h2.properties
└── ...
```

---

## 2. 변경 사항 분류

### A. 공통 변경 (양쪽 적용)
**폐쇄망에서 발견되면 → 온라인망에도 적용**

예시:
- 버그 수정 (데이터 처리, 로직 오류)
- 기능 개선 (비즈니스 로직)
- 보안 패치 (모든 프로젝트)
- 의존성 업데이트
- API 엔드포인트 수정

**적용 범위**: `src/main/java/**` (대부분의 Java 코드)

### B. 환경 특화 변경 (각각만 적용)
**절대 혼동하면 안 되는 것**

#### 폐쇄망만:
- H2/HSQLDB 프로필 설정
- 로컬 파일 시스템 경로
- 폐쇄망 보안 정책

#### 온라인망만:
- PostgreSQL 연동
- SSL/TLS 설정
- 외부 네트워크 통신 설정
- 클라우드 스토리지 연동

**적용 범위**:
- `application.properties`
- `application-{profile}.properties`
- CORS 설정
- SSL 설정

---

## 3. 변경 적용 프로세스

### 시나리오 A: 폐쇄망에서 버그 수정

#### 단계 1: 폐쇄망에서 수정
```bash
cd offline-messenger
# 수정 작업
# 테스트 완료
mvn clean test
```

#### 단계 2: 온라인망에 적용
```bash
cd offline-messenger-online
# 동일한 파일 수정 (Java 코드만)
# 테스트 완료
mvn clean test
```

#### 단계 3: 커밋 (Git 사용 시)
```bash
# 폐쇄망 리포지토리
cd offline-messenger
git add .
git commit -m "Fix: [버그 설명] - Issue #123"

# 온라인망 리포지토리
cd offline-messenger-online
git add .
git commit -m "Fix: [버그 설명] - Issue #123 (동기화)"
```

#### 예시: 채팅 메시지 저장 버그 수정
```java
// 파일: src/main/java/com/example/offlinemessenger/service/ChatService.java
// 두 버전 모두 동일하게 수정

// Before
Message msg = new Message();
msg.setContent(content.trim());  // 잘못된 trim() 위치
msg.setTimestamp(new Date());

// After
Message msg = new Message();
msg.setContent(content);
msg.setTimestamp(new Date());
msg.setFormattedContent(formatContent(content.trim()));  // 올바른 처리
```

---

### 시나리오 B: 온라인망에서 PostgreSQL 관련 기능 추가

#### 1. 온라인망에서만 진행
```bash
cd offline-messenger-online
# PostgreSQL 연동 기능 추가
# config/DbPoolConfig.java 추가 (온라인 전용)
# application-postgresql.properties 수정
```

#### 2. 폐쇄망에는 미적용
폐쇄망 프로젝트는 수정하지 않음 (H2/HSQLDB만 사용)

#### 예시: 데이터베이스 연결 풀 최적화 (온라인만)
```java
// 파일: offline-messenger-online/src/main/java/.../config/DbPoolConfig.java
// 이 파일은 온라인 버전에만 존재
@Configuration
@Profile("postgresql")
public class PostgreSQLPoolConfig {
    // PostgreSQL 특화 설정
    @Bean
    public DataSource dataSource() {
        HikariConfig config = new HikariConfig();
        config.setMaximumPoolSize(20);  // 온라인 트래픽용
        config.setMinimumIdle(5);
        return new HikariDataSource(config);
    }
}
```

---

### 시나리오 C: 공통 의존성 업데이트

#### Spring Boot 마이너 버전 업그레이드
```xml
<!-- 두 pom.xml 모두 동일하게 업데이트 -->

<!-- Before -->
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>2.7.18</version>
</parent>

<!-- After -->
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>2.7.19</version>
</parent>
```

---

## 4. 동기화 체크리스트

### 매월 정기 동기화
- [ ] 폐쇄망에서 수정된 모든 버그 목록 확인
- [ ] 각 버그 수정을 온라인망에 적용 가능한지 검토
- [ ] 적용 가능한 수정 사항을 온라인망에 반영
- [ ] 양쪽 모두 테스트
- [ ] 변경 로그 업데이트

### 분기별 정기 검토
- [ ] 의존성 버전 확인 (보안 패치 적용)
- [ ] API 호환성 검증
- [ ] 설정 파일 비교 (불일치 확인)
- [ ] 팀과 동기화 내용 공유

---

## 5. 유용한 비교/병합 도구

### Git Diff 사용 (Git 저장소인 경우)
```bash
# 폐쇄망과 온라인망 Java 코드 비교
diff -r offline-messenger/src/main/java \
        offline-messenger-online/src/main/java

# 특정 파일 비교
diff offline-messenger/src/main/java/com/example/offlinemessenger/service/ChatService.java \
     offline-messenger-online/src/main/java/com/example/offlinemessenger/service/ChatService.java
```

### Visual Studio Code (권장)
- VS Code Compare 확장: 파일 비교 용이
- Command: `code --diff file1 file2`

### Beyond Compare / Meld
- GUI 기반 파일/디렉토리 비교
- 병합 기능 포함

---

## 6. 공유 라이브러리 고려 (고급)

### 문제
많은 공통 코드를 매번 동기화하기 어려운 경우

### 해결책: 공유 라이브러리 추출

```
offline-messenger-shared/
├── pom.xml
├── src/main/java/
│   └── com/example/offlinemessenger/shared/
│       ├── dto/
│       ├── entity/
│       ├── util/
│       └── service/
└── ...

offline-messenger/ (폐쇄망)
├── pom.xml (offline-messenger-shared 의존)
└── ...

offline-messenger-online/ (온라인)
├── pom.xml (offline-messenger-shared 의존)
└── ...
```

**pom.xml 수정**:
```xml
<dependency>
    <groupId>com.example</groupId>
    <artifactId>offline-messenger-shared</artifactId>
    <version>1.0.0-SNAPSHOT</version>
</dependency>
```

### 장점
- 공통 코드 관리 일원화
- 버그 수정 한 번에 완료
- 버전 관리 용이

### 단점
- 라이브러리 빌드/배포 복잡도 증가
- 초기 구조 설계 어려움

---

## 7. 커밋 메시지 규칙

### 폐쇄망용 (기본)
```
[폐쇄] Fix: 메시지 저장 타임스탬프 버그
[폐쇄] Feat: 파일 다운로드 기능 추가
[폐쇄] Chore: 의존성 업데이트 (Spring Boot 2.7.19)
```

### 온라인망용
```
[온라인] Fix: 메시지 저장 타임스탬프 버그 (폐쇄망 동기화)
[온라인] Feat: PostgreSQL 연결 풀 최적화
[온라인] Chore: 의존성 업데이트 (Spring Boot 2.7.19)
```

### 공유 라이브러리 사용 시
```
[공유] Fix: 메시지 저장 타임스탬프 버그
```

---

## 8. 문제 해결

### Q: 실수로 온라인 환경 설정을 폐쇄망에 커밋함
**A**: 파일 되돌리기
```bash
cd offline-messenger
git restore src/main/resources/application.properties
```

### Q: 폐쇄망과 온라인망의 코드가 많이 달라짐
**A**: 
1. 파일별 비교 (diff 도구 사용)
2. 공통 코드 추출 검토
3. 동기화 프로세스 재정의

### Q: 온라인망에서 수정된 기능이 폐쇄망에도 도움이 될 것 같음
**A**: 환경 특화 부분 제거하고 폐쇄망에 반영
```bash
# 온라인망의 수정을 검토
cd offline-messenger-online
# 환경 특화 코드 (PostgreSQL, SSL 등) 제거
# 폐쇄망으로 이동 및 수정 반영
```

---

## 9. 요약

| 항목 | 폐쇄망 | 온라인망 |
|------|--------|---------|
| Java 코드 | ✅ 동기화 | ✅ 동기화 |
| 설정 파일 | ❌ 분리 | ❌ 분리 |
| 의존성 | ✅ 대부분 동기화 | ✅ 추가 (PostgreSQL 등) |
| 보안 정책 | ⚠️ 최소 | ✅ 강화 |
| 배포 | 로컬/폐쇄망 | 클라우드/온라인 |

