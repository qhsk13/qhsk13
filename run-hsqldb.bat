@echo off
cd /d "%~dp0"
java -jar target\offline-messenger-0.0.1-SNAPSHOT.jar --spring.profiles.active=hsqldb
