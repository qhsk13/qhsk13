# 폐쇄망 배포 가이드 (offline-messenger)

## 시스템 요구사항

- **Java**: JDK 8 이상
- **Database**: H2 (메모리) 또는 HSQLDB (권장)
- **OS**: Linux, macOS, Windows
- **Port**: 8080 (HTTP)
- **네트워크**: 인터넷 연결 불필요 (폐쇄망)

---

## 사전 준비

### 1. H2 Database 사용 (기본, 메모리)

메모리 기반이므로 별도 설치 불필요합니다. 서버 재시작 시 데이터 손실됨.

### 2. HSQLDB 사용 (파일 기반, 권장)

HSQLDB는 파일로 데이터를 저장하므로 서버 재시작 후에도 데이터 유지됩니다.

**HSQLDB 서버 실행** (선택사항):
```bash
# HSQLDB 디렉토리에서
cd hsqldb-2.x.x/lib
java -cp hsqldb.jar org.hsqldb.Server -database.0 file:offline_messenger -dbname.0 messenger
```

### 3. 환경 변수 설정

기본값으로 H2 메모리 DB를 사용하므로 별도 설정 불필요합니다.

HSQLDB 사용 시:
```bash
# Linux/macOS
export SPRING_PROFILES_ACTIVE=hsqldb
export SPRING_DATASOURCE_URL=jdbc:hsqldb:file:./data/messenger;shutdown=true

# Windows (PowerShell)
$env:SPRING_PROFILES_ACTIVE="hsqldb"
$env:SPRING_DATASOURCE_URL="jdbc:hsqldb:file:./data/messenger;shutdown=true"
```

---

## 빌드

```bash
cd offline-messenger

# 기본 빌드
mvn clean package

# 테스트 스킵
mvn clean package -DskipTests

# 빌드 완료
# target/offline-messenger-0.0.1-SNAPSHOT.jar 생성
```

---

## 실행

### H2 메모리 DB (기본)
```bash
java -jar offline-messenger-0.0.1-SNAPSHOT.jar
```

### HSQLDB 사용
```bash
java -Dspring.profiles.active=hsqldb \
  -Dspring.datasource.url="jdbc:hsqldb:file:./data/messenger;shutdown=true" \
  -jar offline-messenger-0.0.1-SNAPSHOT.jar
```

### 배경 실행 (Linux/macOS)
```bash
nohup java -jar offline-messenger-0.0.1-SNAPSHOT.jar &
```

### 배경 실행 (Windows PowerShell)
```powershell
Start-Process -FilePath "java" `
  -ArgumentList "-jar offline-messenger-0.0.1-SNAPSHOT.jar" `
  -NoNewWindow
```

---

## 간단한 배포 (Windows 배치 파일)

### run-offline-messenger.bat 생성
```batch
@echo off
cd /d %~dp0
setlocal enabledelayedexpansion

REM H2 메모리 DB로 실행 (기본)
java -jar target/offline-messenger-0.0.1-SNAPSHOT.jar

REM 또는 HSQLDB 사용
REM java -Dspring.profiles.active=hsqldb ^
REM   -Dspring.datasource.url="jdbc:hsqldb:file:./data/messenger;shutdown=true" ^
REM   -jar target/offline-messenger-0.0.1-SNAPSHOT.jar

pause
```

### stop-server.bat (서버 중지)
```batch
@echo off
REM Windows에서 8080 포트 사용 중인 프로세스 종료
netstat -ano | findstr :8080
REM PID를 찾아 종료
taskkill /PID <PID> /F
pause
```

---

## Docker 배포 (폐쇄망)

### Dockerfile 작성
```dockerfile
FROM openjdk:8-jdk-slim
WORKDIR /app
COPY target/offline-messenger-0.0.1-SNAPSHOT.jar app.jar
COPY ./data /app/data
EXPOSE 8080
ENV SPRING_PROFILES_ACTIVE=hsqldb
ENV SPRING_DATASOURCE_URL=jdbc:hsqldb:file:/app/data/messenger;shutdown=true
ENTRYPOINT ["java", "-jar", "app.jar"]
```

### Docker 이미지 빌드
```bash
docker build -t offline-messenger:latest .
```

### Docker 컨테이너 실행
```bash
docker run -d \
  --name messenger \
  -p 8080:8080 \
  -v messenger_data:/app/data \
  offline-messenger:latest
```

---

## 운영

### 헬스 체크
```bash
curl http://localhost:8080/actuator/health
```

### 로그 확인
```bash
# 콘솔 로그 (배경 실행 중인 경우)
tail -f nohup.out

# Windows의 경우
Get-Content nohup.out -Wait
```

### H2 Console (개발/디버깅용)

H2 Web Console 활성화 (application.properties):
```properties
spring.h2.console.enabled=true
spring.h2.console.path=/h2-console
```

접근: `http://localhost:8080/h2-console`

### 데이터 백업 (HSQLDB)

```bash
# HSQLDB 데이터 백업
cp -r ./data/messenger.* ./backup/

# 또는 SQL 덤프
java -cp hsqldb.jar org.hsqldb.util.ScriptTool \
  --database jdbc:hsqldb:file:./data/messenger \
  --output backup.sql
```

---

## 성능 조정

### JVM 메모리 설정

```bash
# 기본 실행 (메모리 자동 관리)
java -jar offline-messenger-0.0.1-SNAPSHOT.jar

# 메모리 명시 (동시 사용자 많은 경우)
java -Xmx1G -Xms512M -jar offline-messenger-0.0.1-SNAPSHOT.jar

# 옵션 설명
# -Xmx: 최대 힙 메모리 (1G = 1 GB)
# -Xms: 초기 힙 메모리
```

### 데이터베이스 연결 풀

application.properties:
```properties
spring.datasource.hikari.maximum-pool-size=10
spring.datasource.hikari.minimum-idle=2
spring.datasource.hikari.idle-timeout=300000
```

---

## 문제 해결

### 포트 8080이 이미 사용 중
```
Address already in use: bind
```
**해결**:
```bash
# Linux/macOS: 포트 사용 중인 프로세스 확인
lsof -i :8080
kill -9 <PID>

# Windows PowerShell
netstat -ano | findstr :8080
taskkill /PID <PID> /F
```

다른 포트 사용:
```bash
java -Dserver.port=8081 -jar offline-messenger-0.0.1-SNAPSHOT.jar
```

### H2 데이터 초기화
```bash
# H2 메모리 DB는 자동으로 초기화됨 (재시작 시)
# HSQLDB 파일 삭제 후 재시작
rm ./data/messenger.*
```

### 메모리 부족
```
java.lang.OutOfMemoryError: Java heap space
```
**해결**:
```bash
java -Xmx2G -jar offline-messenger-0.0.1-SNAPSHOT.jar
```

---

## 폐쇄망 배포 체크리스트

- [ ] 프로젝트 빌드 성공
- [ ] JAR 파일 생성 확인
- [ ] 로컬 환경에서 테스트 완료
- [ ] H2/HSQLDB 정상 작동 확인
- [ ] 파일 업로드/다운로드 기능 테스트
- [ ] WebSocket 채팅 기능 테스트
- [ ] 방화벽 설정 (필요 시 8080 포트 개방)
- [ ] 백업 정책 수립
- [ ] 운영 인력 교육 완료

