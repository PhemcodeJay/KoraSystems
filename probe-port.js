const net = require('net');
const host = process.argv[2];
const port = Number(process.argv[3]);
const c = net.connect(port, host, () => { console.log('PORT ' + port + ' OPEN for ' + host); c.end(); });
c.on('error', (err) => { console.log('PORT ' + port + ' closed/unreachable: ' + err.message); process.exit(1); });
