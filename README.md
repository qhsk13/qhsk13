# 폐쇄망 간단 메신저 New V1

## 추가된 기능
- 회원가입 / 로그인
- 여러 곳(웹 + 브라우저 확장 등) 동시 로그인 유지
- 닉네임 변경
- 닉네임을 바꿔도 동일 사용자로 유지
- 프로필 아바타: 성/이름 글자와 무관하게 20종 이모지 세트 중 가입 시 무작위 배정, 이후 원하는 걸로 언제든 변경 가능
- 개인방은 참여자에게만 노출
- 단체방 참여자 추가
- 중복 방 이름 방지
- 방 삭제
- 메시지/파일 기록 유지
- @닉네임 멘션 + "@all"/"@전체" 전체멘션(방 참여자 전원에게 알림)
- 코드 서식 문법 강조 추가(하위 지원 포맷 참고)
- 나와의 채팅 추가(고정 & 삭제 불가, 메모용)

## 실행
```bash
mvn clean package
java -jar target/offline-messenger-0.0.1-SNAPSHOT.jar
```

접속:
```text
http://localhost:8080
```

## 원클릭 운영 스크립트
- `restart-server-h2.bat`: 기존 서버를 종료하고 Maven 빌드 후 H2 서버를 다시 실행합니다. 실행한 터미널에서 서버 로그가 계속 표시됩니다. 서버를 끄려면 해당 터미널에서 `Ctrl+C`를 누릅니다.
- `run-app-window.bat`: 브라우저를 앱 창 형태로 엽니다.
- `create-desktop-shortcut.bat`: 바탕화면에 작업표시줄 고정용 바로가기를 만듭니다.
- `build-distribution.bat`: 배포용 zip 파일을 `dist` 폴더에 생성합니다.
- `backup-data.bat`: `data` DB 파일과 `uploads` 파일을 `backups` 폴더에 zip으로 백업합니다.
- `prune-backups.bat -Keep 12`: 오래된 백업 zip을 정리하고 최근 12개만 남깁니다.

사용자 배포 안내는 `USER_DISTRIBUTION_GUIDE.md`를 참고하세요.

포트를 `8080`이 아닌 값으로 바꾸는 방법도 `USER_DISTRIBUTION_GUIDE.md`의 `포트 변경` 섹션에 정리되어 있습니다.
앱 창과 바탕화면 바로가리는 `run-app-window.bat -Port 9090`, `create-desktop-shortcut.bat -Port 9090`처럼 실행할 수 있습니다.
Chrome에서 `http://서버IP:8080` 접속 후 메뉴의 `바로가기 만들기`를 사용해도 앱 창 바로가기를 만들 수 있습니다.

## 폐쇄망 반입 전 필수 교체
아래 파일을 실제 파일로 교체하세요.

```text
src/main/resources/static/vendor/sockjs.min.js
src/main/resources/static/vendor/stomp.min.js
```

다운로드:
- https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js
- https://cdn.jsdelivr.net/npm/stompjs@2.3.3/lib/stomp.min.js

## DB/파일 보존 위치
- DB: ./data/messenger-db.mv.db
- 업로드: ./uploads

## DB 운영 권장
- 10~15명이 6개월~1년 사용하는 규모에서는 1~2MB DB는 매우 작은 편입니다. 현재 구조에서는 DB를 용량별로 쪼개기보다 인덱스, 백업, 업로드 파일 정리가 더 중요합니다.
- 메시지 조회용 인덱스는 `roomId + createdAt`, `roomId + id` 기준으로 보강되어 있습니다.
- 백업은 서버를 잠시 종료한 뒤 `backup-data.bat`을 실행하는 방식을 권장합니다.
- 장기간 운영 시 주 1회 백업, 업데이트 전 백업, 최근 12개 이상 백업 보관을 권장합니다.

## 주의
비밀번호는 SHA-256 단순 해시입니다. 폐쇄망 내부 테스트용 수준입니다.
운영용이면 BCrypt 등 강한 비밀번호 해시와 권한 정책을 추가하세요.

## v9 UI 변경
- 검색 후보 별도 영역 제거
- 검색 결과는 selectbox 안에서 바로 필터링
- 상단 방 정보/사용자 추가/방 액션 영역 분리 정렬

## Browser Extension
Chrome/Edge extension client files are in `browser-extension`.

1. Start the server.
   ```bash
   mvn clean package
   java -jar target/offline-messenger-0.0.1-SNAPSHOT.jar
   ```
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable developer mode.
4. Choose Load unpacked and select the `browser-extension` folder.
5. Open the extension popup and keep the server URL as `http://localhost:8080`.


## Database Options
DB selection docs: see `DATABASE_OPTIONS.md`.
Run scripts:
- `run-h2.bat` keeps the existing H2 file DB.
- `run-h2-postgres-mode.bat` uses embedded H2 with PostgreSQL compatibility mode.
- `run-hsqldb.bat` uses embedded HSQLDB file DB.


## Extension Notifications
Desktop notification setup docs: see `EXTENSION_NOTIFICATIONS.md`.
Required user checklist:
- Reload the extension after updating files.
- Open the extension popup once and log in.
- Enable `메시지 알림` in the profile area.
- Allow notifications in Chrome/Edge and Windows settings.
- Keep the browser running; background checks run about every 10 seconds.
- Optional: enable Chrome/Edge's "keep running background apps when browser is closed" setting so notifications keep working even after closing all browser windows (see `EXTENSION_NOTIFICATIONS.md`). Fully quitting the browser process or shutting down/sleeping the PC still blocks notifications, since this closed-network app has no external push server.

#
# 코드 공유(서식 유지) 기능 가이드

채팅 메시지에 코드를 붙여넣거나 작성할 때 들여쓰기·줄바꿈을 그대로 보존하고, 언어별 문법 강조(하이라이트)를 적용하는 기능입니다. 외부 라이브러리 없이 순수 JS(`src/main/resources/static/code-format.js`)로 구현되어 있어 인터넷 연결 없이도 동작합니다.

## 실행 전 필수: 반드시 다시 빌드하세요

이 프로젝트는 `run-h2.bat` 등이 미리 빌드된 `target\offline-messenger-0.0.1-SNAPSHOT.jar`를 실행하는 구조입니다. **소스 코드(`src/...`)만 수정하고 바로 `run-h2.bat`을 실행하면 예전 jar가 그대로 실행되어 변경 사항이 보이지 않습니다.**

코드/화면을 수정한 뒤에는 항상 아래 순서로 실행하세요.

```bat
build-package.bat
:: 내부적으로 mvn clean package 실행 → target\offline-messenger-0.0.1-SNAPSHOT.jar 새로 생성
run-h2.bat
```

브라우저 확장을 쓰는 경우에도 서버가 새 jar로 재시작된 뒤 확장을 새로고침(재설치/새로고침)해야 최신 화면이 반영됩니다. 이미 열려 있던 브라우저 탭은 캐시 때문에 예전 화면이 남아 있을 수 있으니 강력 새로고침(Ctrl+Shift+R)도 함께 해주세요.

## 적용 범위: 브라우저(웹페이지) + 크롬 확장 모두 적용됨

이 코드 서식 기능은 두 곳 모두에 반영되어 있습니다.

- **브라우저(웹페이지)**: `src/main/resources/static/`의 `index.html`/`app.js`/`code-format.js` — `http://localhost:8080` 접속 시 보이는 화면.
- **크롬 확장(팝업)**: `browser-extension/`의 `popup.html`/`popup.js`/`code-format.js` — 완전히 별개의 코드베이스라 `code-format.js`를 그대로 복제해 넣고 동일한 `[코드]` 버튼/언어 선택/자동 하이라이트/Tab 들여쓰기 로직을 이식했습니다.

두 코드베이스가 독립적이라, 앞으로 이 기능을 더 고치거나 언어를 추가할 때는 **`src/main/resources/static/code-format.js`와 `browser-extension/code-format.js` 두 파일을 모두 같은 내용으로 수정**해야 양쪽이 계속 동일하게 동작합니다.

확장 프로그램은 별도 빌드가 필요 없습니다 — 파일 수정 후 `chrome://extensions`에서 이 확장을 새로고침(또는 껐다 켜기)하면 바로 반영됩니다.

## 사용법

### 방법 1. [코드] 버튼 + 언어 선택 (권장)

메시지 입력창 옆에 언어 선택 드롭다운과 `코드` 버튼이 있습니다.

1. 드롭다운에서 원하는 언어를 명시적으로 선택합니다(기본값 `자동감지`).
2. 코드를 입력창에 미리 써두고 그 부분을 드래그로 선택한 상태에서 `코드` 버튼을 누르면, 선택한 언어로 코드 펜스(\`\`\`)가 자동으로 감싸집니다.
3. 아무것도 선택하지 않고 버튼을 누르면 빈 코드 블록 템플릿이 삽입되고, 그 안에 코드를 입력하면 됩니다.

자동 감지에 의존하지 않고 언어를 직접 지정하고 싶다면 이 방법이 가장 확실합니다.

### 방법 2. 코드 펜스(\`\`\`언어) 직접 입력

마크다운/깃허브/슬랙 등에서 흔히 쓰는 방식과 동일합니다. 아래 예시에서 **채팅창에 실제로 입력할 부분은 안쪽의 백틱 3개(\`\`\`)로 감싼 부분만**입니다. 예시를 감싸고 있는 바깥쪽 백틱 4개(````)는 이 문서에서 "예시 텍스트"임을 표시하려고 쓴 것일 뿐, 실제 메시지에는 필요 없습니다. (이 문서를 그대로 복사해서 붙여넣다가 바깥쪽 4개짜리 백틱까지 같이 복사되는 실수가 흔합니다 — 여는 펜스와 닫는 펜스의 백틱 개수가 다르면 인식이 안 되니 주의하세요.)

> 채팅창에 입력할 내용(이 인용문 안의 텍스트 전체를 그대로 복사하면 됩니다):
> ````
> 설명 텍스트도 같이 쓸 수 있습니다.
> ```java
> public class Main {
>     public static void main(String[] args) {
>         System.out.println("hello");
>     }
> }
> ```
> 확인 부탁드려요
> ````

애매하면 그냥 **방법 1(버튼 + 언어 선택)을 쓰는 게 가장 안전**합니다. 버튼은 백틱을 직접 타이핑할 필요가 없어서 이런 실수 자체가 생기지 않습니다.

언어 이름은 정확히 몰라도 됩니다. 아래 별칭도 인식합니다.

| 언어 | 인식되는 별칭 |
|---|---|
| Java | `java` |
| JSP | `jsp`, `jspx` |
| HTML | `html`, `htm`, `xhtml` |
| XML | `xml` |
| Markdown | `markdown`, `md` |
| CSS | `css` |
| JavaScript | `javascript`, `js`, `jsx`, `ts`, `tsx`, `typescript` |
| JSON | `json` |
| SQL | `sql` |
| Python | `python`, `py`, `python3` |
| Shell | `bash`, `sh`, `shell`, `zsh` |
| YAML | `yaml`, `yml` |
| Properties | `properties`, `props`, `ini` |
| 서식 없는 텍스트 | `text`, `txt`, `plain`, `plaintext` |

언어를 안 적고 \`\`\`만 써도 되고(빈 채로), 그 경우 아래 자동 감지가 동작합니다.

### 방법 3. 펜스 없이 그냥 붙여넣기 (자동 감지)

코드처럼 보이는 특징(예: `public class`, `<%@ page`, `SELECT ... FROM`, `def 함수():` 등)이 충분히 있으면 펜스 없이 붙여넣어도 자동으로 코드 블록으로 표시됩니다. 다만 자동 감지는 휴리스틱이라 애매한 짧은 텍스트는 놓칠 수 있습니다. **확실하게 하이라이트하고 싶다면 방법 1(버튼+언어 선택)을 권장합니다.**

### 그 외 편의 기능

- **Tab 키**: 입력창에서 Tab을 누르면 포커스가 이동하지 않고 공백 4칸이 들어가 들여쓰기를 유지할 수 있습니다.
- **복사 버튼**: 렌더링된 코드 블록 우측 상단에 `복사` 버튼이 있어 원본 코드를 그대로 클립보드에 복사할 수 있습니다.
- **JSON 자동 정렬**: JSON으로 인식된 코드는 보기 좋게 자동으로 들여쓰기(pretty-print) 되어 표시됩니다(전송된 원문은 그대로 유지, 화면 표시만 정렬).
- **마크다운 뷰/코드 전환**: 마크다운(````markdown`) 코드 블록에는 우측 상단에 `뷰` / `코드` 버튼이 있습니다. `뷰`를 누르면 `#`, `-`, `**굵게**` 같은 문법이 실제 제목·목록·굵은 글씨 등으로 렌더링된 화면을 보여주고, `코드`를 누르면 원래처럼 문법 강조만 된 원문을 보여줍니다. 기본값은 `뷰`(렌더링된 화면)입니다. 다른 언어(Java, HTML 등)에는 이 버튼이 없고 항상 문법 강조된 코드 형태로만 표시됩니다.

## 언어별 작성 예시

아래 예시들은 실제로 채팅창에 그대로 붙여넣으면 자동 감지되거나, 펜스를 붙이면 해당 언어로 강조됩니다.

**Java**
````
```java
public class Main {
    public static void main(String[] args) {
        System.out.println("hello");
    }
}
```
````

**JSP**
````
```jsp
<%@ page contentType="text/html;charset=UTF-8" %>
<html>
<body>
  <%= user.getName() %>님 환영합니다.
</body>
</html>
```
````

**HTML**
````
```html
<!DOCTYPE html>
<html>
<head><title>예시</title></head>
<body><div class="box">내용</div></body>
</html>
```
````

**XML**
````
```xml
<?xml version="1.0" encoding="UTF-8"?>
<config>
  <name>offline-messenger</name>
</config>
```
````

**Markdown**
````
```markdown
# 제목
- 항목1
- 항목2
[링크](https://example.com)
```
````

**CSS**
````
```css
.box {
  color: red;
  margin: 10px;
}
```
````

**JavaScript**
````
```javascript
function greet(name) {
    console.log(`hello, ${name}`);
}
```
````

**JSON**
````
```json
{"name":"kim","age":30,"active":true}
```
````

**SQL**
````
```sql
SELECT * FROM users WHERE id = 1;
```
````

**Python**
````
```python
def add(a, b):
    return a + b
```
````

**Shell**
````
```bash
#!/bin/bash
echo "hello world"
```
````

**YAML**
````
```yaml
server:
  port: 8080
list:
  - a
  - b
```
````

**Properties**
````
```properties
server.port=8080
spring.datasource.url=jdbc:h2:mem:test
```
````

## 나와의 채팅

가입한 모든 계정에는 방 목록에 **"나와의 채팅"**이 자동으로 하나 생성되어 있습니다(가입 시, 그리고 방 목록을 불러올 때마다 없으면 자동으로 만들어집니다). 이 방은 본인만 볼 수 있는 개인 메모용 공간으로, 다음과 같은 제약이 있습니다.

- **삭제할 수 없습니다**: 방 목록에 삭제(X) 버튼 자체가 표시되지 않고, 서버에서도 삭제 요청을 거부합니다.
- **나갈 수 없습니다.**
- **다른 사람을 초대할 수 없습니다**(참여자 추가는 단체방에서만 가능).
- 방 이름은 표시상으로만 "나와의 채팅"으로 고정되어 있고(이름 변경은 가능), 코드 공유·마크다운 뷰 전환 등 다른 모든 채팅 기능은 동일하게 사용할 수 있습니다.

## 최근 수정 사항 (변경 이력)

- **전체멘션("@all"/"@전체") 추가**: 메시지 입력 중 `@all` 또는 `@전체`를 입력하면(또는 멘션 자동완성 드롭다운 맨 위 `전체` 항목을 선택하면) 방에 있는 참여자 전원이 멘션 대상이 되어 알림을 받습니다. 서버(`ChatService`)에서 방의 활성 참여자 전원을 멘션 ID 목록에 담아 처리하며, 웹페이지(`app.js`)와 크롬 확장(`popup.js`) 양쪽에 동일하게 적용되어 있습니다.
- **동시 로그인 유지(로그인 세션 다중화)**: 예전에는 사용자별로 세션 토큰을 1개만 저장해서, 브라우저 확장에서 로그인하면 웹 브라우저 로그인이 풀리는 문제가 있었습니다. 로그인/회원가입 시 토큰을 별도의 `UserSession` 테이블에 추가로 저장하고 기존 토큰은 무효화하지 않도록 `AuthService`를 변경해, 이제 웹과 확장 프로그램(그 외 여러 탭/기기)에서 동시에 로그인 상태를 유지할 수 있습니다.
- **확장 프로그램 알림: 브라우저 종료 후에도 계속 받기 안내 추가**: 폐쇄망 특성상 외부 푸시 서버(FCM 등)를 쓸 수 없어 브라우저 프로그램 자체가 백그라운드에서 실행 중이어야 알림을 받을 수 있습니다. `EXTENSION_NOTIFICATIONS.md`에 Chrome/Edge의 "브라우저 종료 후에도 백그라운드 앱 계속 실행" 설정을 켜는 방법을 추가해, 브라우저 창을 모두 닫아도(프로세스가 트레이에 남아있는 한) 확장의 백그라운드 폴링과 알림이 계속 동작하도록 안내합니다. PC를 완전히 끄거나 절전 상태이면 여전히 알림을 받을 수 없습니다.
- **코드 서식/문법 강조 기능 추가**: `code-format.js` 신설. 펜스(\`\`\`언어) 인식, 언어 자동 감지, 정규식 기반 문법 강조(주석/문자열/키워드/태그 등), 복사 버튼, JSON 자동 정렬.
- **입력창 개선**: `[코드]` 버튼 + 언어 선택 드롭다운 추가(자동 감지 대신 언어를 명시적으로 지정 가능). Tab 키로 들여쓰기 삽입. 메시지 전송 시 앞뒤 공백만 정리하고 내부 들여쓰기/줄바꿈은 그대로 보존.
- **불필요한 오류 팝업 제거**: 새 메시지를 수신할 때마다 자동으로 실행되던 방 목록 새로고침(`loadRooms`)이 실패해도 더 이상 `alert` 팝업을 띄우지 않고 콘솔 경고로만 남깁니다(사용자가 직접 방 생성/삭제/이름변경 등을 했을 때 실패하면 기존처럼 알림이 뜹니다).
- **에러 메시지 개선**: 로그인 만료 등 인증 관련 서버 오류 메시지를 그대로 보여주도록 하여, 이전처럼 "입력값을 확인해주세요."라는 뭉뚱그린 메시지 대신 실제 원인을 확인할 수 있습니다.
- **코드 펜스 인식 버그 수정**: 여는 펜스와 닫는 펜스의 백틱 개수가 정확히 3개로 일치해야만 인식되던 문제를 고쳐, 백틱 3개 이상(4개 등)도 인식하되 여는/닫는 개수가 서로 같을 때만 짝짓도록 변경했습니다. 이 문서의 예시를 복사할 때 바깥쪽 4개짜리 백틱까지 같이 복사해도 전체가 하나의 코드 블록으로는 표시됩니다(다만 정확한 렌더링을 위해서는 안쪽 3개짜리 부분만 복사하는 걸 권장). 또한 Windows에서 붙여넣은 텍스트의 줄바꿈(CRLF)도 통일해서 처리하도록 수정했습니다.
- **마크다운 뷰/코드 전환 추가**: 마크다운 코드 블록에 `뷰`/`코드` 토글 버튼을 추가했습니다. `뷰`는 제목·목록·굵게·기울임·링크·인용문 등을 실제 HTML 요소로 렌더링하고, `코드`는 기존의 문법 강조된 원문을 보여줍니다. 웹페이지와 크롬 확장 양쪽에 동일하게 적용되어 있습니다.
- **"나와의 채팅" 추가**: 계정별로 삭제·나가기·참여자 추가가 불가능한 개인 메모용 방을 자동 생성합니다.
