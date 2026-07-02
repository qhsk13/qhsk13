# 메신저 배포 및 사용자 안내

## 관리자 배포 파일 만들기

1. `build-distribution.bat`을 실행합니다.
2. `dist\offline-messenger-deploy.zip` 파일을 배포 대상 PC로 전달합니다.
3. 대상 PC에서 zip을 원하는 폴더에 압축 해제합니다.

## 서버 실행

서버 PC에서 아래 중 하나를 실행합니다.

```bat
run-h2.bat
```

또는 개발/관리 PC에서는 수정 후 아래 파일로 빌드와 서버 재시작을 한 번에 처리합니다.

```bat
restart-server-h2.bat
```

실행한 터미널에서 서버 로그가 계속 표시됩니다. 이 창을 닫으면 서버도 종료됩니다. 서버를 끄려면 해당 터미널에서 `Ctrl+C`를 누릅니다.

## 브라우저로 접속

서버 PC 또는 사용자 PC에서 아래 주소로 접속합니다.

```text
http://서버IP:8080
```

서버 PC에서 앱 창처럼 열고 싶으면 아래 파일을 실행합니다.

```bat
run-app-window.bat
```

## 포트 변경

기본 포트는 `8080`입니다. 다른 포트를 쓰려면 아래 중 하나를 사용합니다.

### 실행할 때만 변경

서버 실행 명령 뒤에 `--server.port=포트번호`를 붙입니다.

```bat
java -jar offline-messenger-0.0.1-SNAPSHOT.jar --spring.profiles.active=h2 --server.port=9090
```

개발 폴더에서 실행하는 경우:

```bat
java -jar target\offline-messenger-0.0.1-SNAPSHOT.jar --spring.profiles.active=h2 --server.port=9090
```

접속 주소도 같은 포트로 바꿉니다.

```text
http://서버IP:9090
```

앱 창도 같은 포트로 열어야 합니다.

```bat
run-app-window.bat -Port 9090
```

바탕화면 바로가기도 같은 포트로 만들려면 아래처럼 실행합니다.

```bat
create-desktop-shortcut.bat -Port 9090
```

이미 만들어진 바로가리가 있다면 다시 실행해서 덮어쓰거나, 바탕화면 `Offline Messenger` 바로가기의 `대상` 끝에 포트를 붙입니다.

```text
C:\offline-messenger\run-app-window.bat -Port 9090
```

환경변수로도 지정할 수 있습니다.

```bat
set MESSENGER_PORT=9090
run-app-window.bat
create-desktop-shortcut.bat
```

브라우저 확장을 사용하는 경우, 확장 팝업의 서버 주소도 아래처럼 변경합니다.

```text
http://서버IP:9090
```

### 기본 포트 영구 변경

`src\main\resources\application.properties`에서 아래 값을 원하는 포트로 변경한 뒤 다시 빌드합니다.

```properties
server.port=9090
```

수정 후에는 `restart-server-h2.bat`을 실행하거나 jar를 다시 빌드/재시작해야 합니다.

### Windows 방화벽 확인

다른 PC에서 접속하려면 서버 PC 방화벽에서 해당 포트를 허용해야 합니다.

예: `9090`으로 바꿨다면 TCP `9090` 인바운드 허용이 필요합니다.

## 작업표시줄 고정

Windows는 보안 정책상 프로그램이 자동으로 작업표시줄에 고정하는 것을 제한합니다.

대신 아래 방식으로 고정합니다.

1. `create-desktop-shortcut.bat`을 실행합니다.
2. 바탕화면에 생성된 `Offline Messenger` 바로가기를 실행합니다.
3. 실행된 창의 작업표시줄 아이콘을 우클릭합니다.
4. `작업 표시줄에 고정`을 선택합니다.

포트를 바꿔 쓰는 경우에는 바로가기 생성 시 포트도 같이 지정합니다.

```bat
create-desktop-shortcut.bat -Port 9090
```

### Chrome 메뉴에서 바로가기 만들기

브라우저 확장 팝업 자체는 Chrome 정책상 바탕화면 바로가기 대상으로 안정적으로 만들기 어렵습니다. 대신 브라우저 접속 화면은 바로가기/앱 창으로 만들 수 있도록 설정되어 있습니다.

1. Chrome에서 메신저 주소를 엽니다.

```text
http://서버IP:8080
```

2. Chrome 우측 상단 `⋮` 메뉴를 엽니다.
3. `저장 및 공유` 또는 `도구 더보기`에서 `바로가기 만들기`를 선택합니다.
4. 가능하면 `창으로 열기`를 체크합니다.
5. 생성된 바탕화면 바로가기를 실행한 뒤 작업표시줄에 고정합니다.

포트를 바꿨다면 접속 주소도 같은 포트를 사용합니다.

```text
http://서버IP:9090
```

## 브라우저 확장 설치

1. Chrome 또는 Edge에서 확장 프로그램 관리 화면을 엽니다.
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
2. 개발자 모드를 켭니다.
3. `압축해제된 확장 프로그램 로드`를 선택합니다.
4. `browser-extension` 폴더를 선택합니다.
5. 확장 팝업을 열고 서버 주소를 입력합니다.

예:

```text
http://서버IP:8080
```

## 수정 후 확인 전에 할 일

- Java/API/웹 화면 수정: `restart-server-h2.bat` 실행 후 브라우저 새로고침
- 확장 프로그램 수정: 확장 프로그램 관리 화면에서 새로고침 후 팝업 재접속
- 둘 다 수정: 서버 재시작과 확장 새로고침 모두 수행

## 데이터 백업 및 정리

10~15명이 6개월~1년 사용하는 규모라면 DB 파일이 1~2MB를 넘는 것은 문제가 되지 않습니다. 현재 구조는 업로드 파일을 DB 안에 넣지 않고 `uploads` 폴더에 따로 보관하므로, DB 파일만 급격히 커지는 구조는 아닙니다.

권장 운영 방식은 DB를 용량별로 나누는 것보다 아래 순서입니다.

1. 메시지 조회 인덱스 유지
2. 정기 백업
3. 오래된 백업 파일 정리
4. 사용량이 크게 늘면 PostgreSQL 같은 서버형 DB로 전환 검토

### 백업 방법

가능하면 서버를 잠시 종료한 뒤 백업합니다. H2 파일 DB는 서버가 쓰는 중일 때 복사하면 백업 시점이 완전히 맞지 않을 수 있습니다.

```bat
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\stop-server.ps1
backup-data.bat
run-h2.bat
```

백업 파일은 아래 폴더에 생성됩니다.

```text
backups\messenger-backup-YYYYMMDD-HHMMSS.zip
```

백업에는 아래 항목이 포함됩니다.

- `data`: DB 파일
- `uploads`: 업로드 파일
- `BACKUP_INFO.txt`: 백업 생성 정보

서버를 끄기 어려운 상황에서 임시 백업이 필요하면 아래처럼 실행할 수 있습니다. 단, 이 방식은 최선의 백업이며 권장 방식은 서버 종료 후 백업입니다.

```bat
backup-data.bat -AllowRunning
```

### 오래된 백업 정리

최근 12개만 남기려면 아래 명령을 실행합니다.

```bat
prune-backups.bat -Keep 12
```

월 1회만 보관할지, 주 1회까지 보관할지는 운영 방식에 맞추면 됩니다. 처음에는 최근 12개 이상을 유지하는 것을 권장합니다.

### 언제 더 큰 개선이 필요한가

아래 상황이면 H2 파일 DB 유지보다 서버형 DB 전환을 검토하는 것이 좋습니다.

- DB 파일이 수백 MB 이상으로 증가
- 동시 접속자가 크게 증가
- 메시지/파일 검색 기능을 많이 사용
- 백업 중 서버를 멈추기 어려움
- 여러 PC에서 동시에 관리 작업을 해야 함

그 전까지는 현재 방식에 인덱스와 백업 루틴을 더한 운영으로 충분합니다.
