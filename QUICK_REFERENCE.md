# 🚀 Offline Messenger 빠른 참조 카드

## 📁 프로젝트 위치

| 버전 | 경로 | 용도 |
|------|------|------|
| 🔒 폐쇄망 | `c:\offline-messenger\` | 내부/오프라인 환경 |
| 🌐 온라인 | `c:\offline-messenger-online\` | 인터넷/클라우드 환경 |

---

## ⚡ 30초 시작하기

### 폐쇄망 (오프라인)
```bash
cd c:\offline-messenger
mvn clean package
java -jar target/offline-messenger-0.0.1-SNAPSHOT.jar
```
➜ http://localhost:8080 접속

### 온라인
```bash
cd c:\offline-messenger-online
mvn clean package
java -Dspring.profiles.active=postgresql -jar target/offline-messenger-online-0.0.1-SNAPSHOT.jar
```
➜ http://localhost:8080 또는 https://... 접속

---

## 🔑 주요 파일

### 구조 및 배포
- 📄 `PROJECT_STRUCTURE.md` - 프로젝트 분리 개요
- 📄 `DEPLOYMENT_GUIDE.md` - 배포 절차
- 📄 `SYNC_GUIDE.md` - 버전 간 동기화 방법
- 📄 `.env.example` - 환경 변수 템플릿

### 설정
- `pom.xml` - Maven 의존성 (버전별 다름)
- `src/main/resources/application.properties` - 기본 설정
- `src/main/resources/application-{profile}.properties` - 환경별 설정

---

## 🛠️ 일반적인 작업

### 1️⃣ 코드 수정 (폐쇄망에서 시작)
```bash
# 폐쇄망에서 버그 수정
cd c:\offline-messenger
# ... 파일 수정 ...
mvn clean test

# 온라인망에도 적용
cd c:\offline-messenger-online
# ... 동일 파일 수정 (Java 코드만) ...
mvn clean test
```
**→ 설정 파일은 건드리지 말 것!**

### 2️⃣ 의존성 업데이트
```bash
# 두 프로젝트 모두 동일하게 업데이트
# pom.xml에서 version 수정
mvn clean package
```

### 3️⃣ 환경 변수 설정 (온라인)
```bash
# Linux/macOS
export DB_HOST=localhost
export DB_USER=messenger_user
export DB_PASSWORD=your_password

# Windows PowerShell
$env:DB_HOST="localhost"
$env:DB_USER="messenger_user"
$env:DB_PASSWORD="your_password"
```

### 4️⃣ PostgreSQL 연동 (온라인만)
```bash
# PostgreSQL 데이터베이스 생성
createdb offline_messenger

# 사용자 생성
createuser messenger_user -P

# 온라인 버전 실행
cd c:\offline-messenger-online
mvn clean package
java -Dspring.profiles.active=postgresql -jar target/offline-messenger-online-0.0.1-SNAPSHOT.jar
```

---

## ✅ 체크리스트

### 초기 설정
- [ ] 두 프로젝트 모두 `mvn clean package` 실행 가능?
- [ ] 폐쇄망 버전이 http://localhost:8080 에서 실행됨?
- [ ] 온라인 버전도 실행 가능함?

### 정기 동기화 (월 1회)
- [ ] 폐쇄망의 버그 수정 목록 확인
- [ ] 각 수정을 온라인 버전에 반영 가능한지 검토
- [ ] 적용 가능한 수정 반영
- [ ] 두 버전 모두 테스트
- [ ] 변경 로그 업데이트

### 보안 (분기 1회)
- [ ] 의존성 보안 패치 확인
- [ ] SSL 인증서 유효 기간 확인 (온라인)
- [ ] 방화벽 규칙 검토

---

## 🚨 주의사항

### ❌ 절대 하면 안 됨
| 내용 | 이유 |
|------|------|
| 폐쇄망에 PostgreSQL 의존성 추가 | 폐쇄망에서 필요 없음 + 복잡도 증가 |
| 온라인에 `./uploads` 상대 경로 | 클라우드 배포 시 오류 |
| 설정 파일 자동 동기화 | 환경 차이로 인한 문제 |

### ✅ 반드시 해야 할 것
| 내용 | 이유 |
|------|------|
| Java 코드 공통 수정 | 버그 일관성 유지 |
| application.properties 분리 | 환경 충돌 방지 |
| 월 1회 동기화 검토 | 버전 간 격차 최소화 |

---

## 🐳 Docker 배포 (선택사항)

### 폐쇄망 (HSQLDB)
```dockerfile
FROM openjdk:8-jdk-slim
COPY target/offline-messenger-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]
```

### 온라인 (PostgreSQL)
```dockerfile
FROM openjdk:8-jdk-slim
COPY target/offline-messenger-online-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8080 8443
ENV SPRING_PROFILES_ACTIVE=postgresql
CMD ["java", "-jar", "app.jar"]
```

---

## 💡 팁

### 파일 비교
```bash
# 두 버전의 Java 코드 비교
diff -r offline-messenger/src/main/java \
        offline-messenger-online/src/main/java

# Visual Studio Code
code --diff file1.java file2.java
```

### 로그 확인
```bash
# 콘솔 로그 확인
tail -f nohup.out

# H2 Console (개발)
# http://localhost:8080/h2-console
```

### 포트 충돌 해결
```bash
# Linux/macOS
lsof -i :8080
kill -9 <PID>

# Windows PowerShell
netstat -ano | findstr :8080
taskkill /PID <PID> /F

# 다른 포트 사용
java -Dserver.port=8081 -jar app.jar
```

---

## 📞 자주 묻는 질문

### Q. 어느 버전을 기본으로 수정해야 하나?
**A.** 폐쇄망(offline-messenger)을 기본으로 수정하고, 필요시 온라인으로 전파하는 원칙.

### Q. 온라인에만 필요한 기능을 추가하려면?
**A.** `src/main/java/.../online/` 디렉토리를 만들어 온라인 전용 코드 분리.

### Q. PostgreSQL을 폐쇄망에서도 사용하고 싶으면?
**A.** 폐쇄망 `pom.xml`에 PostgreSQL 의존성 추가 후 별도 프로필 생성.

### Q. 두 버전의 코드가 많이 달라지면?
**A.** SYNC_GUIDE.md 섹션 6의 "공유 라이브러리" 패턴 고려.

### Q. Git으로 어떻게 관리하나?
**A.** 각 프로젝트별 독립 저장소 또는 모노레포 + 브랜치로 분리 권장.

---

## 📚 상세 문서

더 자세한 정보는 각 문서 참고:

- **프로젝트 구조 이해** → `PROJECT_STRUCTURE.md`
- **배포 절차 상세** → `DEPLOYMENT_GUIDE.md`
- **버전 동기화** → `SYNC_GUIDE.md`
- **환경 설정** → `.env.example`

---

**마지막 업데이트**: 2026년 6월 18일

