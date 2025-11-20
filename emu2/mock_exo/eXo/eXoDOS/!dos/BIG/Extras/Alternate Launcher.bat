@echo off
cd ..
..\..\..\util\setconsole.exe /minimize
@set var=%cd%
for %%I in (.) do set GameDir=%%~nxI
for %%f in (*^).bat) do set GameName2=%%f
set GameName=%GameName2:~0,-4%
set IndexName=%GameName:~0,-7%
cd ..
cd ..
cd ..
.\util\AltLauncher.bat