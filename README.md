## Node.js scripts to alalyze Circuit QoS data

### Import Records
```bash
node  sqlImport.js  --db ./mydb.db --client ./data/client-qos.json --server ./data/server-qos.json --session ./data/cha/sessions.json --clean
```
### Sample queries
On the cli (https://sqlite.org/cli.html) enter:

```bash
.read queries.sql
```

### Import media server log from load test tool
```bash
node sqlImport.js --loadtest ./data/mediaserver.log --db loadtest.db
```
