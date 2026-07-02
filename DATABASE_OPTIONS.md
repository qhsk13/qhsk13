# Database Options

This project is designed to be copied as a whole folder and run in a closed network.
Build the jar once in an internet-enabled environment so Maven can download dependencies.
After that, copy the whole folder including `target`, `data`, `uploads`, `browser-extension`,
and the `run-*.bat` files.

## Options

### 1. Existing H2 file DB

This is the default and keeps the current DB file path.

```bat
run-h2.bat
```

Profile:

```text
h2
```

Data file:

```text
data/messenger-db.mv.db
```

### 2. H2 PostgreSQL compatibility mode

This is still embedded H2, but runs with PostgreSQL compatibility settings.
No external PostgreSQL server is required.

```bat
run-h2-postgres-mode.bat
```

Profile:

```text
h2-postgres-mode
```

Data file:

```text
data/messenger-pgmode.mv.db
```

### 3. HSQLDB embedded file DB

This is a second embedded DB engine. It runs without a separate DB server and stores files under `data`.

```bat
run-hsqldb.bat
```

Profile:

```text
hsqldb
```

Data files:

```text
data/messenger-hsqldb.*
```

## Manual Run

You can also select a DB profile manually.

```bat
java -jar target\offline-messenger-0.0.1-SNAPSHOT.jar --spring.profiles.active=h2
java -jar target\offline-messenger-0.0.1-SNAPSHOT.jar --spring.profiles.active=h2-postgres-mode
java -jar target\offline-messenger-0.0.1-SNAPSHOT.jar --spring.profiles.active=hsqldb
```

## Packaging For Closed Network

1. In an internet-enabled environment, run:

```bat
build-package.bat
```

2. Copy or zip the whole project folder.
3. In the closed network, unzip it and run one of the `run-*.bat` files.

## Notes

- True PostgreSQL is a separate server database and is not normally embedded in a Spring Boot jar.
- `application-postgresql-example.properties` is included only as a future template for a real PostgreSQL server.
- The existing H2 option is preserved as `application-h2.properties`.
- The common app settings stay in `application.properties`.
