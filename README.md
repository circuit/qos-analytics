## Node.js scripts to alalyze Circuit QoS data


### Import Records
```bash
node  sqlImport.js  --db ./mydb.db --client ./data/client-qos.json --server ./data/server-qos.json --session ./data/cha/sessions.json --clean
```
### Sample queries
https://sqlite.org/cli.html

To display column attributes, enter: .headers ON.

To display rows in column style, enter: .mode column.

To run sample queries enter: .read queries.sql
