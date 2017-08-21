
-- from bash with sqlite3 file.db < queries.sql
-- from sqlite3 cli with .read queries.sql

.echo on
.mode column
.headers on

-----------------------------------------------------------
-- record counts
-----------------------------------------------------------
SELECT COUNT() FROM client;

SELECT COUNT() FROM server;

SELECT COUNT() FROM session;

SELECT COUNT(*) FROM session_user;

-----------------------------------------------------------
-- distinct users
-----------------------------------------------------------
SELECT COUNT(DISTINCT userId) FROM client;

SELECT COUNT(DISTINCT userId) FROM server;

SELECT COUNT(DISTINCT userId) FROM session_user;

-----------------------------------------------------------
-- distinct RTC sessions
-----------------------------------------------------------
SELECT COUNT(DISTINCT rtcInstanceId) FROM client;

SELECT COUNT(DISTINCT rtcInstanceId) FROM server;

SELECT COUNT(DISTINCT sessionInstanceId) FROM session;

-----------------------------------------------------------
-- distinct conversations
-----------------------------------------------------------
SELECT COUNT(DISTINCT rtcSessionId) FROM client;

SELECT COUNT(DISTINCT rtcSessionId) FROM server;

SELECT COUNT(DISTINCT sessionId) FROM session;

-----------------------------------------------------------
-- device usage
-----------------------------------------------------------
SELECT manufacturer, count(*) FROM client WHERE deviceType='WEB' GROUP BY manufacturer;

select manufacturer, count(*) from client where manufacturer <> '' group by manufacturer;

 select clientVersion, count(*) from client group by clientVersion;

select deviceSubtype, count(*) from client group by deviceSubtype;

SELECT DISTINCT osVersion, manufacturer, deviceType, hardwareModel, clientVersion, deviceSubtype, UD, NI FROM client;

-----------------------------------------------------------
-- NW usage
-----------------------------------------------------------
SELECT NI, count(*) FROM client GROUP BY  NI;

-- SELECT COUNT(*) FROM client WHERE (`OR` > 0);

-- SELECT COUNT(*) FROM client WHERE (OS > 0);

-- SELECT COUNT(*) FROM client WHERE (MT = 'audio') AND (`OR` > 0);

-- SELECT COUNT(*) FROM client WHERE (MT = 'screen share')  AND (`OR` > 0);

-- SELECT COUNT(*) FROM client WHERE (MT = 'video')  AND (`OR` > 0);

SELECT disconnectCause, COUNT(disconnectCause) AS count,  COUNT(disconnectCause) / cast ((SELECT COUNT(*) FROM session_user) AS FLOAT) AS percent FROM session_user WHERE sessionInstanceId IN (SELECT rtcInstanceId FROM client) GROUP BY disconnectCause;

SELECT INFO, COUNT(INFO) as count,  COUNT(INFO) / cast ((SELECT COUNT(*) FROM client) AS FLOAT) AS percent FROM client GROUP BY INFO;

SELECT INFO, COUNT(INFO) as count,  COUNT(INFO) / cast ((SELECT COUNT(*) FROM client WHERE MT = 'audio') AS FLOAT) AS percent FROM client WHERE MT = 'audio' GROUP BY INFO;

-----------------------------------------------------------
-- COMPARE RTC SESSIONS
-----------------------------------------------------------
-- select sessionInstanceId, userId, disconnectCause, noOfAudioTimes, noOfVideoTimes, noOfScreenTimes, duration from session_user where sessionInstanceId = 'cc629741-7d59-4bb8-aaff-8ab4ec1e4713_1502733364362';
-- select rtcInstanceId, userId, INFO, MT, duration , `OR`, OS, IPL, IPR  from client where MT = 'audio' and rtcInstanceId = 'cc629741-7d59-4bb8-aaff-8ab4ec1e4713_1502733364362';
-- select rtcInstanceId, userId, INFO, MT, duration , `OR`, OS, IPL, IPR from server where MT = 'audio' and rtcInstanceId = 'cc629741-7d59-4bb8-aaff-8ab4ec1e4713_1502733364362';

-----------------------------------------------------------
-- COMPARE DURATIONS
-----------------------------------------------------------
-- select rtcInstanceId, userId, sum(duration) from client where rtcInstanceId = 'cc629741-7d59-4bb8-aaff-8ab4ec1e4713_1502733364362' and userId = '99b6e74f-4527-4d53-8f0f-8a3428c0892b' and MT = 'audio';
-- select rtcInstanceId, userId, sum(duration) from server where rtcInstanceId = 'cc629741-7d59-4bb8-aaff-8ab4ec1e4713_1502733364362' and userId = '99b6e74f-4527-4d53-8f0f-8a3428c0892b' and MT = 'audio';
-- select sessionInstanceId, userId, duration from session_user where sessionInstanceId = 'cc629741-7d59-4bb8-aaff-8ab4ec1e4713_1502733364362' and userId = '99b6e74f-4527-4d53-8f0f-8a3428c0892b';

-----------------------------------------------------------
-- COMPARE DISCONNECT CAUSE
-----------------------------------------------------------
--  select client.rtcInstanceId, client.userId, client.INFO, session_user.disconnectCause from client INNER JOIN session_user ON session_user.sessionInstanceId = client.rtcInstanceId and session_user.userId = client.userId where session_user.disconnectCause = 'CONNECTION_LOST';

-----------------------------------------------------------
-- server records - min/max/avg JI/Packet Loss/LA
-----------------------------------------------------------
select min(JI),max(JI),avg(JI) from server where MT='audio' and `OS` >0 and `OR` >0;

select min(PLLP),max(PLLP),avg(PLLP) from server where MT='audio' and `OS` >0 and `OR` >0 and duration > 10000;

 select min(PLRP),max(PLRP),avg(PLRP) from server where MT='audio' and `OS` >0 and `OR` >0 and duration > 10000;

select min(LA),max(LA),avg(LA) from server where MT='audio' and `OS` >0 and `OR` >0 and duration > 10000;

--  99% of the server records with JI = 70 -- to be reviewed
select count(*), count(*)/cast ((select count(*) from server where  MT = 'audio' and PR > 0 and duration > 10000) as float) as percentage from server where JI = 70 and MT = 'audio' and PR > 0 and duration > 10000;

-- server records do not provide LA
select count(*) from server where LA is NULL;

-----------------------------------------------------------
-- client records - min/max/avg JI/Packet Loss/LA
-----------------------------------------------------------
select min(JI),max(JI),avg(JI) from client where MT='audio' and `OS` >0 and `OR` >0;

select min(PLLP),max(PLLP),avg(PLLP) from client where MT='audio' and `OS` >0 and `OR` >0 and duration > 10000;

select min(PLRP),max(PLRP),avg(PLRP) from client where MT='audio' and `OS` >0 and `OR` >0 and duration > 10000;

select min(LA),max(LA),avg(LA) from client where MT='audio' and `OS` >0 and `OR` >0 and duration > 10000;

select count(*), count(*)/cast ((select count(*) from client where  MT = 'audio' and PR > 0 and duration > 10000) as float) from client where JI > 30 and MT = 'audio' and PR > 0 and duration > 10000;

select count(*), count(*)/cast ((select count(*) from client where  MT = 'audio' and PR > 0 and duration > 10000) as float) from client where LA > 150 and MT = 'audio' and PR > 0 and duration > 10000;

-----------------------------------------------------------
-- client / server records with packet loss  > 5%
-----------------------------------------------------------
select count(*), count(*)/cast ((select count(*) from client where  MT = 'audio' and PR > 0 and duration > 10000) as float) as `Client PLLP > 5%` from client where PLLP > 0.05 and MT = 'audio' and PR > 0 and duration > 10000;

select count(*), count(*)/cast ((select count(*) from client where  MT = 'audio' and PR > 0 and duration > 10000) as float) as `Client PLLR > 5%`  from client where PLRP > 0.05 and MT = 'audio' and PR > 0 and duration > 10000;

select count(*), count(*)/cast ((select count(*) from server where  MT = 'audio' and PR > 0 and duration > 10000) as float) as `Server PLLP > 5%`  from server where PLLP > 0.05 and MT = 'audio' and PR > 0 and duration > 10000;

select count(*), count(*)/cast ((select count(*) from server where  MT = 'audio' and PR > 0 and duration > 10000) as float) as `Server PLLR > 5%`  from server where PLRP > 0.05 and MT = 'audio' and PR > 0 and duration > 10000;

-----------------------------------------------------------
-- client records with PL > 5% or LA > 150 ms or JI > 30ms
-----------------------------------------------------------
select count(*), count(*)/cast ((select count(*)  from client where  MT = 'audio' and PR > 0 and duration > 10000) as float)
as `client PL > 5% or LA > 150 ms or JI > 30ms` from client
where (PLRP > 0.05 or PLLP > 0.05 or LA > 150 or JI > 30)and MT = 'audio' and PR > 0 and duration > 10000;

-----------------------------------------------------------
-- time histograms
-----------------------------------------------------------
.mode csv

.output client-LA.csv
select datetime(TB/1000,'unixepoch') as Time, LA from client where `OR` > 0 and OS > 0 and MT = 'audio' and duration > 5000;
.output client-JI.csv
select datetime(TB/1000,'unixepoch') as Time, JI from client where `OR` > 0 and OS > 0 and MT = 'audio' and duration > 5000;
.output client-PL.csv
select datetime(TB/1000,'unixepoch') as Time, PLLP, PLRP from client where `OR` > 0 and OS > 0 and MT = 'audio' and duration > 5000;
.output server-JI.csv
select datetime(TB/1000,'unixepoch') as Time, JI from server where `OR` > 0 and OS > 0 and MT = 'audio' and duration > 5000;
.output server-PL.csv
select datetime(TB/1000,'unixepoch') as Time, PLLP, PLRP from server where `OR` > 0 and OS > 0 and MT = 'audio' and duration > 5000;

.mode column
.output stdout

.echo off
