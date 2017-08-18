## Node.js scripts to alalyze Circuit QoS data


### Run sqlite command line

```bash
sqlite3 mydb.db
.headers ON
.mode column
select duration/1000 AS duration, ROUND(meanOpinionScore,1) AS mos, osVersion, deviceType, deviceSubtype, OS, `OR`, LA, JI, ST, CT, RCT, MT, UD, NI, RCT, LCT, ROUND(p_loss_sent,3) AS pl_sent, ROUND(p_loss_rcvd,3) AS pl_recv, INFO from qos order by (pl_sent+pl_recv) DESC  limit 100;
```
https://sqlite.org/cli.html
To display column attributes, enter .headers ON.
To display rows in column style, enter .mode column.


### Thresholds
Receive-side jitter in milliseconds > 50ms
Measured round-trip time  > 300 ms
packet loss > 5%
recurring for 3 consecutive collection periods of 30s each for desktop clients
recurring for 2 consecutive collection periods of 30s each for mobile clients


### Sample queries

// Overview of clients
select DISTINCT osVersion, manufacturer, deviceType, hardwareModel, clientVersion, deviceSubtype, UD, NI from qos;

// Browser versions
select manufacturer, count(*) from qos where deviceType='WEB' group by manufacturer;

// Wired vs wireless
select NI, count(*) from qos group by NI;

//
select clientVersion, count(*) from qos where deviceSubtype='DESKTOP_APP' group by clientVersion;

select count(*) from qos where LA > 300;
select INFO AS 'INFO                       ', count(*) from qos where INFO in 'CLIENT_ENDED:LOST_WEBSOCKET_CONNECTION' group by INFO;