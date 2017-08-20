
-- from bash with sqlite3 file.db < queries.sql 
-- from sqlite3 cli with .read queries.sql



.echo on
.mode column

SELECT COUNT() FROM client; 

SELECT COUNT(DISTINCT rtcInstanceId) FROM client;

SELECT COUNT(DISTINCT rtcSessionId) FROM client;

SELECT COUNT(DISTINCT userId) FROM client;

SELECT INFO, COUNT(*) FROM client GROUP BY INFO;

SELECT COUNT(*) FROM client WHERE (`OR` > 0);

SELECT COUNT(*) FROM client WHERE (OS > 0);

SELECT COUNT(*) FROM client WHERE (MT = 'audio') AND (`OR` > 0);

SELECT COUNT(*) FROM client WHERE (MT = 'screen share')  AND (`OR` > 0);

SELECT COUNT(*) FROM client WHERE (MT = 'video')  AND (`OR` > 0);

.echo off
