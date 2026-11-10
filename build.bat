@echo off
chcp 65001 >nul
setlocal
set "CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%CSC%" set "CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe"
if not exist "%CSC%" (echo [x] 找不到 csc.exe，本机可能没装 .NET Framework 4.x & pause & exit /b 1)
echo [*] 编译 TakeToken.cs 化为 龙湖取Token.exe ...
"%CSC%" /nologo /target:winexe /platform:anycpu /optimize+ /codepage:65001 /out:"%~dp0龙湖取Token.exe" /r:System.dll /r:System.Core.dll /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.IO.Compression.dll "%~dp0TakeToken.cs"
if errorlevel 1 (echo [x] 编译失败 & pause & exit /b 1)
echo [ok] 完成: %~dp0龙湖取Token.exe
pause
